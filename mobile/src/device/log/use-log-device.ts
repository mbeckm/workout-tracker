import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { showToast } from '@/components/toast';
import { useDevice } from '@/device/device-context';
import { useHaptics } from '@/device/haptics';
import { openReceiptAfterFinish } from '@/device/moment/moment-host';
import type { DrumNudge, NotchResult } from '@/device/parts';
import { durationIsMinutes } from '@/domain/helpers';
import { DEVICE, LINEAR_FN } from '@/motion';

import { drumStep, spokenSetLabel, spokenShortSet, spokenValue, type DrumKind } from './log-model';
import { useLogSession } from './log-session-context';
import type { SetValues } from './log-state';
import { useRest } from './use-rest';

/** What the display shows: rest gives way to the log view while a logged set is edited (D21). */
export type LogView = 'log' | 'rest' | 'finish';

/** A wheel landmark gets the stronger notch (SPEC §8): whole 10 kg, every 5 reps, 30 s, 5 min. */
function landmark(kind: DrumKind, values: SetValues): boolean {
  switch (kind) {
    case 'weight':
      return values.weight != null && values.weight > 0 && values.weight % 10 === 0;
    case 'assist':
      return values.counterweight != null && values.counterweight > 0 && values.counterweight % 10 === 0;
    case 'reps':
      return values.reps != null && values.reps % 5 === 0;
    case 'seconds':
      return values.durationSeconds != null && values.durationSeconds % 30 === 0;
    case 'minutes':
      return values.durationSeconds != null && (values.durationSeconds / 60) % 5 === 0;
  }
}

const WHEEL_NAMES: Record<DrumKind, string> = {
  weight: 'Weight',
  assist: 'Assistance',
  reps: 'Reps',
  seconds: 'Time',
  minutes: 'Time',
};

function spokenClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

/** A tall key held down: a step every DEVICE.REPEAT once the long press lands, each with a tick. */
function useRepeat() {
  const haptics = useHaptics();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback(
    (step: () => boolean) => {
      stop();
      const tick = () => {
        if (!step()) {
          timer.current = null;
          return;
        }
        haptics.wheelNotch();
        timer.current = setTimeout(tick, DEVICE.REPEAT);
      };
      tick();
    },
    [haptics, stop],
  );
  useEffect(() => stop, [stop]);
  return { start, stop };
}

/**
 * Hold to finish (SPEC §7, §8): the ring fills linearly over 1.1 s with the continuous haptic
 * ramp; releasing early cancels and snaps it back. When it closes: the finish haptic, then
 * `onComplete` after the prototype's short beat.
 */
function useHoldToFinish(onComplete: () => void) {
  const haptics = useHaptics();
  const progress = useSharedValue(0);
  const completed = useRef(false);
  const commit = useRef<ReturnType<typeof setTimeout> | null>(null);

  const full = useCallback(() => {
    completed.current = true;
    haptics.stopHoldFinish();
    haptics.finishComplete();
    commit.current = setTimeout(() => {
      commit.current = null;
      completed.current = false;
      progress.set(0);
      onComplete();
    }, DEVICE.HOLD_COMMIT);
  }, [haptics, onComplete, progress]);

  useEffect(
    () => () => {
      if (commit.current) clearTimeout(commit.current);
      haptics.stopHoldFinish();
    },
    [haptics],
  );

  const pressIn = useCallback(() => {
    // The ring closed; the workout is finishing.
    if (commit.current) return;
    completed.current = false;
    haptics.startHoldFinish();
    progress.set(0);
    progress.set(
      withTiming(1, { duration: DEVICE.HOLD, easing: LINEAR_FN }, (finished) => {
        if (finished) scheduleOnRN(full);
      }),
    );
  }, [full, haptics, progress]);

  const pressOut = useCallback(() => {
    if (completed.current || commit.current) return;
    haptics.stopHoldFinish();
    progress.set(0);
  }, [haptics, progress]);

  return { progress, pressIn, pressOut };
}

