/**
 * Plain TS checks for the device's logging logic (PLAN Phase 4, §6.6, §7 Logging), run with
 * `npx tsx scripts/check-log-logic.ts`. No test runner: each `check` throws on a mismatch and
 * the script exits 1.
 *
 * Covers the session transitions (`device/log/log-state.ts`: complete, auto-advance with
 * `wrap: false`, no rest after the last set, undo after auto-advance and its re-log, extra
 * sets, the first-set weight rule, edit, remove / add lifts, rest) and the display model
 * (`device/log/log-model.ts`: D19, every tracking mode's drum and step, reps clamp, footer,
 * lamps, finish summary, VoiceOver).
 */
import {
  REPS_MAX,
  compactSet,
  controlsFor,
  displaySummary,
  drumStep,
  drumView,
  finishSummary,
  formatDrumLoad,
  formatDrumValue,
  keyStep,
  keysFace,
  lampLayout,
  lampText,
  liftLamps,
  logFooter,
  setLabel,
  setLampLayout,
  setLamps,
  spokenValue,
  stepLoad,
  stepMinutes,
  stepReps,
  stepSeconds,
} from '@/device/log/log-model';
import {
  REST_MAX_SECONDS,
  addDraft,
  adjustRest,
  adjustRestWindow,
  beginEdit,
  completeSet,
  endWorkout,
  focusExercise,
  initialLogState,
  leaveFinish,
  logModeOf,
  patchStage,
  relogSet,
  removeDraft,
  removeLoggedSet,
  reorderDrafts,
  restPhase,
  restoreDraft,
  sessionOrder,
  sessionSwaps,
  stageOf,
  swapInDrafts,
  swappedPrescription,
  withSessionOrder,
  type CompleteContext,
  type LogState,
} from '@/device/log/log-state';
import { buildDrafts, restoreDrafts, unloggedSetCount, type DraftExercise } from '@/domain/log-session';
import {
  defaultLoadStep,
  loadStepCycle,
  loadStepFor,
  loadStepText,
  nextLoadStep,
  normalizeLoadSteps,
  withLoadStep,
} from '@/domain/load-step';
import { loadIncrement } from '@/domain/targets';
import type { ExercisePrescription, LoggedSet } from '@/domain/types';

