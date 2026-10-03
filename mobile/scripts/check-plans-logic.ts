/**
 * Plain TS checks for Plans on the gadget (PLAN Phase 6), run with `tsx`. No test runner: each
 * `check` throws on a mismatch.
 *
 * Covers cartridge labels, the shelf's counts and order, days done this week (active plan only),
 * the editor's edits (rename, add / duplicate / move days, move lifts, add lifts with defaults),
 * leaving the editor (discard, auto-name per decision 71, filing) and the gates for `+` and
 * Use plan.
 */
import {
  activatedToast,
  addDay,
  addExercises,
  addLiftsTitle,
  cartLabel,
  chipPrescription,
  createPlanGate,
  duplicateDay,
  leaveDecision,
  moveDay,
  moveExercise,
  moveExerciseTo,
  planDisplayName,
  planSummary,
  rackModel,
  renameDay,
  renamePlan,
  planUseGate,
  withPrescriptionDefaults,
} from '@/device/plans-model';
import { bundledExerciseById } from '@/catalog/bundled';
import { clonePrescription, emptyDay, emptyPlan } from '@/domain/helpers';
import { startOfLocalWeek } from '@/domain/plan-loop';
import type { ExercisePrescription, LoggedWorkout, WorkoutPlan } from '@/domain/types';

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
};