/**
 * What the device's keys, wheel and display do while a day is open (PLAN Phase 4): the drum's
 * step animation and focus flash, the wheel per mode, long-press repeat on the tall keys, the
 * big key (Log / Save, Skip, hold to Finish, Discard), Undo with its toast, and the display's
 * VoiceOver summary and actions.
 */
export function useLogDevice() {
  const log = useLogSession();
  const rest = useRest();
  const haptics = useHaptics();
  const { openSheet } = useDevice();
  const repeat = useRepeat();

  const [nudge, setNudge] = useState<DrumNudge | null>(null);
  const [flash, setFlash] = useState(0);
  const nudgeId = useRef(0);

  // The hand-off (decision 87): a set that finishes a lift names the next one for NEXT_HOLD.
  const [handoff, setHandoff] = useState<number | null>(null);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endHandoff = useCallback(() => {
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    handoffTimer.current = null;
    setHandoff(null);
  }, []);
  useEffect(() => endHandoff, [endHandoff]);

  // Wheel notches can outrun renders: the next notch steps from the values the last one made.
  const latest = useRef({ values: log.stage?.values ?? null, kind: log.controls?.drum ?? null, increment: log.increment });
  useEffect(() => {
    latest.current = { values: log.stage?.values ?? null, kind: log.controls?.drum ?? null, increment: log.increment };
  });

  const editing = log.stage?.kind === 'edit';
  const view: LogView | null =
    log.mode === 'rest' && editing ? 'log' : log.mode;

  const onDrumNotch = useCallback(
    (direction: 1 | -1): NotchResult => {
      const { values, kind, increment } = latest.current;
      if (!values || !kind) return false;
      const patch = drumStep(kind, values, direction, increment);
      if (Object.keys(patch).length === 0) return false;
      const next = { ...values, ...patch };
      latest.current = { ...latest.current, values: next };
      log.stepDrum(direction);
      nudgeId.current += 1;
      setNudge({ direction, id: nudgeId.current });
      return landmark(kind, next) ? 'major' : true;
    },
    [log],
  );

  const onRestNotch = useCallback(
    (direction: 1 | -1): NotchResult => (rest.notch(direction) ? 'major' : true),
    [rest],
  );

  const onWheelNotch = view === 'rest' ? onRestNotch : onDrumNotch;

  const keys = {
    /** `+` / `−` reps (or the mode's key value); a long press repeats. */
    step: (direction: 1 | -1) => {
      log.stepKeys(direction);
    },
    repeat: (direction: 1 | -1) => repeat.start(() => log.stepKeys(direction)),
    /** `+15` / `−15`; a long press repeats too. */
    nudgeRest: (direction: 1 | -1) => rest.adjust(direction * 15),
    repeatRest: (direction: 1 | -1) =>
      repeat.start(() => {
        rest.adjust(direction * 15);
        return true;
      }),
    stopRepeat: repeat.stop,
  };

  const onLog = useCallback(() => {
    const result = log.completeSet();
    if (result.kind === 'needsWeight') {
      // Nothing logged: the drum's frame blinks with a light tap, so the press still reads.
      haptics.key();
      setFlash((value) => value + 1);
    } else if (result.kind === 'logged' || result.kind === 'saved') {
      haptics.logSet();
    }
    if (result.kind === 'logged' && result.advancedTo != null) {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      setHandoff(result.advancedTo);
      handoffTimer.current = setTimeout(() => {
        handoffTimer.current = null;
        setHandoff(null);
      }, DEVICE.NEXT_HOLD);
    }
  }, [haptics, log]);

  const onUndo = useCallback(() => {
    // While a logged set is edited, ↶ puts it back as it was.
    if (log.stage?.kind === 'edit') {
      log.cancelEdit();
      return;
    }
    const undone = log.undoLastSet();
    if (undone) {
      showToast({
        title: `${undone.exerciseName} set ${undone.setNumber} undone`,
        onUndo: () => log.relog(undone),
      });
    }
  }, [log]);

  /**
   * The workout is saved and the log closed: its receipt prints over Home. When it closes,
   * MomentHost plays the Home stamp (`justFinished`), the week moment and the post-workout
   * paywall, one at a time (Phase 5).
   */
  const finishWorkout = useCallback(() => {
    const workoutId = log.finish();
    if (workoutId) {
      openReceiptAfterFinish(workoutId);
    }
  }, [log]);

  const hold = useHoldToFinish(finishWorkout);

  const currentId = log.current?.prescription.id;
  const openExercise = useCallback(() => {
    if (currentId) openSheet('exercise', { exerciseId: currentId });
  }, [currentId, openSheet]);

  const openKeypad = useCallback(() => {
    haptics.displayTap();
    openSheet('keypad');
  }, [haptics, openSheet]);

  /** A tap on the drum: the lift's next wheel step (`±2` → `±1` → `±0.5`). */
  const cycleLoadStep = useCallback(() => {
    if (log.cycleLoadStep()) haptics.displayTap();
  }, [haptics, log]);

  // --- VoiceOver: one summary per mode, the display's tappable words as actions ---------------
  const minutes = log.current ? durationIsMinutes(log.current.prescription) : false;
  let summary: string | undefined;
  const actions: AccessibilityActionInfo[] = [];
  if (view === 'log') {
    summary = log.summary ?? undefined;
    actions.push({ name: 'exercise', label: 'Exercise info' }, { name: 'keypad', label: 'Type a value' });
    if (log.loadStep) actions.push({ name: 'step', label: `Change step, now ${log.loadStep.text.slice(1)} ${log.units}` });
    if (log.footer?.targetLocked) actions.push({ name: 'targets', label: 'Show targets' });
  } else if (view === 'rest' && log.current) {
    // Decision 96: the rest, then the set it leads to ("then set 2 of 3"), as the display's `SET 2 IN`.
    const next = log.stage ? spokenShortSet(log.stage.values, minutes) : null;
    const up = log.stage ? spokenSetLabel(log.stage) : null;
    summary = [
      rest.go ? 'Rest over' : `Rest, ${spokenClock(rest.secondsLeft)} left`,
      up ? (rest.go ? `${up} now` : `then ${up}`) : null,
      next ? `${log.current.prescription.name}, ${next}` : log.current.prescription.name,
    ]
      .filter(Boolean)
      .join(', ');
    actions.push({ name: 'exercise', label: 'Exercise info' });
  } else if (view === 'finish' && log.finishSummary) {
    const { headline, logged, planned, nothingLogged, volumeText } = log.finishSummary;
    summary = [
      headline === 'ALL DONE' ? 'All done' : 'End early?',
      nothingLogged ? 'nothing logged' : `${logged} of ${planned} sets`,
      volumeText ? volumeText.toLowerCase() : null,
    ]
      .filter(Boolean)
      .join(', ');
  }
  // --- The wheel: its engraved label and spoken value per mode -------------------------------
  const drumKind = log.controls?.drum ?? null;
  const wheel =
    view === 'rest'
      ? { label: 'REST', accessibilityLabel: 'Rest time', accessibilityValue: spokenClock(rest.secondsLeft) }
      : {
          // trim-ui: the wheel reads `LB`, the display's units read `LBS`.
          label: log.drum ? (log.drum.label === 'LBS' ? 'LB' : log.drum.label) : '',
          accessibilityLabel: drumKind ? WHEEL_NAMES[drumKind] : 'Weight',
          accessibilityValue:
            drumKind && log.stage ? spokenValue(drumKind, log.stage.values, log.units) : undefined,
        };

  const onDisplayAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    if (name === 'exercise') openExercise();
    if (name === 'keypad') openKeypad();
    if (name === 'step') cycleLoadStep();
    if (name === 'targets') void log.unlockTargets();
  };

  return {
    log,
    rest,
    view,
    editing,
    nudge,
    flash,
    onWheelNotch,
    keys,
    onLog,
    onUndo,
    hold,
    finishWorkout,
    openExercise,
    openKeypad,
    cycleLoadStep,
    wheel,
    display: { summary, actions, onAction: onDisplayAction },
    /** The lift the hand-off names while it shows; gone once the log is elsewhere (Undo, the rocker). */
    handoff: handoff != null && handoff === log.exerciseIndex ? log.drafts[handoff] ?? null : null,
    endHandoff,
  };
}