/** No @types/node here (tsc checks this file with the app's types), so a tiny assert. */
function show(value: unknown): string {
  return JSON.stringify(value);
}
const assert = {
  equal(actual: unknown, expected: unknown) {
    if (!Object.is(actual, expected)) {
      throw new Error(`expected ${show(expected)}, got ${show(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown) {
    if (show(actual) !== show(expected)) {
      throw new Error(`expected ${show(expected)}\n got      ${show(actual)}`);
    }
  },
  ok(value: unknown) {
    if (!value) throw new Error(`expected a truthy value, got ${show(value)}`);
  },
};

let failures = 0;
let passed = 0;

function check(name: string, run: () => void) {
  try {
    run();
    passed += 1;
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message.split('\n').join('\n  ') : String(error)}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Fixtures

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;

function lift(name: string, sets = 2, reps = 8, extra: Partial<ExercisePrescription> = {}): ExercisePrescription {
  return {
    id: id('ex'),
    name,
    sets,
    reps,
    bodyParts: ['chest'],
    targetMuscles: ['pectorals'],
    secondaryMuscles: [],
    equipments: ['barbell'],
    imageURLs: {},
    itemType: 'strength',
    trackingMode: 'weightAndReps',
    ...extra,
  };
}

const NOW = 1_000_000;
const ctx: CompleteContext = { nowMs: NOW, restSeconds: () => 90, targets: null };

/** Drafts with `weight` prefilled (as if from history) so the weight rule stays out of the way. */
function stateFor(lifts: ExercisePrescription[], weight: number | null = 80): LogState {
  const history = (): LoggedSet[] =>
    weight == null ? [] : [{ id: 'h', index: 1, weight, reps: 8, counterweight: null, durationSeconds: null }];
  return initialLogState({ drafts: buildDrafts(lifts, history), exerciseIndex: 0, rest: null });
}

function log(state: LogState, context: CompleteContext = ctx): LogState {
  return completeSet(state, context).state;
}

function logTimes(state: LogState, times: number): LogState {
  let next = state;
  for (let index = 0; index < times; index += 1) {
    next = log(next);
  }
  return next;
}

function doneCount(draft: DraftExercise | undefined): number {
  return draft ? draft.sets.filter((set) => set.done).length : -1;
}

// ---------------------------------------------------------------------------------------------
// Complete, carry-forward, auto-advance, rest

check('complete: logs the active set, carries it forward and starts rest', () => {
  let state = stateFor([lift('Bench press'), lift('Row')]);
  state = patchStage(state, { weight: 85, reps: 6 });
  const { state: next, result } = completeSet(state, ctx);
  assert.equal(result.kind, 'logged');
  assert.equal(next.exerciseIndex, 0);
  assert.equal(doneCount(next.drafts[0]), 1);
  // The next set inherits what was logged.
  assert.deepEqual([next.drafts[0]?.sets[1]?.weight, next.drafts[0]?.sets[1]?.reps], [85, 6]);
  assert.deepEqual(next.rest, { startedAtMs: NOW, endsAtMs: NOW + 90_000 });
  assert.equal(logModeOf(next), 'rest');
});

check('auto-advance: a finished lift moves to the next lift with work left', () => {
  const state = logTimes(stateFor([lift('Bench press'), lift('Row')]), 2);
  assert.equal(state.exerciseIndex, 1);
  assert.equal(stageOf(state)?.setIndex, 0);
});

check('the hand-off: only the set that finishes a lift reports the lift it moved to', () => {
  const start = stateFor([lift('Bench press'), lift('Row')]);
  const first = completeSet(start, ctx);
  assert.equal(first.result.kind === 'logged' && first.result.advancedTo, null);
  const second = completeSet(first.state, ctx);
  assert.equal(second.result.kind === 'logged' && second.result.advancedTo, 1);
});

check('auto-advance is forward only (wrap: false)', () => {
  let state = stateFor([lift('Bench press'), lift('Row'), lift('Squat')]);
  state = { ...state, exerciseIndex: 2 };
  state = logTimes(state, 2);
  // Squat done, Bench and Row still open: stays on Squat (no wrap back to Bench).
  assert.equal(state.exerciseIndex, 2);
  assert.equal(stageOf(state)?.kind, 'extra');
  assert.ok(state.rest != null);
  assert.equal(state.finishing, false);
});

check('no rest after the workout\'s last set; finish mode', () => {
  const { state, result } = completeSet(logTimes(stateFor([lift('Bench press'), lift('Row')]), 3), ctx);
  assert.equal(result.kind === 'logged' && result.workoutDone, true);
  assert.equal(state.rest, null);
  assert.equal(state.finishing, true);
  assert.equal(logModeOf(state), 'finish');
  assert.equal(unloggedSetCount(state.drafts), 0);
});

check('undo after auto-advance returns to the previous lift and set', () => {
  const advanced = logTimes(stateFor([lift('Bench press'), lift('Row')]), 2);
  assert.equal(advanced.exerciseIndex, 1);
  const { state, undone } = removeLoggedSet(advanced);
  assert.equal(state.exerciseIndex, 0);
  assert.equal(stageOf(state)?.setIndex, 1);
  assert.equal(stageOf(state)?.kind, 'set');
  assert.equal(state.rest, null);
  assert.equal(undone?.setNumber, 2);
  assert.equal(undone?.exerciseName, 'Bench press');
});

check('undo walks back through the log order, then re-log puts everything back', () => {
  const advanced = logTimes(stateFor([lift('Bench press'), lift('Row')]), 3);
  const first = removeLoggedSet(advanced);
  assert.equal(first.undone?.exerciseName, 'Row');
  const second = removeLoggedSet(first.state);
  assert.equal(second.undone?.exerciseName, 'Bench press');
  assert.equal(second.state.exerciseIndex, 0);
  const relogged = relogSet(second.state, second.undone!, NOW + 1_000);
  assert.equal(doneCount(relogged.drafts[0]), 2);
  assert.equal(relogged.exerciseIndex, 1);
  // The rest that was running before the undo is back while it's still live.
  assert.deepEqual(relogged.rest, first.state.rest == null ? null : first.state.rest);
});

check('undo with nothing logged does nothing', () => {
  const state = stateFor([lift('Bench press')]);
  assert.equal(removeLoggedSet(state).undone, null);
});

check('undo during finish mode leaves finish mode', () => {
  const done = logTimes(stateFor([lift('Bench press')]), 2);
  assert.equal(done.finishing, true);
  const { state } = removeLoggedSet(done);
  assert.equal(state.finishing, false);
  assert.equal(logModeOf(state), 'log');
});

// ---------------------------------------------------------------------------------------------
// Extra sets

check('extra set: a finished lift logs `extra: true` and labels EXTRA SET', () => {
  let state = logTimes(stateFor([lift('Bench press')]), 2);
  state = leaveFinish(state);
  const stage = stageOf(state);
  assert.equal(stage?.kind, 'extra');
  assert.equal(setLabel(stage!), 'EXTRA SET');
  state = patchStage(state, { reps: 5 });
  const { state: next, result } = completeSet(state, ctx);
  assert.equal(result.kind === 'logged' && result.extra, true);
  const sets = next.drafts[0]?.sets ?? [];
  assert.equal(sets.length, 3);
  assert.deepEqual([sets[2]?.extra, sets[2]?.done, sets[2]?.weight, sets[2]?.reps], [true, true, 80, 5]);
  // Still all done: back to finish, no rest.
  assert.equal(next.finishing, true);
  assert.equal(next.rest, null);
  const summary = finishSummary(next.drafts, 'kg');
  assert.equal(summary.setsText, '3 OF 2 SETS');
  // Undoing an extra set takes it out.
  assert.equal(removeLoggedSet(next).state.drafts[0]?.sets.length, 2);
});

check('set label: SET n/m counts prescribed sets; EDIT SET n while editing', () => {
  const state = stateFor([lift('Bench press', 3)]);
  assert.equal(setLabel(stageOf(state)!), 'SET 1/3');
  const logged = log(state);
  const setId = logged.drafts[0]?.sets[0]?.id ?? '';
  const editing = beginEdit(logged, logged.drafts[0]?.prescription.id ?? '', setId);
  assert.equal(setLabel(stageOf(editing)!), 'EDIT SET 1');
});

// ---------------------------------------------------------------------------------------------
// First weighted set without a weight

check('first weighted set without weight: needsWeight, nothing logged', () => {
  const state = stateFor([lift('Bench press')], null);
  const { state: next, result } = completeSet(state, ctx);
  assert.equal(result.kind, 'needsWeight');
  assert.equal(doneCount(next.drafts[0]), 0);
  assert.equal(next.rest, null);
  // The second tap logs without weight.
  const again = completeSet(next, ctx);
  assert.equal(again.result.kind, 'logged');
  assert.equal(again.state.drafts[0]?.sets[0]?.weight, null);
});

check('weight 0 is allowed after the nudge (bar only)', () => {
  const nudged = completeSet(stateFor([lift('Bench press')], null), ctx).state;
  const zero = patchStage(nudged, { weight: 0 });
  const { state, result } = completeSet(zero, ctx);
  assert.equal(result.kind, 'logged');
  assert.equal(state.drafts[0]?.sets[0]?.weight, 0);
  assert.equal(formatDrumLoad(0), '0.0');
});

check('no nudge for bodyweight lifts or after a weightless set', () => {
  const bodyweight = stateFor([lift('Push-up', 2, 12, { trackingMode: 'reps', equipments: ['body weight'] })], null);
  assert.equal(completeSet(bodyweight, ctx).result.kind, 'logged');
  const nudged = completeSet(stateFor([lift('Bench press', 3)], null), ctx).state;
  const second = log(log(nudged));
  assert.equal(doneCount(second.drafts[0]), 2);
});

// ---------------------------------------------------------------------------------------------
// Edit (D21)

check('edit: Save writes the set and starts no rest', () => {
  const logged = log(stateFor([lift('Bench press', 3)]));
  const restless = { ...logged, rest: null };
  const exerciseId = logged.drafts[0]?.prescription.id ?? '';
  const setId = logged.drafts[0]?.sets[0]?.id ?? '';
  const edited = patchStage(beginEdit(restless, exerciseId, setId), { weight: 90 });
  const { state, result } = completeSet(edited, ctx);
  assert.equal(result.kind, 'saved');
  assert.equal(state.drafts[0]?.sets[0]?.weight, 90);
  assert.equal(state.rest, null);
  assert.equal(state.edit, null);
});

// ---------------------------------------------------------------------------------------------
// Lifts in today's session

check('remove the current lift: next lift with work; last one left → finish', () => {
  const state = stateFor([lift('Bench press'), lift('Row')]);
  const benchId = state.drafts[0]?.prescription.id ?? '';
  const { state: removed, removed: token } = removeDraft(state, benchId);
  assert.equal(removed.drafts.length, 1);
  assert.equal(removed.drafts[0]?.prescription.name, 'Row');
  assert.equal(removed.exerciseIndex, 0);
  const restored = restoreDraft(removed, token!);
  assert.equal(restored.drafts[0]?.prescription.name, 'Bench press');
  assert.equal(restored.exerciseIndex, 0);
  const rowId = state.drafts[1]?.prescription.id ?? '';
  const last = removeDraft(removed, rowId).state;
  assert.equal(last.drafts.length, 0);
  assert.equal(last.finishing, true);
});

check('remove a lift with logged sets: it stays as an orphan with only those sets', () => {
  const state = log(stateFor([lift('Bench press', 3), lift('Row')]));
  const { state: next } = removeDraft(state, state.drafts[0]?.prescription.id ?? '');
  assert.equal(next.drafts[0]?.orphan, true);
  assert.equal(next.drafts[0]?.sets.length, 1);
  assert.equal(next.exerciseIndex, 1);
});

check('add lift goes before orphans; reorder keeps the display on its lift', () => {
  const state = stateFor([lift('Bench press'), lift('Row')]);
  const orphaned: LogState = {
    ...state,
    drafts: [...state.drafts, { ...state.drafts[0]!, prescription: lift('Old'), orphan: true }],
  };
  const added = addDraft(orphaned, buildDrafts([lift('Curl')], () => [])[0]!);
  assert.equal(added.index, 2);
  assert.equal(added.state.drafts[3]?.prescription.name, 'Old');
  const reordered = reorderDrafts({ ...state, exerciseIndex: 1 }, 1, 0);
  assert.equal(reordered.drafts[0]?.prescription.name, 'Row');
  assert.equal(reordered.exerciseIndex, 0);
});

const swapContext = { previousSetsForExercise: () => [], targetsFor: null, newId: () => id('kept') };

function swapTo(state: LogState, index: number, name: string): LogState {
  const target = state.drafts[index]!.prescription;
  return swapInDrafts(state, target.id, swappedPrescription(target, lift(name)), swapContext)!;
}

check('swap before any set: the slot takes the new lift and remembers the plan\'s', () => {
  const state = stateFor([lift('Lateral raises', 3), lift('Row')]);
  const swapped = swapTo(state, 0, 'Cable lateral raise');
  assert.equal(swapped.drafts.length, 2);
  assert.equal(swapped.drafts[0]?.prescription.name, 'Cable lateral raise');
  assert.equal(swapped.drafts[0]?.prescription.id, state.drafts[0]?.prescription.id);
  assert.equal(swapped.drafts[0]?.swappedFrom?.name, 'Lateral raises');
  assert.equal(swapped.drafts[0]?.sets.length, 3);
  // A swap isn't a new order.
  assert.equal(sessionOrder(swapped.drafts, state.drafts.map((item) => item.prescription)), null);
  // Nothing logged on the new lift: the receipt asks nothing.
  assert.equal(sessionSwaps(swapped.drafts).length, 0);
});

check('swap mid-lift: logged sets stay with their lift, the new one takes the sets to do', () => {
  const state = log(stateFor([lift('Lateral raises', 3), lift('Row')]));
  const swapped = swapTo(state, 0, 'Cable lateral raise');
  assert.equal(swapped.drafts.length, 3);
  assert.equal(swapped.drafts[0]?.prescription.name, 'Lateral raises');
  assert.equal(swapped.drafts[0]?.orphan, true);
  assert.equal(swapped.drafts[0]?.sets.length, 1);
  assert.equal(swapped.drafts[1]?.prescription.name, 'Cable lateral raise');
  assert.equal(swapped.drafts[1]?.sets.length, 2);
  assert.equal(swapped.exerciseIndex, 1);
  // The new lift has no history here, so it needs a weight before Log takes the set.
  const done = log(patchStage(swapped, { weight: 10 }));
  const swaps = sessionSwaps(done.drafts);
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]?.from.name, 'Lateral raises');
  assert.equal(swaps[0]?.to.name, 'Cable lateral raise');
});

check('swapping back to the plan\'s lift forgets the swap', () => {
  const state = stateFor([lift('Lateral raises', 3)]);
  const twice = swapTo(swapTo(state, 0, 'Cable lateral raise'), 0, 'Lateral raises');
  assert.equal(twice.drafts[0]?.swappedFrom, undefined);
});

check('a saved session restores a swap against the plan\'s lift', () => {
  const plan = [lift('Lateral raises', 3), lift('Row')];
  const swapped = log(patchStage(swapTo(stateFor(plan), 0, 'Cable lateral raise'), { weight: 10 }));
  const restored = restoreDrafts({ drafts: swapped.drafts }, { id: 'd', title: 'Push 1', exercises: plan } as never, () => []);
  assert.equal(restored[0]?.prescription.name, 'Cable lateral raise');
  assert.equal(restored[0]?.sets.filter((set) => set.done).length, 1);
  assert.equal(restored[0]?.swappedFrom?.name, 'Lateral raises');
});

check('reorder is today only: the plan keeps its order until Keep in plan (D92)', () => {
  const plan = [lift('Bench press'), lift('Row'), lift('Squat')];
  const frozen = show(plan);
  const reordered = reorderDrafts(stateFor(plan), 2, 0);
  assert.deepEqual(reordered.drafts.map((item) => item.prescription.name), ['Squat', 'Bench press', 'Row']);
  // Reordering never touches the plan; the receipt gets the new order to ask about.
  assert.equal(show(plan), frozen);
  const order = sessionOrder(reordered.drafts, plan);
  assert.deepEqual(order, [plan[2]!.id, plan[0]!.id, plan[1]!.id]);
  // Keep in plan writes it.
  assert.deepEqual(withSessionOrder(plan, order!).map((item) => item.name), ['Squat', 'Bench press', 'Row']);
});

check('dragging back to the plan\'s order asks nothing', () => {
  const plan = [lift('Bench press'), lift('Row'), lift('Squat')];
  const back = reorderDrafts(reorderDrafts(stateFor(plan), 0, 2), 2, 0);
  assert.equal(sessionOrder(back.drafts, plan), null);
  assert.equal(sessionOrder(stateFor(plan).drafts, plan), null);
});

check('session order ignores orphans and lifts removed today; Keep in plan leaves other lifts in place', () => {
  const plan = [lift('Bench press', 3), lift('Row'), lift('Squat'), lift('Curl')];
  const state = log(stateFor(plan));
  // Bench gets a set, then leaves today (an orphan); Curl leaves with nothing logged.
  const removed = removeDraft(removeDraft(state, plan[0]!.id).state, plan[3]!.id).state;
  assert.equal(sessionOrder(removed.drafts, plan), null);
  const reordered = reorderDrafts(removed, 2, 1);
  const order = sessionOrder(reordered.drafts, plan);
  assert.deepEqual(order, [plan[2]!.id, plan[1]!.id]);
  // Bench and Curl keep their places; Row and Squat swap theirs.
  assert.deepEqual(withSessionOrder(plan, order!).map((item) => item.name), ['Bench press', 'Squat', 'Row', 'Curl']);
});

check('a saved session restores its own order, not the plan\'s', () => {
  const plan = [lift('Bench press'), lift('Row'), lift('Squat')];
  const reordered = reorderDrafts(stateFor(plan), 2, 0);
  const restored = restoreDrafts({ drafts: reordered.drafts }, { id: 'd', title: 'Push 1', exercises: plan } as never, () => []);
  assert.deepEqual(restored.map((item) => item.prescription.name), ['Squat', 'Bench press', 'Row']);
  // A lift new in the plan since keeps its plan place.
  const grown = [...plan, lift('Curl')];
  const again = restoreDrafts({ drafts: reordered.drafts }, { id: 'd', title: 'Push 1', exercises: grown } as never, () => []);
  assert.deepEqual(again.map((item) => item.prescription.name), ['Squat', 'Bench press', 'Row', 'Curl']);
});

check('Live Activity focus on a removed lift falls back to the first lift with work', () => {
  const state = { ...log(log(stateFor([lift('Bench press'), lift('Row'), lift('Squat')]))), exerciseIndex: 2 };
  assert.equal(focusExercise(state, 'gone').exerciseIndex, 1);
  assert.equal(focusExercise(state, state.drafts[0]?.prescription.id ?? '').exerciseIndex, 0);
});

check('End workout enters finish mode; Back goes to the next lift with work', () => {
  const state = log(stateFor([lift('Bench press'), lift('Row')]));
  const ended = endWorkout(state);
  assert.equal(logModeOf(ended), 'finish');
  assert.equal(ended.rest, null);
  const back = leaveFinish(ended);
  assert.equal(logModeOf(back), 'log');
  assert.equal(back.exerciseIndex, 0);
});

// ---------------------------------------------------------------------------------------------
// Rest

check('rest ±15, capped at 10 minutes, ends when adjusted below 0', () => {
  const rest = { startedAtMs: NOW, endsAtMs: NOW + 30_000 };
  assert.equal(adjustRestWindow(rest, 15, NOW)?.endsAtMs, NOW + 45_000);
  assert.equal(adjustRestWindow(rest, -15, NOW)?.endsAtMs, NOW + 15_000);
  assert.equal(adjustRestWindow(rest, 900, NOW)?.endsAtMs, NOW + REST_MAX_SECONDS * 1000);
  assert.equal(adjustRestWindow(rest, -30, NOW), null);
  assert.equal(adjustRestWindow(rest, -45, NOW), null);
  const state = adjustRest({ ...stateFor([lift('Bench press')]), rest }, -45, NOW);
  assert.equal(state.rest, null);
  assert.equal(state.restOver, true);
});

check('rest phase: GO for 2 s at 0:00; a window long past (after a kill) is just over', () => {
  const rest = { startedAtMs: NOW, endsAtMs: NOW + 60_000 };
  assert.equal(restPhase(rest, NOW + 59_000, 2000), 'running');
  assert.equal(restPhase(rest, NOW + 60_000, 2000), 'go');
  assert.equal(restPhase(rest, NOW + 61_999, 2000), 'go');
  assert.equal(restPhase(rest, NOW + 62_000, 2000), 'over');
  assert.equal(restPhase(rest, NOW + 600_000, 2000), 'over');
});

// ---------------------------------------------------------------------------------------------
// Display: drum and keys per tracking mode (§6.6, D19)

check('D19: null weight shows --.-; the first notch is nextLoadUp(0, increment)', () => {
  assert.equal(formatDrumLoad(null), '--.-');
  assert.equal(stepLoad(null, 1, 2.5), 2.5);
  assert.equal(stepLoad(null, -1, 2.5), null);
  const view = drumView('weight', { weight: null }, 2.5, 'kg');
  assert.deepEqual([view.text, view.up, view.down, view.label], ['--.-', '2.5', null, 'KG']);
});

check('weight drum steps on the load grid and never goes below 0', () => {
  const bench = lift('Bench press');
  assert.equal(loadIncrement(bench, 'kg'), 2.5);
  assert.equal(loadIncrement(bench, 'lbs'), 5);
  assert.deepEqual(drumStep('weight', { weight: 85 }, 1, 2.5), { weight: 87.5 });
  assert.deepEqual(drumStep('weight', { weight: 81 }, 1, 2.5), { weight: 82.5 });
  assert.deepEqual(drumStep('weight', { weight: 81 }, -1, 2.5), { weight: 80 });
  assert.deepEqual(drumStep('weight', { weight: 2.5 }, -1, 2.5), { weight: 0 });
  assert.deepEqual(drumStep('weight', { weight: 0 }, -1, 2.5), {});
  assert.equal(formatDrumLoad(81.25), '81.25');
  assert.equal(drumView('weight', { weight: 135 }, 5, 'lbs').label, 'LBS');
});

check('controls per tracking mode', () => {
  const modes = (extra: Partial<ExercisePrescription>) => controlsFor(lift('X', 2, 8, extra));
  assert.deepEqual(modes({}), { drum: 'weight', keys: 'reps' });
  assert.deepEqual(modes({ trackingMode: 'reps' }), { drum: 'reps', keys: 'reps' });
  assert.deepEqual(modes({ trackingMode: 'counterweightAndReps' }), { drum: 'assist', keys: 'reps' });
  assert.deepEqual(modes({ trackingMode: 'duration', itemType: 'stability' }), { drum: 'seconds', keys: 'seconds' });
  assert.deepEqual(modes({ trackingMode: 'duration', itemType: 'cardio' }), { drum: 'minutes', keys: 'minutes' });
  assert.deepEqual(modes({ trackingMode: 'repsAndDuration' }), { drum: 'seconds', keys: 'reps' });
  assert.deepEqual(modes({ trackingMode: 'distanceAndDuration', itemType: 'cardio' }), { drum: 'minutes', keys: 'minutes' });
  assert.deepEqual(modes({ trackingMode: 'weightAndDistance' }), { drum: 'weight', keys: null });
});

check('bodyweight: reps on the drum (×12), keys step reps too', () => {
  const view = drumView('reps', { reps: 12 }, 2.5, 'kg');
  assert.deepEqual([view.text, view.up, view.down, view.label], ['×12', '×13', '×11', 'REPS']);
  assert.deepEqual(keyStep('reps', { reps: 12 }, -1), { reps: 11 });
});

check('assisted: −20.0 under ASSIST; less assistance steps down to 0', () => {
  const view = drumView('assist', { counterweight: 20 }, 2.5, 'kg');
  assert.deepEqual([view.text, view.header, view.down], ['−20.0', 'ASSIST', '−17.5']);
  assert.deepEqual(drumStep('assist', { counterweight: 2.5 }, -1, 2.5), { counterweight: 0 });
  assert.equal(formatDrumValue('assist', { counterweight: 0 }), '0.0');
});

check('timed: seconds 5 s per notch as 0:45; minutes 1 per notch as 20 MIN', () => {
  assert.equal(formatDrumValue('seconds', { durationSeconds: 45 }), '0:45');
  assert.equal(stepSeconds(45, 1), 50);
  assert.equal(stepSeconds(5, -1), 5);
  assert.equal(stepSeconds(null, 1), 5);
  assert.equal(formatDrumValue('minutes', { durationSeconds: 1200 }), '20 MIN');
  assert.equal(stepMinutes(1200, 1), 1260);
  assert.equal(stepMinutes(60, -1), 60);
  assert.deepEqual(keyStep('seconds', { durationSeconds: 40 }, 1), { durationSeconds: 45 });
  assert.deepEqual(keyStep(null, { reps: 3 }, 1), {});
});

check('reps clamp 1–50 everywhere', () => {
  assert.equal(stepReps(REPS_MAX, 1), 50);
  assert.equal(stepReps(1, -1), 1);
  assert.equal(stepReps(null, 1), 1);
  assert.equal(stepReps(8, 1), 9);
  assert.deepEqual(drumStep('reps', { reps: 50 }, 1, 1), {});
});

// ---------------------------------------------------------------------------------------------
// Footer, lamps, finish, VoiceOver

check('footer: LAST always wins; free TARGET › only without history', () => {
  const previousSets: LoggedSet[] = [{ id: 'a', index: 1, weight: 80, reps: 8 }];
  const target = { weight: 87.5, reps: 8, counterweight: null, durationSeconds: null };
  const base = { previousSets, setIndex: 0, target, offerTargets: true };
  assert.equal(logFooter({ ...base, target: null, showTargets: false }).text, 'LAST 80×8');
  // The target is on the drum already; the footer keeps last time.
  const pro = logFooter({ ...base, showTargets: true });
  assert.deepEqual([pro.text, pro.target], ['LAST 80×8', 'TARGET 87.5×8']);
  const withHistory = logFooter({ ...base, showTargets: false });
  assert.deepEqual([withHistory.targetLocked, withHistory.text], [false, 'LAST 80×8']);
  const firstTime = logFooter({ ...base, previousSets: [], showTargets: false });
  assert.deepEqual([firstTime.targetLocked, firstTime.text], [true, 'TARGET ›']);
  assert.equal(logFooter({ ...base, previousSets: [], showTargets: false, offerTargets: false }).text, null);
  assert.equal(compactSet({ durationSeconds: 40 }), '0:40');
  assert.equal(compactSet({ durationSeconds: 1200 }, true), '20 MIN');
  assert.equal(compactSet({ reps: 12 }), '12');
});

check('lamps: done / on / part / off, compression past 12 and text past 16', () => {
  const state = log(stateFor([lift('A'), lift('B'), lift('C', 3)]));
  const advanced = { ...logTimes({ ...state, exerciseIndex: 2 }, 1), exerciseIndex: 1 };
  assert.deepEqual(liftLamps(advanced.drafts, 1), ['part', 'on', 'part']);
  const done = logTimes(stateFor([lift('A'), lift('B')]), 2);
  assert.deepEqual(liftLamps(done.drafts, done.exerciseIndex), ['done', 'on']);
  assert.equal(lampLayout(12), 'regular');
  assert.equal(lampLayout(13), 'compact');
  assert.equal(lampLayout(16), 'compact');
  assert.equal(lampLayout(17), 'text');
  assert.equal(lampText(['done', 'done', 'on', 'off']), '3/4');
  assert.equal(lampText(['done', 'done', 'off']), '2/3');
});

check('set lamps: done / on / off, extra sets add none, compression past 6', () => {
  const state = stateFor([lift('Bench press', 4)]);
  assert.deepEqual(setLamps(stageOf(state)!), ['on', 'off', 'off', 'off']);
  assert.deepEqual(setLamps(stageOf(log(state))!), ['done', 'on', 'off', 'off']);
  const extra = logTimes(state, 4);
  assert.equal(stageOf(extra)?.kind, 'extra');
  assert.deepEqual(setLamps(stageOf(extra)!), ['done', 'done', 'done', 'done']);
  assert.equal(setLampLayout(6), 'regular');
  assert.equal(setLampLayout(7), 'compact');
  assert.equal(setLampLayout(12), 'compact');
  assert.equal(setLampLayout(13), 'none');
});

check('keys face: reps as a number with REPS, times on their own', () => {
  assert.deepEqual(keysFace('reps', { reps: 6 }), { value: '6', unit: 'REPS' });
  assert.deepEqual(keysFace('reps', {}), { value: '--', unit: 'REPS' });
  assert.deepEqual(keysFace('seconds', { durationSeconds: 45 }), { value: '0:45', unit: null });
  assert.equal(keysFace(null, { reps: 6 }), null);
});

check('finish summary: n OF m SETS, volume, NOTHING LOGGED', () => {
  const none = finishSummary(stateFor([lift('Bench press')]).drafts, 'kg');
  assert.deepEqual([none.setsText, none.nothingLogged, none.headline, none.volumeText], [
    'NOTHING LOGGED',
    true,
    'END EARLY?',
    null,
  ]);
  const some = finishSummary(log(stateFor([lift('Bench press', 3)])).drafts, 'kg');
  assert.deepEqual([some.setsText, some.volumeText, some.headline, some.grid], [
    '1 OF 3 SETS',
    '640 KG',
    'END EARLY?',
    [true, false, false],
  ]);
  const all = finishSummary(logTimes(stateFor([lift('Bench press')]), 2).drafts, 'lbs');
  assert.deepEqual([all.headline, all.volumeText], ['ALL DONE', '1,280 LBS']);
});

check('VoiceOver: one summary line for the display', () => {
  let state = log(stateFor([lift('Bench press', 3)]));
  state = patchStage({ ...state, rest: null }, { weight: 85, reps: 8 });
  const stage = stageOf(state)!;
  const text = displaySummary({
    name: 'Bench press',
    stage,
    controls: { drum: 'weight', keys: 'reps' },
    units: 'kg',
    previousSets: [
      { id: 'a', index: 1, weight: 80, reps: 8 },
      { id: 'b', index: 2, weight: 80, reps: 8 },
    ],
  });
  assert.equal(text, 'Bench press, set 2 of 3, 85 kilograms, 8 reps, last time 80 by 8');
  assert.equal(spokenValue('weight', { weight: 1 }, 'lbs'), '1 pound');
  assert.equal(spokenValue('weight', { weight: null }, 'kg'), 'no weight');
});

check('Load step (80): dumbbells step 1 kg, a tap cycles finer, saved per lift and unit', () => {
  const bench = lift('Bench press');
  const press = lift('Dumbbell shoulder press', 3, 8, { equipments: ['dumbbell'] });
  assert.equal(defaultLoadStep(press, 'kg'), 1);
  assert.equal(loadIncrement(press, 'kg'), 2); // Pro targets still jump a real pair of dumbbells.
  assert.equal(defaultLoadStep(press, 'lbs'), 5);
  assert.equal(defaultLoadStep(bench, 'kg'), 2.5);
  assert.deepEqual(loadStepCycle(2.5, 'kg'), [2.5, 1, 0.5]);
  assert.deepEqual(loadStepCycle(1, 'kg'), [1, 0.5]);
  assert.deepEqual(loadStepCycle(5, 'lbs'), [5, 2.5, 1]);
  assert.equal(nextLoadStep(2.5, 2.5, 'kg'), 1);
  assert.equal(nextLoadStep(1, 2.5, 'kg'), 0.5);
  assert.equal(nextLoadStep(0.5, 2.5, 'kg'), 2.5);
  // Odd and decimal weights on the wheel: 1 kg reaches 23, 0.5 reaches 23.5.
  assert.equal(stepLoad(22, 1, 1), 23);
  assert.equal(stepLoad(23, 1, 0.5), 23.5);
  assert.equal(stepLoad(23.5, 1, 2.5), 25);

  let saved = withLoadStep({}, 'Bench press', 'kg', 0.5, 2.5);
  assert.deepEqual(saved, { 'bench press': { units: 'kg', step: 0.5 } });
  assert.equal(loadStepFor(lift('bench press '), 'kg', saved), 0.5);
  assert.equal(loadStepFor(bench, 'lbs', saved), 5); // Set in kg: lbs keeps its default.
  assert.equal(loadStepFor(lift('Squat'), 'kg', saved), 2.5);
  saved = withLoadStep(saved, 'Bench press', 'kg', 2.5, 2.5);
  assert.deepEqual(saved, {}); // Back on the default: nothing saved.
  assert.equal(loadStepFor(bench, 'kg', { 'bench press': { units: 'kg', step: 3 } }), 2.5);
  assert.deepEqual(normalizeLoadSteps({ a: { units: 'kg', step: 1 }, b: { units: 'st', step: 1 }, c: { units: 'kg', step: -1 }, d: null }), {
    a: { units: 'kg', step: 1 },
  });
  assert.deepEqual(normalizeLoadSteps(undefined), {});
  assert.equal(loadStepText(0.5), '±0.5');
});

if (failures > 0) {
  // An uncaught error exits non-zero.
  throw new Error(`check-log-logic: ${failures} failed, ${passed} passed`);
}
console.log(`check-log-logic: ${passed} passed`);
