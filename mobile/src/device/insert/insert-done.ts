/**
 * Who waits for the insert to end (onboarding's "Plan ready", D12, then its paywall or editor):
 * `useInsert` calls `insertDone()` from its one exit (played out, skipped, Reduce Motion or
 * back from the background), so the next moment never starts on top of it.
 */
let waiters: (() => void)[] = [];

export function whenInsertDone(): Promise<void> {
  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

export function insertDone(): void {
  const done = waiters;
  waiters = [];
  for (const resolve of done) resolve();
}
