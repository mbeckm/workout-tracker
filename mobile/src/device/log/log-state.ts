/**
 * The open log's transitions (PLAN §4.2, §4.3): pure functions over `LogState`, ported from
 * the old `screens/log-workout.tsx` (tag `archive/pre-gadget`), so the device logs exactly as it did.
 * No React, no `react-native`: checked with `npx tsx scripts/check-log-logic.ts`.
 *
 * What the device adds on top of the old screen (PLAN Phase 4):
 * - Undo last set works across lifts (it returns to the lift and set it undoes) and hands
 *   back a token that re-logs the set (the toast's Undo). No confirm dialog.
 * - A finished lift shows a pending `EXTRA SET`; Log appends it as `extra: true`.
 * - Finish mode (`finishing`) is entered by the workout's last set or End workout.
 * - Lifts can be added to (plan and session) or removed from today's session (Undo-able).
 * - Swaps and reorders are today-only; the receipt asks whether the plan keeps them
 *   (`sessionSwaps`, `sessionOrder`).
 */
import { clonePrescription, emptyLoggedSet, usesWeight } from '@/domain/helpers';
import {
  buildDrafts,
  carryForward,
  exerciseIsComplete,
  liveRest,
  loggedSetCount,
  nextIncompleteIndex,
  prefillTargets,
  unloggedSetCount,
  type DraftExercise,
  type DraftSet,
  type OpenedLog,
  type RestWindow,
  type WellValues,
} from '@/domain/log-session';
import type { ExercisePrescription, LoggedSet } from '@/domain/types';

export type SetValues = WellValues;

/** A logged set loaded onto the display (D21). Applied only on Save. */
export type SetEdit = {
  exerciseId: string;
  setId: string;
  values: SetValues;
};

/** Values for the next extra set on a finished lift (shown as `EXTRA SET`). */
export type ExtraDraft = {
  exerciseId: string;
  values: SetValues;
};

export type LoggedRef = { exerciseId: string; setId: string };

export type LogState = {
  drafts: DraftExercise[];
  exerciseIndex: number;
  rest: RestWindow | null;
  /** Rest ran out or was skipped: the Live Activity reads `Go` until the next rest starts. */
  restOver: boolean;
  edit: SetEdit | null;
  extra: ExtraDraft | null;
  /** The set whose first Log tap pointed at the empty weight instead of logging. */
  weightNudgeSetId: string | null;
  /** Finish mode: the workout's last set was logged, or End workout. */
  finishing: boolean;
  /** Sets in the order they were logged (newest last), for Undo last set. In memory only. */
  logOrder: LoggedRef[];
};

/** Rest adjustments never push the end further out than this from now. */
export const REST_MAX_SECONDS = 600;
export const REST_NUDGE_SECONDS = 15;

export function initialLogState(opened: Pick<OpenedLog, 'drafts' | 'exerciseIndex' | 'rest'>): LogState {
  return {
    drafts: opened.drafts,
    exerciseIndex: opened.exerciseIndex,
    rest: opened.rest,
    restOver: false,
    edit: null,
    extra: null,
    weightNudgeSetId: null,
    finishing: false,
    logOrder: [],
  };
}

export function setValues(set: Pick<LoggedSet, 'weight' | 'reps' | 'counterweight' | 'durationSeconds'>): SetValues {
  return {
    weight: set.weight ?? null,
    reps: set.reps ?? null,
    counterweight: set.counterweight ?? null,
    durationSeconds: set.durationSeconds ?? null,
  };
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item == null) {
    return items;
  }
  const clamped = Math.max(0, Math.min(next.length, to));
  next.splice(clamped, 0, item);
  return next;
}

