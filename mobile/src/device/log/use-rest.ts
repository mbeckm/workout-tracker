import { useEffect, useRef, useState } from 'react';

import { formatClock } from './log-model';
import { useLogSession } from './log-session-context';
import { REST_NUDGE_SECONDS, restFraction, restSecondsLeft } from './log-state';

/** Two wheel notches move rest by 15 s (PLAN Phase 4). */
const NOTCHES_PER_NUDGE = 2;
const TICK_MS = 250;

/**
 * The rest view's clock. Rest itself lives in the log session (started by `completeSet` with
 * `restSecondsForExercise`, persisted with the session, GO and its haptic at 0:00 per D6);
 * this hook only ticks for the component that shows it, so the rest of the device doesn't
 * re-render every second.
 */
export function useRest() {
  const { rest, restGo, adjustRest, skipRest } = useLogSession();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const notches = useRef(0);

  useEffect(() => {
    if (!rest) {
      return;
    }
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [rest]);

  const secondsLeft = restSecondsLeft(rest, nowMs);
  return {
    /** Resting (counting or showing GO). */
    active: rest != null,
    /** 0:00 reached: show GO; the log view returns on its own after REST_GO_MS. */
    go: restGo,
    secondsLeft,
    /** `1:30`. */
    clock: formatClock(secondsLeft),
    /** Length of this rest, for the ring. */
    totalSeconds: rest ? Math.round((rest.endsAtMs - rest.startedAtMs) / 1000) : 0,
    /** Identifies this rest window (a new set's rest starts a new one). */
    startedAtMs: rest?.startedAtMs ?? 0,
    /** 1 → 0 as rest runs out (the ring). */
    fraction: restFraction(rest, nowMs),
    /** ±15 keys. Shortened to or below 0 rest ends; it never runs over 10 minutes. */
    adjust: (seconds: number) => {
      notches.current = 0;
      adjustRest(seconds);
    },
    /** One wheel notch; every second notch in the same direction moves rest by 15 s. */
    notch: (direction: 1 | -1) => {
      notches.current = Math.sign(notches.current) === direction ? notches.current + direction : direction;
      if (Math.abs(notches.current) >= NOTCHES_PER_NUDGE) {
        notches.current = 0;
        adjustRest(direction * REST_NUDGE_SECONDS);
        return true;
      }
      return false;
    },
    /** The big key (Skip). */
    skip: skipRest,
  };
}