let failures = 0;
function check(name: string, run: () => void) {
  try {
    run();
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${(error as Error).message}`);
  }
}

function lift(id: string, sets?: number, reps?: number): ExercisePrescription {
  const row = bundledExerciseById(id);
  if (!row) throw new Error(`missing bundled ${id}`);
  const copy = clonePrescription(row);
  return { ...copy, sets: sets ?? copy.sets, reps: reps ?? copy.reps };
}

function plan(name: string, days: [string, ExercisePrescription[]][]): WorkoutPlan {
  const p = emptyPlan(name);
  p.days = days.map(([title, exercises]) => ({ ...emptyDay(title), exercises }));
  p.daysPerWeek = p.days.length;
  return p;
}

const bench = lift('bundled-flat-barbell-bench-press', 3, 8);
const squat = lift('bundled-barbell-back-squat', 3, 6);
const row = lift('bundled-barbell-row', 3, 8);
const ppl = plan('Push Pull Legs', [
  ['Pull 1', [row]],
  ['Legs 1', [squat]],
  ['Push 1', [bench]],
  ['Legs 2', []],
]);
const ul = plan('Upper Lower', [
  ['Upper A', [bench, row]],
  ['Lower A', [squat]],
]);

check('cart labels: uppercase, no spaces, 6 characters', () => {
  assert.equal(cartLabel('Push 1'), 'PUSH1');
  assert.equal(cartLabel('Upper A'), 'UPPERA');
  assert.equal(cartLabel('Full body day'), 'FULLBO');
  assert.equal(cartLabel('  legs  '), 'LEGS');
});

check('shelf summary and plurals', () => {
  assert.equal(planSummary(ppl), '4 days, 3 lifts');
  assert.equal(planSummary(plan('One', [['Day 1', [bench]]])), '1 day, 1 lift');
});

check('chip prescription takes spaces around ×', () => {
  assert.equal(chipPrescription(bench), '3 × 8');
  const hold: ExercisePrescription = { ...bench, trackingMode: 'duration', itemType: 'stability', durationSeconds: 45, reps: 0 };
  assert.equal(chipPrescription(hold), '3 × 0:45');
  const cardio: ExercisePrescription = { ...bench, trackingMode: 'duration', itemType: 'cardio', durationSeconds: 1200 };
  assert.equal(chipPrescription(cardio), '20 MIN');
});

check('rack: active first, green only for this week on the active plan', () => {
  const now = new Date();
  const weekStart = startOfLocalWeek(now).getTime();
  const pullDay = ppl.days[0];
  const workout = {
    id: 'w1',
    planId: ppl.id,
    dayId: pullDay.id,
    title: pullDay.title,
    completedAt: new Date(Math.max(weekStart + 60_000, now.getTime() - 60_000)).toISOString(),
    startedAt: new Date(weekStart).toISOString(),
    durationMinutes: 40,
    exercises: [],
    setCount: 9,
  } as unknown as LoggedWorkout;
  const old = { ...workout, id: 'w0', completedAt: new Date(weekStart - 86_400_000).toISOString() } as LoggedWorkout;
  const shelves = rackModel({ plans: [ul, ppl], activePlanId: ppl.id, history: [workout, old], now });
  assert.deepEqual(shelves.map((s) => s.name), ['Push Pull Legs', 'Upper Lower']);
  assert.deepEqual(shelves[0].carts.map((c) => `${c.label}:${c.done}`), ['PULL1:true', 'LEGS1:false', 'PUSH1:false', 'LEGS2:false']);
  assert.deepEqual(shelves[1].carts.map((c) => c.done), [false, false]);
  assert.equal(shelves[0].accessibilityLabel, 'Push Pull Legs, active, 4 days, 3 lifts');
});

check('names: own, then from the days (decision 71), then New plan', () => {
  assert.equal(planDisplayName(ul), 'Upper Lower');
  assert.equal(planDisplayName(plan('', [['Push', []], ['Pull', []]])), 'Push and Pull');
  assert.equal(planDisplayName(plan('', [['Day 1', []]])), 'New plan');
  assert.equal(activatedToast(ul), 'Upper Lower is your plan');
});

check('rename: empty or unchanged keeps the old name', () => {
  assert.equal(renamePlan(ul, '  '), ul);
  assert.equal(renamePlan(ul, 'Upper Lower'), ul);
  assert.equal(renamePlan(ul, ' UL ').name, 'UL');
  const dayId = ul.days[0].id;
  assert.equal(renameDay(ul, dayId, ''), ul);
  assert.equal(renameDay(ul, dayId, 'Upper').days[0].title, 'Upper');
});

check('days: add, duplicate after, move, daysPerWeek follows', () => {
  const added = addDay(ul);
  assert.deepEqual(added.days.map((d) => d.title), ['Upper A', 'Lower A', 'Day 3']);
  assert.equal(added.daysPerWeek, 3);
  const dup = duplicateDay(ul, ul.days[0].id);
  assert.deepEqual(dup.days.map((d) => d.title), ['Upper A', 'Upper A copy', 'Lower A']);
  assert.equal(dup.days[1].exercises.length, 2);
  assert.equal(dup.days[1].exercises[0].id !== ul.days[0].exercises[0].id, true);
  assert.deepEqual(moveDay(ul, ul.days[1].id, -1).days.map((d) => d.title), ['Lower A', 'Upper A']);
  assert.equal(moveDay(ul, ul.days[0].id, -1), ul);
});

check('lifts: move up / down, drag to a place, out of range is a no-op', () => {
  const day = ul.days[0];
  assert.deepEqual(moveExercise(ul, day.id, row.id, -1).days[0].exercises.map((e) => e.id), [row.id, bench.id]);
  assert.equal(moveExercise(ul, day.id, bench.id, -1), ul);
  const three = plan('T', [['A', [bench, row, squat]]]);
  assert.deepEqual(moveExerciseTo(three, three.days[0].id, 0, 2).days[0].exercises.map((e) => e.id), [row.id, squat.id, bench.id]);
  assert.equal(moveExerciseTo(three, three.days[0].id, 1, 1), three);
  assert.equal(moveExerciseTo(three, three.days[0].id, 0, 5), three);
});

check('add lifts: appended as fresh copies, defaults 3 × 10 where the row has none', () => {
  const added = addExercises(ul, ul.days[1].id, [row]);
  assert.equal(added.days[1].exercises.length, 2);
  assert.equal(added.days[1].exercises[1].id !== row.id, true);
  assert.equal(added.days[1].exercises[1].name, row.name);
  const bare = withPrescriptionDefaults({ ...row, sets: 0, reps: 0 });
  assert.deepEqual([bare.sets, bare.reps], [3, 10]);
  assert.equal(withPrescriptionDefaults(row), row);
  assert.equal(addLiftsTitle(0), 'Pick lifts');
  assert.equal(addLiftsTitle(1), 'Add 1 lift');
  assert.equal(addLiftsTitle(3), 'Add 3 lifts');
});

check('leaving: an untouched new plan is discarded, never filed', () => {
  const draft = emptyPlan();
  assert.deepEqual(leaveDecision({ plan: draft, openedUnnamed: true, isNew: true, changed: true }), {
    discard: true,
    rename: null,
    file: false,
  });
  // A day added but no lifts and no name: still nothing to keep (the old editor's rule).
  assert.equal(leaveDecision({ plan: addDay(draft), openedUnnamed: true, isNew: true, changed: true }).discard, true);
});

check('leaving: unnamed with lifts and named days takes their names; filing after a change', () => {
  const named = plan('', [['Push', [bench]], ['Pull', [row]]]);
  assert.deepEqual(leaveDecision({ plan: named, openedUnnamed: true, isNew: true, changed: false }), {
    discard: false,
    rename: 'Push and Pull',
    file: true,
  });
  assert.deepEqual(leaveDecision({ plan: ul, openedUnnamed: false, isNew: false, changed: false }), {
    discard: false,
    rename: null,
    file: false,
  });
  assert.equal(leaveDecision({ plan: ul, openedUnnamed: false, isNew: false, changed: true }).file, true);
});

check('gates: second plan, use plan', () => {
  assert.equal(createPlanGate(0), null);
  assert.equal(createPlanGate(1), 'second_plan');
  assert.deepEqual(planUseGate({ plan: ul, activePlanId: ul.id, sessionOpen: false }), { kind: 'active' });
  assert.deepEqual(planUseGate({ plan: ul, activePlanId: ppl.id, sessionOpen: true }), {
    kind: 'blocked',
    toast: 'Finish your workout first',
  });
  assert.deepEqual(planUseGate({ plan: emptyPlan('X'), activePlanId: ppl.id, sessionOpen: false }), {
    kind: 'blocked',
    toast: 'Add a lift first',
  });
  assert.deepEqual(planUseGate({ plan: ul, activePlanId: ppl.id, sessionOpen: false }), {
    kind: 'pro',
    reason: 'switch_plan',
  });
});

if (failures > 0) {
  console.error(`\n${failures} plans check(s) failed`);
  process.exit(1);
}
console.log('Plans logic: OK');