/** Up to three swaps for `exercise`: same target muscle (or equipment), unique names. */
export function alternativesFor(
  exercise: ExercisePrescription,
  pool: ExercisePrescription[],
): ExercisePrescription[] {
  const muscle = exercise.targetMuscles[0]?.toLowerCase();
  const name = exercise.name.toLowerCase();
  const matches = pool.filter((item) => {
    if (item.name.toLowerCase() === name) {
      return false;
    }
    if (!muscle) {
      return item.equipments[0] === exercise.equipments[0];
    }
    return (
      item.targetMuscles.some((entry) => entry.toLowerCase() === muscle) ||
      item.bodyParts.some((entry) => entry.toLowerCase() === muscle)
    );
  });
  const unique: ExercisePrescription[] = [];
  for (const item of matches) {
    if (unique.some((entry) => entry.name.toLowerCase() === item.name.toLowerCase())) {
      continue;
    }
    unique.push(item);
    if (unique.length === 3) {
      break;
    }
  }
  return unique;
}

// ---------------------------------------------------------------------------
// What the display is on

export type StageKind = 'set' | 'extra' | 'edit';

export type Stage = {
  current: DraftExercise;
  kind: StageKind;
  /** 0-based index of the set on the display (the next extra set's would-be index for `extra`). */
  setIndex: number;
  /** The values the drum and keys show and change. */
  values: SetValues;
  /** The undone set Log will complete (`set`), or the logged set being edited (`edit`). */
  set: DraftSet | null;
};

export function stageOf(state: LogState): Stage | null {
  const current = state.drafts[state.exerciseIndex];
  if (!current) {
    return null;
  }
  const id = current.prescription.id;
  if (state.edit && state.edit.exerciseId === id) {
    const index = current.sets.findIndex((set) => set.id === state.edit?.setId && set.done);
    const set = current.sets[index];
    if (set) {
      return { current, kind: 'edit', setIndex: index, values: state.edit.values, set };
    }
  }
  const activeIndex = current.sets.findIndex((set) => !set.done);
  const active = current.sets[activeIndex];
  if (active) {
    return { current, kind: 'set', setIndex: activeIndex, values: setValues(active), set: active };
  }
  const lastDone = [...current.sets].reverse().find((set) => set.done);
  const values =
    state.extra?.exerciseId === id
      ? state.extra.values
      : lastDone
        ? setValues(lastDone)
        : { weight: null, reps: null, counterweight: null, durationSeconds: null };
  return { current, kind: 'extra', setIndex: current.sets.length, values, set: null };
}

/** `log` / `rest` / `finish` for the device (PLAN §4.2). */
export function logModeOf(state: Pick<LogState, 'finishing' | 'rest'>): 'log' | 'rest' | 'finish' {
  if (state.finishing) {
    return 'finish';
  }
  return state.rest ? 'rest' : 'log';
}

// ---------------------------------------------------------------------------
// Moving between lifts

/** Every lift change drops a pending edit, extra values and weight nudge: they belong to one set. */
export function selectExercise(state: LogState, index: number): LogState {
  if (state.drafts.length === 0) {
    return state;
  }
  const next = Math.max(0, Math.min(state.drafts.length - 1, Math.trunc(index)));
  return { ...state, exerciseIndex: next, edit: null, extra: null, weightNudgeSetId: null, finishing: false };
}

/**
 * The lift a Live Activity or deep link points at. One that left the session falls back to
 * the first lift with work left (PLAN §7); with none, the display stays where it is.
 */
export function focusExercise(state: LogState, exerciseId: string): LogState {
  const index = state.drafts.findIndex((item) => item.prescription.id === exerciseId);
  if (index >= 0) {
    return index === state.exerciseIndex ? state : selectExercise(state, index);
  }
  const first = nextIncompleteIndex(state.drafts, -1, { wrap: false });
  return first >= 0 && first !== state.exerciseIndex ? selectExercise(state, first) : state;
}

/** Finish mode's Back: this lift or the next with work left, else the last lift (where Log adds an extra set). */
export function leaveFinish(state: LogState): LogState {
  if (state.drafts.length === 0) {
    return { ...state, finishing: false };
  }
  const open = exerciseIsComplete(state.drafts[state.exerciseIndex])
    ? nextIncompleteIndex(state.drafts, state.exerciseIndex)
    : state.exerciseIndex;
  return selectExercise(state, open >= 0 ? open : state.drafts.length - 1);
}

