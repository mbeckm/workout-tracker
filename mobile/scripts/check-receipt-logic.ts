/**
 * Plain TS checks for the receipt, the History wall and the after-Done moments (PLAN Phase 5),
 * run with `tsx` by `npm run check` and CI. No test runner: each `check` throws on a mismatch.
 *
 * Covers the receipt's lines (compressed set lines, differing weights, totals, E1RM, PR and goal
 * lines, name and milestone), PR parity with the old History detail (`workoutPersonalBests` /
 * `personalBestCount`) on the dev fixtures, the wall's weeks and rows, the moments queue and the
 * week report.
 */
import { afterDoneSteps, isoWeekKey, weekReport, weekVolume, workoutFilledWeek } from '@/device/moments';
import {
  freshReceiptTitle,
  historyWall,
  miniReceipt,
  receiptModel,
  receiptRecords,
  setDetail,
  type ReceiptRow,
} from '@/device/receipt-model';
import type { Goal } from '@/domain/goals';
import { personalBestCount } from '@/domain/helpers';
import { workoutPersonalBests } from '@/domain/set-lines';
import type { ExercisePrescription, LoggedSet, LoggedWorkout, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { homeDemoSnapshot, type HomeDemoMode } from '@/store/home-demo';
import { defaultSnapshot } from '@/store/snapshot';

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
const at = (month: number, date: number, hour = 18) => new Date(2026, month, date, hour);

function lift(name: string, sets = 3, reps = 8): ExercisePrescription {
  return {
    id: id('ex'),
    name,
    sets,
    reps,
    bodyParts: [],
    targetMuscles: ['chest'],
    secondaryMuscles: [],
    equipments: ['barbell'],
    imageURLs: {},
    itemType: 'strength',
    trackingMode: 'weightAndReps',
  };
}
const day = (title: string, lifts: ExercisePrescription[]): WorkoutDay => ({ id: id('day'), title, exercises: lifts });
const makePlan = (days: WorkoutDay[], createdAt = at(6, 13)): WorkoutPlan => ({
  id: id('plan'),
  name: 'PPL',
  daysPerWeek: days.length,
  createdAt: createdAt.toISOString(),
  days,
});

const sets = (pairs: [number | null, number | null][]): LoggedSet[] =>
  pairs.map(([weight, reps], index) => ({ id: id('set'), index, weight, reps }));

function workout(
  title: string,
  when: Date,
  lifts: { name: string; sets: LoggedSet[] }[],
  options: { plan?: WorkoutPlan; dayId?: string; minutes?: number } = {},
): LoggedWorkout {
  const exercises = lifts.map((item) => ({ id: id('lx'), exerciseName: item.name, sets: item.sets }));
  return {
    id: id('w'),
    title,
    completedAt: when.toISOString(),
    durationMinutes: options.minutes ?? 44,
    exerciseCount: exercises.length,
    setCount: exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    exercises,
    planId: options.plan?.id ?? null,
    dayId: options.dayId ?? null,
  };
}

const newestFirst = (items: LoggedWorkout[]) => [...items].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
const texts = (rows: ReceiptRow[]) =>
  rows.map((row) =>
    row.kind === 'pair' ? `${row.left}|${row.right}|${row.tone}` : row.kind === 'rule' ? '---' : row.kind === 'detail' ? `  ${row.text}` : row.text,
  );

// ---------------------------------------------------------------------------------------------
// The receipt

check('receipt: target 03 (Legs 1) prints as on the screen', () => {
  const older = workout('Legs 1', at(8, 23), [{ name: 'Squat', sets: sets([[100, 6], [100, 6], [100, 5]]) }]);
  const legs = workout(
    'Legs 1',
    at(8, 30),
    [
      { name: 'Squat', sets: sets([[107.5, 6], [107.5, 6], [107.5, 5]]) },
      { name: 'Leg Press', sets: sets([[160, 10], [160, 10], [160, 9]]) },
      { name: 'Calf Raise', sets: sets([[60, 15], [60, 15], [60, 14]]) },
    ],
    { minutes: 55 },
  );
  const receipt = receiptModel({ workout: legs, history: newestFirst([older, legs]), units: 'kg' });
  assert.deepEqual(texts(receipt.rows), [
    'TRIM',
    'LEGS 1',
    'WED 30 SEP 55 MIN',
    '---',
    'SQUAT|3|plain',
    '  107.5 × 6, 6, 5',
    'LEG PRESS|3|plain',
    '  160 × 10, 10, 9',
    'CALF RAISE|3|plain',
    '  60 × 15, 15, 14',
    '---',
    'SETS|9|bold',
    'VOLUME|9,108 KG|bold',
    'SQUAT E1RM|129|pr',
    'SQUAT PR|★|pr',
  ]);
  assert.ok(receipt.text.split('\n').every((line) => line.length <= 32));
});

check('receipt: differing weights print w×r per set; bodyweight and timed sets read plainly', () => {
  assert.equal(setDetail(sets([[85, 8], [85, 8], [90, 6]])), '85×8, 85×8, 90×6');
  assert.equal(setDetail(sets([[null, 12], [null, 10]])), '12, 10 REPS');
  assert.equal(
    setDetail([{ id: 'a', index: 0, durationSeconds: 45 }, { id: 'b', index: 1, durationSeconds: 45 }]),
    '45S × 2',
  );
});

check('receipt: the name (D20), the milestone and goals (D7), the first lift with an estimate', () => {
  const push = workout('Push 1', at(9, 1), [
    { name: 'Plank', sets: [{ id: id('set'), index: 0, durationSeconds: 60 }] },
    { name: 'Flat Barbell Bench Press', sets: sets([[90, 9]]) },
  ]);
  const goal: Goal = {
    id: 'g1',
    exerciseName: 'Flat Barbell Bench Press',
    target: 100,
    pinned: true,
    createdAt: at(6, 1).toISOString(),
    reachedAt: push.completedAt,
  } as Goal;
  const receipt = receiptModel({ workout: push, history: [push], units: 'kg', userName: 'Marvin', milestone: '10th workout', goals: [goal] });
  const lines = texts(receipt.rows);
  assert.deepEqual(lines.slice(0, 5), ['TRIM', 'MARVIN', '10TH WORKOUT', 'PUSH 1', 'THU 1 OCT 44 MIN']);
  assert.ok(lines.includes('BENCH E1RM|117|pr'));
  assert.ok(lines.includes('GOAL BENCH 100|✓|bold'));
  // The first log of a lift is never a record.
  assert.ok(!lines.some((line) => line.endsWith('PR|★|pr')));
});

check('receipt: nothing logged', () => {
  const empty = workout('Push 1', at(9, 1), []);
  const lines = texts(receiptModel({ workout: empty, history: [], units: 'lbs' }).rows);
  assert.ok(lines.includes('NO SETS LOGGED||plain'));
  assert.ok(!lines.some((line) => line.startsWith('VOLUME')));
});

check('receipt: the fresh header states the week (Week n, x of y done)', () => {
  const days = [day('Pull 1', [lift('Row')]), day('Legs 1', [lift('Squat')]), day('Push 1', [lift('Bench')]), day('Legs 2', [lift('Deadlift')])];
  const plan = makePlan(days, at(6, 13));
  const mon = workout('Pull 1', at(8, 28), [{ name: 'Row', sets: sets([[60, 8]]) }], { plan, dayId: days[0].id });
  const tue = workout('Legs 1', at(8, 29), [{ name: 'Squat', sets: sets([[80, 8]]) }], { plan, dayId: days[1].id });
  const thu = workout('Push 1', at(9, 1), [{ name: 'Bench', sets: sets([[60, 8]]) }], { plan, dayId: days[2].id });
  assert.equal(freshReceiptTitle(thu, newestFirst([mon, tue, thu]), plan), 'Week 12, 3 of 4 done');
  // Not yet in history (the store adds it on the next render): still counted.
  assert.equal(freshReceiptTitle(thu, newestFirst([mon, tue]), plan), 'Week 12, 3 of 4 done');
  assert.equal(freshReceiptTitle(thu, [], null), null);
});

// ---------------------------------------------------------------------------------------------
// PR parity with the old app (History detail `workoutPersonalBests`, History rows `personalBestCount`)

const FIXTURES: HomeDemoMode[] = ['pro', 'pro-complete', 'gadget', 'gadget-stamped', 'gadget-history'];
for (const mode of FIXTURES) {
  check(`PR parity: ${mode}`, () => {
    const history = homeDemoSnapshot(defaultSnapshot, mode).workoutHistory;
    let records = 0;
    for (const item of history) {
      const old = workoutPersonalBests(item, history);
      const expected = item.exercises.filter((exercise) => old.exerciseIds.has(exercise.id)).map((exercise) => exercise.id);
      assert.deepEqual(receiptRecords(item, history).map((exercise) => exercise.id), expected);
      const printed = receiptModel({ workout: item, history, units: 'kg' }).rows.filter(
        (row) => row.kind === 'pair' && row.left.endsWith(' PR'),
      ).length;
      assert.equal(printed, personalBestCount(item, history));
      const mini = miniReceipt(item, history, 'kg');
      assert.equal(mini.last.pr, expected.length > 0);
      records += printed;
    }
    if (mode !== 'pro') assert.ok(records > 0);
  });
}

// ---------------------------------------------------------------------------------------------
// The wall

check('wall: weeks start on Monday, newest first, rows of three, lamps done of planned', () => {
  const days = [day('A', [lift('Row')]), day('B', [lift('Squat')]), day('C', [lift('Bench')]), day('D', [lift('Deadlift')])];
  const plan = makePlan(days, at(8, 21));
  const w = (when: Date) => workout('A', when, [{ name: 'Row', sets: sets([[60, 8]]) }], { plan, dayId: days[0].id });
  // Sun 27 Sep belongs to the week of Mon 21 Sep; Mon 28 Sep starts the next.
  const history = newestFirst([w(at(8, 21)), w(at(8, 22)), w(at(8, 23)), w(at(8, 25)), w(at(8, 27, 23)), w(at(8, 28, 0))]);
  const items = historyWall({ history, plan, units: 'kg' });
  assert.deepEqual(
    items.map((item) => (item.type === 'week' ? `${item.label} ${item.lamps.map((on) => (on ? 'x' : 'o')).join('')}` : item.minis.length)),
    ['WEEK 2 xooo', 1, 'WEEK 1 xxxx', 3, 2],
  );
  const lastRow = items[4];
  assert.ok(lastRow.type === 'row' && lastRow.firstIndex === 3);
});

check('wall: weeks before the plan read by date; a deleted plan’s workout keeps its title', () => {
  const plan = makePlan([day('A', [lift('Row')])], at(8, 28));
  const old = workout('Full Body', at(8, 2), [{ name: 'Row', sets: sets([[60, 8]]) }], { dayId: 'gone' });
  const items = historyWall({ history: [old], plan, units: 'kg' });
  assert.equal(items[0].type === 'week' && items[0].label, 'WEEK OF 31 AUG');
  assert.equal(items[1].type === 'row' && items[1].minis[0].title, 'FULL BODY');
  assert.equal(items[1].type === 'row' && items[1].minis[0].deletePrompt, 'Delete Full Body from Wed 2 Sep?');
});

check('wall: 100+ workouts from the history fixture', () => {
  const snapshot = homeDemoSnapshot(defaultSnapshot, 'gadget-history');
  assert.ok(snapshot.workoutHistory.length >= 100);
  const items = historyWall({ history: snapshot.workoutHistory, plan: snapshot.plans[0] ?? null, units: 'kg' });
  const minis = items.reduce((sum, item) => sum + (item.type === 'row' ? item.minis.length : 0), 0);
  assert.equal(minis, snapshot.workoutHistory.length);
});

// ---------------------------------------------------------------------------------------------
// After Done (D7, D15)

const days4 = [day('Pull 1', [lift('Row')]), day('Legs 1', [lift('Squat')]), day('Push 1', [lift('Bench')]), day('Legs 2', [lift('Deadlift')])];
const plan4 = makePlan(days4, at(6, 13));
const on = (index: number, when: Date, weight = 60) =>
  workout(days4[index].title, when, [{ name: days4[index].exercises[0].name, sets: sets([[weight, 8]]) }], {
    plan: plan4,
    dayId: days4[index].id,
  });

check('after Done: the stamp, then the paywall when offered', () => {
  const first = on(0, at(8, 28));
  assert.deepEqual(
    afterDoneSteps({ workout: first, history: [first], plan: plan4, weekMomentsShown: [], offerPaywall: true }).map((step) => step.kind),
    ['stamp', 'paywall'],
  );
});

check('after Done: the workout that fills the week adds the week moment, once', () => {
  const week = [on(0, at(8, 28)), on(1, at(8, 29)), on(2, at(8, 30)), on(3, at(9, 1))];
  const history = newestFirst(week);
  const last = week[3];
  assert.ok(workoutFilledWeek(last, history, plan4));
  const steps = afterDoneSteps({ workout: last, history, plan: plan4, weekMomentsShown: [], offerPaywall: true });
  assert.deepEqual(steps.map((step) => step.kind), ['stamp', 'week', 'paywall']);
  const key = steps[1].kind === 'week' ? steps[1].weekKey : '';
  assert.equal(key, '2026-W40');
  assert.deepEqual(
    afterDoneSteps({ workout: last, history, plan: plan4, weekMomentsShown: [key], offerPaywall: false }).map((step) => step.kind),
    ['stamp'],
  );
  // A fifth workout in a full week doesn't fill it again.
  const extra = on(0, at(9, 2));
  assert.ok(!workoutFilledWeek(extra, newestFirst([...week, extra]), plan4));
  // Before it's in history (the same render as completeWorkout), it still counts.
  assert.ok(workoutFilledWeek(last, newestFirst(week.slice(0, 3)), plan4));
});

check('ISO week keys', () => {
  assert.equal(isoWeekKey(at(9, 3)), '2026-W40');
  assert.equal(isoWeekKey(new Date(2021, 0, 3)), '2020-W53');
  assert.equal(isoWeekKey(new Date(2024, 11, 30)), '2025-W01');
});

check('week report: lifts up, records, volume, best (QC2)', () => {
  const before = [on(0, at(8, 21), 60), on(1, at(8, 22), 100), on(2, at(8, 23), 80), on(3, at(8, 24), 120)];
  const week = [on(0, at(8, 28), 62.5), on(1, at(8, 29), 100), on(2, at(8, 30), 85), on(3, at(9, 1), 120)];
  const report = weekReport({ history: newestFirst([...before, ...week]), plan: plan4, units: 'kg', weekOf: at(9, 1) });
  assert.equal(report.label, 'WEEK 12');
  assert.equal(report.headline, 'Week 12 done');
  assert.equal(report.range, '28 SEP TO 4 OCT');
  assert.equal(report.liftsUp, 2);
  assert.equal(report.records, 2);
  assert.equal(report.volume, `${(8 * (62.5 + 100 + 85 + 120)).toLocaleString('en-US')} KG`);
  assert.equal(report.best, 'DEADLIFT 152');
  assert.equal(report.streak, '2 weeks in a row');
  assert.equal(weekVolume(38900, 'kg'), '38.9 T');
  assert.equal(weekVolume(9108, 'lbs'), '9,108 LBS');
});

if (failures > 0) {
  throw new Error(`check-receipt-logic: ${failures} failed, ${passed} passed`);
}
console.log(`check-receipt-logic: ${passed} passed`);
