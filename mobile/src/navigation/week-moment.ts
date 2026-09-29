import { useSyncExternalStore } from 'react';

/**
 * The week moment after Done (trim-ui §13 Home week details): Done queues the workout it
 * showed as it closes, and Home plays the week's celebration for it once, then clears it.
 * In memory only: a relaunch never replays a moment.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function queueWeekMoment(workoutId: string) {
  pending = workoutId;
  emit();
}

/** Home has played it (or it no longer applies). */
export function clearWeekMoment() {
  if (pending != null) {
    pending = null;
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The workout whose week moment is waiting to play on Home, or null. */
export function usePendingWeekMoment(): string | null {
  return useSyncExternalStore(subscribe, () => pending, () => null);
}