/** The menu's End workout: finish mode with work left. Rest stops (finish mode has no clock). */
export function endWorkout(state: LogState): LogState {
  return { ...state, finishing: true, rest: null, restOver: state.rest != null || state.restOver, edit: null };
}

// ---------------------------------------------------------------------------
// Values on the display

/** The wheel and keys write to: the set being edited, else the active set, else the next extra set. */
export function patchStage(state: LogState, patch: Partial<SetValues>): LogState {
  const stage = stageOf(state);
  if (!stage) {
    return state;
  }
  if (stage.kind === 'edit' && state.edit) {
    return { ...state, edit: { ...state.edit, values: { ...state.edit.values, ...patch } } };
  }
  if (stage.kind === 'set' && stage.set) {
    const setId = stage.set.id;
    return {
      ...state,
      drafts: state.drafts.map((exercise, index) =>
        index !== state.exerciseIndex
          ? exercise
          : { ...exercise, sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) },
      ),
    };
  }
  return {
    ...state,
    extra: { exerciseId: stage.current.prescription.id, values: { ...stage.values, ...patch } },
  };
}

/** Writes `patch` into one set of the current lift (by position), as the old `updateSet`. */
export function updateSet(state: LogState, setIndex: number, patch: Partial<LoggedSet>): LogState {
  return {
    ...state,
    drafts: state.drafts.map((exercise, index) =>
      index !== state.exerciseIndex
        ? exercise
        : { ...exercise, sets: exercise.sets.map((set, inner) => (inner === setIndex ? { ...set, ...patch } : set)) },
    ),
  };
}

// ---------------------------------------------------------------------------
// Editing a logged set (D21): Save writes it and starts no rest.

export function beginEdit(state: LogState, exerciseId: string, setId: string): LogState {
  const index = state.drafts.findIndex((item) => item.prescription.id === exerciseId);
  const set = state.drafts[index]?.sets.find((item) => item.id === setId && item.done);
  if (index < 0 || !set) {
    return state;
  }
  const selected = index === state.exerciseIndex ? { ...state, finishing: false } : selectExercise(state, index);
  return { ...selected, weightNudgeSetId: null, extra: null, edit: { exerciseId, setId, values: setValues(set) } };
}

export function cancelEdit(state: LogState): LogState {
  return state.edit ? { ...state, edit: null } : state;
}

export function commitEdit(state: LogState): LogState {
  const edit = state.edit;
  if (!edit) {
    return state;
  }
  return {
    ...state,
    edit: null,
    drafts: state.drafts.map((exercise) =>
      exercise.prescription.id !== edit.exerciseId
        ? exercise
        : { ...exercise, sets: exercise.sets.map((set) => (set.id === edit.setId ? { ...set, ...edit.values } : set)) },
    ),
  };
}

// ---------------------------------------------------------------------------
// Log

export type CompleteContext = {
  nowMs: number;
  /** Rest for the lift just logged (`restSecondsForExercise`). */
  restSeconds: (prescription: ExercisePrescription) => number;
  /** Targets for carry-forward when they're shown (Pro or unlocked), else null. */
  targets: ((exercise: DraftExercise) => readonly (SetValues | null)[] | null) | null;
};

export type CompleteResult =
  | { kind: 'none' }
  /** First weighted set with no weight: focus the drum (flash the frame), nothing logged. */
  | { kind: 'needsWeight'; setId: string }
  /** Edit mode: the logged set was saved (no rest). */
  | { kind: 'saved' }
  | {
      kind: 'logged';
      exerciseId: string;
      setId: string;
      /** 1-based position in the lift, for `track('set_logged')`. */
      setNumber: number;
      extra: boolean;
      /** The workout's last set: no rest, finish mode. */
      workoutDone: boolean;
      /** The lift is done and the log moved on to this lift (its index), else null (decision 87). */
      advancedTo: number | null;
    };

