/**
 * Who waits for the tour to end (onboarding: the insert, then the tour, then the paywall or the
 * editor). The tour calls `tourDone()` once the reward's finish is chosen and the device is home,
 * so the next moment never starts on top of it.
 */
let waiters: (() => void)[] = [];

/** Set by onboarding's hand-off while it runs the tour itself; a cold launch must not start a second one. */
let handoff = false;

export function whenTourDone(): Promise<void> {
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

export function tourDone(): void {
  const done = waiters;
  waiters = [];
  for (const resolve of done) resolve();
}

export function setTourHandoff(value: boolean): void {
  handoff = value;
}

export function tourHandoffPending(): boolean {
  return handoff;
}
