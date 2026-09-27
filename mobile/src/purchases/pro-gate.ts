import { router } from 'expo-router';

/**
 * Why the paywall opened. Each reason is also the RevenueCat placement identifier.
 * To gate something new: add a reason here, call `requirePro(reason)` at the call site,
 * and fill in the per-reason copy the compiler then asks for.
 */
export const PRO_REASONS = [
  'onboarding',
  'post_workout',
  'second_plan',
  'switch_plan',
  'progress_history',
  'body_trends',
  'targets',
  'settings',
] as const;

export type ProReason = (typeof PRO_REASONS)[number];

export function parseProReason(value: unknown): ProReason {
  const raw = Array.isArray(value) ? value[0] : value;
  return (PRO_REASONS as readonly unknown[]).includes(raw) ? (raw as ProReason) : 'settings';
}

export type PaywallOutcome = 'purchased' | 'restored' | 'dismissed' | 'unavailable';

export type ProGateDeps = {
  /** Current cached entitlement. */
  isPro: () => boolean;
  /** Show the paywall for this session. Throwing settles the session as `unavailable`. */
  present: (reason: ProReason, session: string) => void;
};

/** Exported for tests; the app uses the singleton below. */
export function createProGate(deps: ProGateDeps) {
  let open: { session: string; promise: Promise<PaywallOutcome>; resolve: (o: PaywallOutcome) => void } | null =
    null;
  let sessions = 0;

  /**
   * Settles the open paywall exactly once. Calls for another (or an already settled)
   * session are ignored, so the screen can call this from every exit path and on unmount.
   */
  function settlePaywall(session: string | undefined, outcome: PaywallOutcome): void {
    if (!open || session == null || open.session !== session) {
      return;
    }
    const { resolve } = open;
    open = null;
    resolve(outcome);
  }

  /** Opens the paywall and resolves when it closes. A second call while open joins the first. */
  function openPaywall(reason: ProReason): Promise<PaywallOutcome> {
    if (open) {
      return open.promise;
    }
    sessions += 1;
    const session = String(sessions);
    let resolve: (o: PaywallOutcome) => void = () => undefined;
    const promise = new Promise<PaywallOutcome>((done) => {
      resolve = done;
    });
    open = { session, promise, resolve };
    try {
      deps.present(reason, session);
    } catch {
      settlePaywall(session, 'unavailable');
    }
    return promise;
  }

  /**
   * True when Pro now. Otherwise opens the paywall and resolves once it closes: true after
   * a purchase or restore. A repeat tap while the paywall is open resolves false, so the
   * gated action runs once, from the first caller.
   */
  async function requirePro(reason: ProReason): Promise<boolean> {
    if (deps.isPro()) {
      return true;
    }
    if (open) {
      return false;
    }
    const outcome = await openPaywall(reason);
    return outcome === 'purchased' || outcome === 'restored';
  }

  return {
    requirePro,
    openPaywall,
    settlePaywall,
    isPaywallOpen: () => open != null,
  };
}

let cachedIsPro = false;

/** Fed by the workout store so gates can check Pro outside the React tree. */
export function setProCache(isPro: boolean): void {
  cachedIsPro = isPro;
}

const gate = createProGate({
  isPro: () => cachedIsPro,
  present: (reason, session) => {
    router.push({ pathname: '/paywall', params: { reason, session } });
  },
});

/** True if Pro now; otherwise opens the paywall and resolves when it closes (true after purchase or restore). */
export const requirePro = gate.requirePro;

/** Opens the paywall and resolves with how it closed. De-dupes: a second call joins the open one. */
export const openPaywall = gate.openPaywall;

/** Called by the paywall screen on every exit path; only the first call for a session counts. */
export const settlePaywall = gate.settlePaywall;