/**
 * The big key in log mode (`completeSet`). Keeps every rule from the old screen: the weight
 * nudge, carry-forward (targets keep their own reps), rest from `restSecondsForExercise` and
 * none after the workout's last set, then auto-advance to the next lift with work left
 * (forward only, `wrap: false`).
 */
export function completeSet(state: LogState, context: CompleteContext): { state: LogState; result: CompleteResult } {
  const stage = stageOf(state);
  if (!stage) {
    return { state, result: { kind: 'none' } };
  }
  if (stage.kind === 'edit') {
    return { state: commitEdit(state), result: { kind: 'saved' } };
  }
  const { current } = stage;
  const exerciseId = current.prescription.id;
  let drafts: DraftExercise[];
  let setId: string;
  let setNumber: number;
  let extra = false;

  if (stage.kind === 'set' && stage.set) {
    const target = stage.set;
    const noLoad = target.weight == null && target.counterweight == null;
    const loggedWeightlessBefore = current.sets.some(
      (set) => set.done && set.weight == null && set.counterweight == null,
    );
    // First tap on a weighted lift with an empty weight: point at the drum once.
    if (
      usesWeight(current.prescription.trackingMode) &&
      noLoad &&
      !loggedWeightlessBefore &&
      state.weightNudgeSetId !== target.id
    ) {
      return { state: { ...state, weightNudgeSetId: target.id }, result: { kind: 'needsWeight', setId: target.id } };
    }
    // Later sets inherit this one; with targets, each keeps its own target (a chosen load carries).
    const targets = context.targets ? context.targets(current) : null;
    drafts = state.drafts.map((exercise, index) =>
      index !== state.exerciseIndex
        ? exercise
        : { ...exercise, sets: carryForward(exercise.sets, stage.setIndex, target, targets) },
    );
    setId = target.id;
    setNumber = stage.setIndex + 1;
    extra = target.extra === true;
  } else {
    // A finished lift: Log adds an extra set with the values on the display.
    const lastDone = [...current.sets].reverse().find((set) => set.done);
    const added: DraftSet = {
      ...emptyLoggedSet(current.sets.length + 1, lastDone),
      ...stage.values,
      done: true,
      extra: true,
    };
    drafts = state.drafts.map((exercise, index) =>
      index !== state.exerciseIndex ? exercise : { ...exercise, sets: [...exercise.sets, added] },
    );
    setId = added.id;
    setNumber = current.sets.length + 1;
    extra = true;
  }

  const workoutDone = unloggedSetCount(drafts) === 0;
  let next: LogState = {
    ...state,
    drafts,
    edit: null,
    extra: null,
    weightNudgeSetId: null,
    logOrder: [...state.logOrder, { exerciseId, setId }],
    // No rest after the last set of the whole workout.
    rest: workoutDone
      ? null
      : { startedAtMs: context.nowMs, endsAtMs: context.nowMs + context.restSeconds(current.prescription) * 1000 },
    restOver: workoutDone ? state.restOver : false,
    finishing: workoutDone,
  };
  let advancedTo: number | null = null;
  if (!workoutDone && exerciseIsComplete(drafts[state.exerciseIndex])) {
    const advanceTo = nextIncompleteIndex(drafts, state.exerciseIndex, { wrap: false });
    if (advanceTo >= 0) {
      next = { ...next, exerciseIndex: advanceTo };
      advancedTo = advanceTo;
    }
  }
  return { state: next, result: { kind: 'logged', exerciseId, setId, setNumber, extra, workoutDone, advancedTo } };
}

// ---------------------------------------------------------------------------
// Undo last set, and its Undo (re-log)

