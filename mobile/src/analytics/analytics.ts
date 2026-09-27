import PostHog from 'posthog-react-native';

/**
 * Product analytics (PostHog, EU cloud). Anonymous by design:
 * - no identify(), no person profiles, no GeoIP, no session replay;
 * - events carry counts and choices, never workout contents, body metrics or free text.
 * That keeps App Privacy at "Usage Data → Product Interaction, Analytics, not linked".
 *
 * Off unless EXPO_PUBLIC_POSTHOG_KEY is set. Development builds only log to the console
 * unless EXPO_PUBLIC_ANALYTICS_IN_DEV=1, so testing doesn't pollute production data.
 */

export type AnalyticsEvent =
  | { name: 'onboarding_completed'; props: { path: 'template' | 'own'; days_per_week: number } }
  | { name: 'workout_started'; props: { exercises: number; resumed: boolean } }
  | { name: 'set_logged'; props: { set_number: number } }
  | {
      name: 'workout_completed';
      props: { exercises: number; sets: number; duration_minutes: number; prs: number };
    }
  | { name: 'check_in_saved'; props: { fields: number } }
  | { name: 'paywall_viewed'; props: { reason: string } }
  | { name: 'purchase_started'; props: { reason: string; package: string } }
  | {
      name: 'purchase_finished';
      props: {
        reason: string;
        package: string;
        outcome: 'success' | 'cancelled' | 'pending' | 'error';
      };
    }
  | { name: 'restore_finished'; props: { outcome: 'restored' | 'none' | 'error' } };

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() || null;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';
const SEND_IN_DEV = process.env.EXPO_PUBLIC_ANALYTICS_IN_DEV === '1';
const ENABLED = KEY != null && (!__DEV__ || SEND_IN_DEV);

let client: PostHog | null = null;

function posthog(): PostHog | null {
  if (!ENABLED || !KEY) {
    return null;
  }
  if (!client) {
    try {
      client = new PostHog(KEY, {
        host: HOST,
        personProfiles: 'never',
        disableGeoip: true,
        enableSessionReplay: false,
        captureAppLifecycleEvents: true,
        flushAt: 20,
      });
    } catch {
      client = null;
    }
  }
  return client;
}

type EventName = AnalyticsEvent['name'];
type PropsOf<N extends EventName> = Extract<AnalyticsEvent, { name: N }>['props'];

export function track<N extends EventName>(name: N, props: PropsOf<N>): void {
  if (__DEV__ && !SEND_IN_DEV) {
    console.log(`[analytics] ${name}`, props);
    return;
  }
  try {
    posthog()?.capture(name, props);
  } catch {
    // Analytics never breaks the app.
  }
}

/** Route changes from the root layout: `/log`, `/progress-lift`, … (no params, no ids). */
export function trackScreen(pathname: string): void {
  if (__DEV__ && !SEND_IN_DEV) {
    return;
  }
  try {
    posthog()?.screen(pathname);
  } catch {
    // Analytics never breaks the app.
  }
}