export type UndoneSet = {
  exerciseId: string;
  exerciseName: string;
  /** The set as it was logged (values, id, extra flag). */
  set: DraftSet;
  /** 0-based position of the set in its lift. */
  setIndex: number;
  /** For the toast: "<Lift> set n undone". */
  setNumber: number;
  /** What re-log puts back. */
  before: Pick<LogState, 'exerciseIndex' | 'rest' | 'restOver' | 'finishing'> & { exerciseId: string | null };
};

/** The most recently logged set: the log order first, else (after a restore) the last done set nearest the display. */
export function lastLoggedSet(state: LogState): LoggedRef | null {
  for (let index = state.logOrder.length - 1; index >= 0; index -= 1) {
    const ref = state.logOrder[index];
    const exercise = state.drafts.find((item) => item.prescription.id === ref?.exerciseId);
    if (ref && exercise?.sets.some((set) => set.id === ref.setId && set.done)) {
      return ref;
    }
  }
  const count = state.drafts.length;
  for (let step = 0; step < count; step += 1) {
    const exercise = state.drafts[(state.exerciseIndex - step + count) % count];
    const set = exercise ? [...exercise.sets].reverse().find((item) => item.done) : undefined;
    if (exercise && set) {
      return { exerciseId: exercise.prescription.id, setId: set.id };
    }
  }
  return null;
}

export function canUndo(state: LogState): boolean {
  return loggedSetCount(state.drafts) > 0;
}

/**
 * Undo last set (`removeLoggedSet`): the set goes back to not logged (an extra set is taken
 * out), the display returns to its lift and set, rest stops and finish mode ends.
 */
export function removeLoggedSet(state: LogState, ref: LoggedRef | null = lastLoggedSet(state)): {
  state: LogState;
  undone: UndoneSet | null;
} {
  if (!ref) {
    return { state, undone: null };
  }
  const exerciseIndex = state.drafts.findIndex((item) => item.prescription.id === ref.exerciseId);
  const exercise = state.drafts[exerciseIndex];
  const setIndex = exercise ? exercise.sets.findIndex((set) => set.id === ref.setId && set.done) : -1;
  const set = exercise?.sets[setIndex];
  if (!exercise || !set) {
    return { state, undone: null };
  }
  const drafts = state.drafts.map((item, index) =>
    index !== exerciseIndex
      ? item
      : {
          ...item,
          sets: set.extra
            ? item.sets.filter((entry) => entry.id !== set.id)
            : item.sets.map((entry) => (entry.id === set.id ? { ...entry, done: false } : entry)),
        },
  );
  const undone: UndoneSet = {
    exerciseId: exercise.prescription.id,
    exerciseName: exercise.prescription.name,
    set,
    setIndex,
    setNumber: setIndex + 1,
    before: {
      exerciseIndex: state.exerciseIndex,
      exerciseId: state.drafts[state.exerciseIndex]?.prescription.id ?? null,
      rest: state.rest,
      restOver: state.restOver,
      finishing: state.finishing,
    },
  };
  const selected = selectExercise({ ...state, drafts }, exerciseIndex);
  return {
    state: {
      ...selected,
      rest: null,
      finishing: false,
      logOrder: state.logOrder.filter((item) => item.setId !== set.id),
    },
    undone,
  };
}

/** The toast's Undo: logs the set again with its values and puts the display, rest and finish mode back. */
export function relogSet(state: LogState, undone: UndoneSet, nowMs: number): LogState {
  const exerciseIndex = state.drafts.findIndex((item) => item.prescription.id === undone.exerciseId);
  const exercise = state.drafts[exerciseIndex];
  if (!exercise) {
    return state;
  }
  const values = setValues(undone.set);
  const present = exercise.sets.some((set) => set.id === undone.set.id);
  const sets = present
    ? exercise.sets.map((set) => (set.id === undone.set.id ? { ...set, ...values, done: true } : set))
    : [
        ...exercise.sets.slice(0, undone.setIndex),
        { ...undone.set, done: true },
        ...exercise.sets.slice(undone.setIndex),
      ];
  const drafts = state.drafts.map((item, index) => (index === exerciseIndex ? { ...item, sets } : item));
  const backTo = undone.before.exerciseId
    ? drafts.findIndex((item) => item.prescription.id === undone.before.exerciseId)
    : -1;
  const selected = selectExercise({ ...state, drafts }, backTo >= 0 ? backTo : exerciseIndex);
  return {
    ...selected,
    rest: liveRest(undone.before.rest, nowMs),
    restOver: undone.before.restOver,
    finishing: undone.before.finishing && unloggedSetCount(drafts) === 0,
    logOrder: [...state.logOrder, { exerciseId: undone.exerciseId, setId: undone.set.id }],
  };
}

// ---------------------------------------------------------------------------
// Rest

export function startRest(state: LogState, seconds: number, nowMs: number): LogState {
  return { ...state, rest: { startedAtMs: nowMs, endsAtMs: nowMs + seconds * 1000 }, restOver: false };
}

/**
 * ±15 (keys, or two wheel notches). Adjusted to or below 0 it ends; it never runs more than
 * `REST_MAX_SECONDS` from now.
 */
export function adjustRestWindow(rest: RestWindow | null, seconds: number, nowMs: number): RestWindow | null {
  if (!rest) {
    return rest;
  }
  const endsAtMs = Math.min(rest.endsAtMs + seconds * 1000, nowMs + REST_MAX_SECONDS * 1000);
  return endsAtMs <= nowMs ? null : { ...rest, endsAtMs };
}

export function adjustRest(state: LogState, seconds: number, nowMs: number): LogState {
  if (!state.rest) {
    return state;
  }
  const rest = adjustRestWindow(state.rest, seconds, nowMs);
  return { ...state, rest, restOver: rest == null ? true : state.restOver };
}

/** Skip, or the GO moment ended: back to the log view for the same upcoming set (D6). */
export function endRest(state: LogState): LogState {
  return state.rest ? { ...state, rest: null, restOver: true } : state;
}

export type RestPhase = 'running' | 'go' | 'over';

/**
 * Where a rest window is at `nowMs`: counting, showing GO (for `goMs` after 0:00), or over.
 * A window that ended more than `goMs` ago (the app was killed or backgrounded) is over, so
 * it never shows a stale GO.
 */
export function restPhase(rest: RestWindow | null, nowMs: number, goMs: number): RestPhase {
  if (!rest || nowMs >= rest.endsAtMs + goMs) {
    return 'over';
  }
  return nowMs >= rest.endsAtMs ? 'go' : 'running';
}

export function restSecondsLeft(rest: RestWindow | null, nowMs: number): number {
  return rest ? Math.max(0, Math.ceil((rest.endsAtMs - nowMs) / 1000)) : 0;
}

/** 1 → 0 as the rest runs out (the ring). */
export function restFraction(rest: RestWindow | null, nowMs: number): number {
  if (!rest) {
    return 0;
  }
  const total = rest.endsAtMs - rest.startedAtMs;
  return total <= 0 ? 0 : Math.max(0, Math.min(1, (rest.endsAtMs - nowMs) / total));
}

// ---------------------------------------------------------------------------
// The day's lifts (Today, M3)

/** Drag in Today: the new order, keeping the display on the same lift. Today only (`sessionOrder`). */
export function reorderDrafts(state: LogState, from: number, to: number): LogState {
  const currentId = state.drafts[state.exerciseIndex]?.prescription.id;
  const drafts = moveItem(state.drafts, from, to);
  const index = currentId ? drafts.findIndex((item) => item.prescription.id === currentId) : -1;
  return { ...state, drafts, exerciseIndex: index >= 0 ? index : state.exerciseIndex };
}

/**
 * A drag in Today is today only, like a swap: the plan's slots (prescription ids) in this
 * session's order when it differs from the plan's, for the receipt's Keep in plan; null when it
 * doesn't, so dragging back asks nothing. Only lifts in both count: orphans, and lifts removed
 * today or from the plan since, don't.
 */
export function sessionOrder(
  drafts: readonly DraftExercise[],
  planExercises: readonly ExercisePrescription[],
): string[] | null {
  const inPlan = new Set(planExercises.map((item) => item.id));
  const session = drafts
    .filter((item) => !item.orphan && inPlan.has(item.prescription.id))
    .map((item) => item.prescription.id);
  const inSession = new Set(session);
  const plan = planExercises.filter((item) => inSession.has(item.id)).map((item) => item.id);
  return session.some((slotId, index) => slotId !== plan[index]) ? session : null;
}

/** Keep in plan for an order: the slots in `order` take it in the places they hold; every other lift stays put. */
export function withSessionOrder(
  exercises: readonly ExercisePrescription[],
  order: readonly string[],
): ExercisePrescription[] {
  const byId = new Map(exercises.map((item) => [item.id, item]));
  const queue = order.filter((slotId) => byId.has(slotId));
  const moving = new Set(queue);
  let next = 0;
  return exercises.map((item) => (moving.has(item.id) ? (byId.get(queue[next++] ?? '') ?? item) : item));
}

/** `next` in place of `targetId`'s lift: same id, slot, sets and reps. */
export function swappedPrescription(target: ExercisePrescription, next: ExercisePrescription): ExercisePrescription {
  return {
    ...clonePrescription(next),
    id: target.id,
    sets: target.sets,
    reps: target.reps,
    repScheme: target.repScheme ?? null,
  };
}

/**
 * Swap (the exercise sheet's Swap for, or Today): today only, the plan keeps its lift
 * (`swappedFrom`) until the receipt's Keep in plan. Sets already logged stay with the lift they
 * were done on, as an orphan just before the slot; the new lift takes the sets still to do
 * (re-prefilled, with targets when they're shown). Returns null when the lift is gone.
 */
export function swapInDrafts(
  state: LogState,
  targetId: string,
  swapped: ExercisePrescription,
  context: {
    previousSetsForExercise: (name: string) => LoggedSet[];
    targetsFor: ((exercise: DraftExercise) => readonly (SetValues | null)[] | null) | null;
    newId: () => string;
  },
): LogState | null {
  const index = state.drafts.findIndex((item) => item.prescription.id === targetId);
  const target = state.drafts[index];
  if (!target) {
    return null;
  }
  const original = target.swappedFrom ?? target.prescription;
  const backToPlan = sameLift(original, swapped);
  const done = target.sets.filter((set) => set.done);
  const toDo = target.sets.filter((set) => !set.done && !set.extra).length;
  const fresh = buildDrafts([swapped], context.previousSetsForExercise)[0]?.sets ?? [];
  const slot: DraftExercise = {
    prescription: swapped,
    sets: done.length > 0 && toDo > 0 ? fresh.slice(0, toDo) : fresh,
    ...(backToPlan ? {} : { swappedFrom: original }),
  };
  const kept: DraftExercise[] =
    done.length > 0
      ? [{ prescription: { ...target.prescription, id: context.newId() }, sets: done, orphan: true }]
      : [];
  let drafts = [...state.drafts.slice(0, index), ...kept, slot, ...state.drafts.slice(index + 1)];
  if (context.targetsFor) {
    drafts = prefillTargets(drafts, context.targetsFor, context.previousSetsForExercise);
  }
  const currentId = state.drafts[state.exerciseIndex]?.prescription.id;
  const current = currentId ? drafts.findIndex((item) => item.prescription.id === currentId) : -1;
  return {
    ...state,
    edit: null,
    extra: null,
    drafts,
    exerciseIndex: current >= 0 ? current : state.exerciseIndex,
  };
}

function sameLift(left: ExercisePrescription, right: ExercisePrescription): boolean {
  return left.name.trim().toLowerCase() === right.name.trim().toLowerCase();
}

/** A swap made today, for the receipt's Keep in plan. */
export type SessionSwap = {
  /** The plan slot (the prescription id). */
  slotId: string;
  from: ExercisePrescription;
  to: ExercisePrescription;
};

/** Today's swaps that left logged sets on the new lift (one skipped entirely asks nothing). */
export function sessionSwaps(drafts: readonly DraftExercise[]): SessionSwap[] {
  return drafts.flatMap((item) =>
    item.swappedFrom && !item.orphan && item.sets.some((set) => set.done)
      ? [{ slotId: item.prescription.id, from: item.swappedFrom, to: item.prescription }]
      : [],
  );
}

/** Add lift: the new lift goes after the plan's lifts (before any orphans). Returns its index. */
export function addDraft(state: LogState, draft: DraftExercise): { state: LogState; index: number } {
  const orphanAt = state.drafts.findIndex((item) => item.orphan);
  const index = orphanAt >= 0 ? orphanAt : state.drafts.length;
  const drafts = [...state.drafts.slice(0, index), draft, ...state.drafts.slice(index)];
  const currentId = state.drafts[state.exerciseIndex]?.prescription.id;
  const current = currentId ? drafts.findIndex((item) => item.prescription.id === currentId) : -1;
  return {
    state: { ...state, drafts, exerciseIndex: current >= 0 ? current : state.exerciseIndex, finishing: false },
    index,
  };
}

export type RemovedLift = {
  draft: DraftExercise;
  index: number;
  /** The lift on the display before the removal. */
  currentId: string | null;
  finishing: boolean;
};

/**
 * Remove (today only): the lift leaves the session's drafts; the plan is untouched. A lift with
 * logged sets stays as an orphan holding only those sets. Removing the lift on the display moves
 * to the next lift with work left; with none, to finish mode.
 */
export function removeDraft(state: LogState, exerciseId: string): { state: LogState; removed: RemovedLift | null } {
  const index = state.drafts.findIndex((item) => item.prescription.id === exerciseId);
  const draft = state.drafts[index];
  if (!draft) {
    return { state, removed: null };
  }
  const done = draft.sets.filter((set) => set.done);
  const drafts =
    done.length > 0
      ? state.drafts.map((item, inner) => (inner === index ? { ...item, sets: done, orphan: true } : item))
      : state.drafts.filter((_, inner) => inner !== index);
  const currentId = state.drafts[state.exerciseIndex]?.prescription.id ?? null;
  const removed: RemovedLift = { draft, index, currentId, finishing: state.finishing };
  const base: LogState = {
    ...state,
    drafts,
    logOrder: done.length > 0 ? state.logOrder : state.logOrder.filter((item) => item.exerciseId !== exerciseId),
  };
  if (currentId !== exerciseId) {
    const kept = drafts.findIndex((item) => item.prescription.id === currentId);
    return { state: { ...base, exerciseIndex: kept >= 0 ? kept : 0 }, removed };
  }
  const from = done.length > 0 ? index : index - 1;
  const nextOpen = drafts.length > 0 ? nextIncompleteIndex(drafts, from) : -1;
  if (nextOpen >= 0) {
    return { state: selectExercise(base, nextOpen), removed };
  }
  const settled = selectExercise(base, Math.min(index, drafts.length - 1));
  return { state: { ...settled, exerciseIndex: drafts.length === 0 ? 0 : settled.exerciseIndex, finishing: true, rest: null }, removed };
}

/** The Undo toast after Remove: the lift comes back where it was, with its sets. */
export function restoreDraft(state: LogState, removed: RemovedLift): LogState {
  const id = removed.draft.prescription.id;
  const without = state.drafts.filter((item) => item.prescription.id !== id);
  const at = Math.max(0, Math.min(without.length, removed.index));
  const drafts = [...without.slice(0, at), removed.draft, ...without.slice(at)];
  const backTo = removed.currentId ? drafts.findIndex((item) => item.prescription.id === removed.currentId) : -1;
  const selected = selectExercise({ ...state, drafts }, backTo >= 0 ? backTo : at);
  return { ...selected, finishing: removed.finishing && unloggedSetCount(drafts) === 0 };
}
