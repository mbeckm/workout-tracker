/**
 * Plain TS checks for the finish screen, its receipt, History and the after-Done moments
 * (decision 90, D7, D15), run with `tsx` by `npm run check` and CI. No test runner: each `check`
 * throws on a mismatch.
 *
 * Covers the stats against last time (volume, minutes, the estimated max, each lift's line),
 * when the receipt prints (records, every one; goals; milestones) and what it says, PR parity
 * with the old History detail (`workoutPersonalBests` / `personalBestCount`) on the dev
 * fixtures, History's weeks, rows and slips, the moments queue and the week report.
 */
import { afterDoneSteps, isoWeekKey, weekReport, weekVolume, workoutFilledWeek } from '@/device/moments';
import { finishStats, freshReceiptTitle, historyLog, receiptRecords, receiptStub, type HistoryItem } from '@/device/receipt-model';
import type { Goal } from '@/domain/goals';
import { formatLoggedSetLine, formatWorkoutVolume, personalBestCount } from '@/domain/helpers';
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
const shape = (items: HistoryItem[]) =>
  items.map((item) =>
    item.type === 'week'
      ? `${item.label} ${item.lamps.map((lit) => (lit ? 'x' : 'o')).join('')}`
      : item.type === 'row'
        ? `row${item.first ? '<' : ''}${item.last ? '>' : ''}`
        : `slip ${item.heading}`,
  );

// ---------------------------------------------------------------------------------------------
// The finish screen's stats (decision 90)

check('stats: volume, minutes and the estimated max against the last time this day was done', () => {
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
  const { stats, lifts } = finishStats({ workout: legs, history: newestFirst([older, legs]), units: 'kg' });
  assert.deepEqual(
    stats.map((stat) => [stat.key, stat.value, stat.label, stat.delta?.text ?? null, stat.delta?.tone ?? null, stat.record]),
    [
      ['volume', 9108, 'kg', '↑ 7,408', 'up', false],
      ['minutes', 55, 'min', '↑ 11', 'quiet', false],
      ['oneRM', 129, 'Squat e1RM', '★ +9', 'record', true],
    ],
  );
  assert.deepEqual(
    lifts.map((item) => `${item.name}|${item.delta.text}|${item.delta.tone}`),
    ['Squat|★ +7.5 kg|record', 'Leg Press|First time|quiet', 'Calf Raise|First time|quiet'],
  );
  // Not yet in history (the store adds it a render later): the same numbers.
  assert.deepEqual(finishStats({ workout: legs, history: [older], units: 'kg' }), { stats, lifts });
});

check('stats: a lift reads +kg, +reps, Same or −reps against its own last session', () => {
  const best = workout('Push 1', at(8, 1), [{ name: 'Bench', sets: sets([[100, 5]]) }]);
  const last = workout('Push 1', at(8, 8), [{ name: 'Bench', sets: sets([[80, 8]]) }, { name: 'Dip', sets: sets([[20, 10]]) }]);
  const now = workout('Push 1', at(8, 15), [{ name: 'Bench', sets: sets([[82.5, 8]]) }, { name: 'Dip', sets: sets([[20, 8]]) }]);
  const lines = finishStats({ workout: now, history: newestFirst([best, last, now]), units: 'lbs' }).lifts;
  assert.deepEqual(
    lines.map((item) => `${item.delta.text}|${item.delta.tone}`),
    ['+2.5 lbs|up', '−2 reps|quiet'],
  );
  const same = workout('Push 1', at(8, 22), [{ name: 'Bench', sets: sets([[82.5, 8]]) }, { name: 'Dip', sets: sets([[20, 9]]) }]);
  assert.deepEqual(
    finishStats({ workout: same, history: newestFirst([best, last, now, same]), units: 'kg' }).lifts.map((item) => item.delta.text),
    ['Same', '+1 rep'],
  );
});

check('stats: without loads, sets and lifts stand in', () => {
  const plank = workout('Core', at(9, 1), [{ name: 'Plank', sets: [{ id: id('set'), index: 0, durationSeconds: 60 }] }]);
  const { stats, lifts } = finishStats({ workout: plank, history: [], units: 'kg' });
  assert.deepEqual(stats.map((stat) => stat.key), ['sets', 'minutes', 'lifts']);
  assert.equal(lifts[0].delta.text, '1 set');
});

// ---------------------------------------------------------------------------------------------
// The receipt: only a moment prints

check('receipt: a workout without a moment prints nothing', () => {
  const first = workout('Push 1', at(8, 1), [{ name: 'Bench', sets: sets([[80, 8]]) }]);
  const second = workout('Push 1', at(8, 8), [{ name: 'Bench', sets: sets([[75, 8]]) }]);
  assert.equal(receiptStub({ workout: second, history: newestFirst([first, second]), units: 'kg' }), null);
});

check('receipt: one record prints big, with the record it beat and when', () => {
  const older = workout('Push 1', at(9, 2), [{ name: 'Bench Press', sets: sets([[87.5, 8]]) }]);
  const push = workout('Push 1', at(9, 9), [{ name: 'Bench Press', sets: sets([[90, 8], [90, 7]]) }, { name: 'Dip', sets: sets([[10, 8]]) }]);
  const stub = receiptStub({ workout: push, history: newestFirst([older, push]), units: 'kg', userName: ' Marvin ' });
  assert.ok(stub);
  assert.equal(stub?.number, 'No. 002');
  assert.equal(stub?.name, 'MARVIN');
  assert.equal(stub?.recordsHeading, '★ NEW RECORD');
  assert.deepEqual(stub?.records, [{ lift: 'BENCH PRESS', now: '90 × 8', was: '87.5 × 8', wasDate: '2 OCT' }]);
  assert.deepEqual(stub?.stamp, ['★', 'BEST', 'EVER']);
  assert.deepEqual(stub?.footer, { title: 'PUSH 1', amount: '1,430 KG', date: 'FRI 9 OCT' });
  assert.ok(stub?.text.startsWith('TRIM\nNo. 002\nMARVIN\n★ NEW RECORD\nBENCH PRESS 90 × 8 (WAS 87.5 × 8)'));
});

check('receipt: several records all print, in workout order', () => {
  const older = workout('Push 1', at(9, 2), [
    { name: 'Bench Press', sets: sets([[87.5, 8]]) },
    { name: 'Overhead Press', sets: sets([[52.5, 6]]) },
    { name: 'Triceps Pushdown', sets: sets([[37.5, 10]]) },
  ]);
  const push = workout('Push 1', at(9, 9), [
    { name: 'Bench Press', sets: sets([[90, 8]]) },
    { name: 'Overhead Press', sets: sets([[55, 6]]) },
    { name: 'Triceps Pushdown', sets: sets([[40, 10]]) },
  ]);
  const stub = receiptStub({ workout: push, history: newestFirst([older, push]), units: 'kg' });
  assert.equal(stub?.recordsHeading, '★ 3 NEW RECORDS');
  assert.deepEqual(stub?.records.map((record) => `${record.lift} ${record.was} → ${record.now}`), [
    'BENCH PRESS 87.5 × 8 → 90 × 8',
    'OVERHEAD PRESS 52.5 × 6 → 55 × 6',
    'TRICEPS PUSHDOWN 37.5 × 10 → 40 × 10',
  ]);
  assert.deepEqual(stub?.stamp, ['★', '3 IN', 'A DAY']);
  assert.equal(stub?.name, null);
});

check('receipt: a goal reached or a milestone prints too (D7)', () => {
  const push = workout('Push 1', at(9, 1), [{ name: 'Flat Barbell Bench Press', sets: sets([[100, 3]]) }]);
  const goal = {
    id: 'g1',
    exerciseName: 'Flat Barbell Bench Press',
    target: 100,
    pinned: true,
    createdAt: at(6, 1).toISOString(),
    reachedAt: push.completedAt,
  } as Goal;
  const withGoal = receiptStub({ workout: push, history: [push], units: 'kg', goals: [goal] });
  assert.deepEqual(withGoal?.goals, [{ lift: 'FLAT BARBELL BENCH PRESS', target: '100 KG' }]);
  assert.deepEqual(withGoal?.stamp, ['GOAL', '✓']);
  const milestone = receiptStub({ workout: push, history: [push], units: 'kg', milestone: '10th workout' });
  assert.equal(milestone?.milestone, '10TH WORKOUT');
  assert.deepEqual(milestone?.stamp, ['★', '10TH']);
  // The first log of a lift is never a record.
  assert.equal(milestone?.records.length, 0);
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
      const printed = receiptStub({ workout: item, history, units: 'kg' })?.records.length ?? 0;
      assert.equal(printed, personalBestCount(item, history));
      records += printed;
    }
    if (mode !== 'pro') assert.ok(records > 0);
  });
}

// ---------------------------------------------------------------------------------------------
// History (H2)

check('history: weeks start on Monday, newest first, lamps done of planned; rows share a card', () => {
  const days = [day('A', [lift('Row')]), day('B', [lift('Squat')]), day('C', [lift('Bench')]), day('D', [lift('Deadlift')])];
  const plan = makePlan(days, at(8, 21));
  const w = (when: Date, weight = 60) => workout('A', when, [{ name: 'Row', sets: sets([[weight, 8]]) }], { plan, dayId: days[0].id });
  // Sun 27 Sep belongs to the week of Mon 21 Sep; Mon 28 Sep starts the next. The 25 Sep Row is a record.
  const history = newestFirst([w(at(8, 21)), w(at(8, 22)), w(at(8, 23)), w(at(8, 25), 65), w(at(8, 27, 23)), w(at(8, 28, 0))]);
  const items = historyLog({ history, plan, units: 'kg', milestoneFor: () => null });
  assert.deepEqual(shape(items), ['WEEK 2 xooo', 'row<>', 'WEEK 1 xxxx', 'row<>', 'slip ★ RECORD', 'row<', 'row', 'row>']);
  const slip = items[4];
  assert.ok(slip.type === 'slip' && slip.title === 'A');
  assert.deepEqual(slip.type === 'slip' && slip.meta, ['FRI 25 SEP', '520 KG']);
  assert.deepEqual(slip.type === 'slip' && slip.highlights, [{ value: '65 × 8', label: 'ROW' }]);
  const row = items[1];
  assert.ok(row.type === 'row' && row.sub === 'Mon 28 Sep, 44 min' && row.trailing === '480 kg');
});

check('history: weeks before the plan read by date; a deleted plan’s workout keeps its title', () => {
  const plan = makePlan([day('A', [lift('Row')])], at(8, 28));
  const old = workout('Full Body', at(8, 2), [{ name: 'Row', sets: sets([[60, 8]]) }], { dayId: 'gone' });
  const items = historyLog({ history: [old], plan, units: 'kg', milestoneFor: () => null });
  assert.equal(items[0].type === 'week' && items[0].label, 'WEEK OF 31 AUG');
  assert.equal(items[1].type === 'row' && items[1].title, 'Full Body');
  assert.equal(items[1].type === 'row' && items[1].deletePrompt, 'Delete Full Body from Wed 2 Sep?');
});

check('history: the first workout is a milestone slip by default', () => {
  const only = workout('Push 1', at(9, 1), [{ name: 'Bench', sets: sets([[60, 8]]) }]);
  const items = historyLog({ history: [only], plan: null, units: 'kg' });
  assert.deepEqual(shape(items), ['WEEK OF 28 SEP ', 'slip FIRST WORKOUT']);
  assert.deepEqual(items[1].type === 'slip' && items[1].highlights, [{ value: '1', label: 'WORKOUT' }]);
});

check('history: 100+ workouts from the history fixture, each a row or a slip', () => {
  const snapshot = homeDemoSnapshot(defaultSnapshot, 'gadget-history');
  assert.ok(snapshot.workoutHistory.length >= 100);
  const items = historyLog({ history: snapshot.workoutHistory, plan: snapshot.plans[0] ?? null, units: 'kg' });
  assert.equal(items.filter((item) => item.type !== 'week').length, snapshot.workoutHistory.length);
  assert.ok(items.some((item) => item.type === 'slip'));
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

// ---------------------------------------------------------------------------------------------
// Units: switching relabels, it never converts (Settings: "Past workouts keep their numbers.")

check('units: a kg workout read in lbs keeps its numbers, as the old History detail and Done did', () => {
  const kg = workout('Push 1', at(9, 1), [{ name: 'Bench Press', sets: sets([[60, 8], [60, 8], [65, 6]]) }]);
  const older = workout('Push 1', at(8, 24), [{ name: 'Bench Press', sets: sets([[55, 8]]) }]);
  const history = newestFirst([older, kg]);
  const inKg = receiptStub({ workout: kg, history, units: 'kg' });
  const inLbs = receiptStub({ workout: kg, history, units: 'lbs' });
  // Only the unit word changes; every number stays as logged.
  assert.equal(inLbs?.text, inKg?.text.replace(' KG', ' LBS'));
  assert.deepEqual(inLbs?.records.map((record) => record.now), ['65 × 6']);
  assert.equal(inLbs?.footer.amount, '1,350 LBS');
  const stats = finishStats({ workout: kg, history, units: 'lbs' }).stats;
  assert.deepEqual(stats.map((stat) => `${stat.value} ${stat.label}`), ['1350 lbs', '44 min', '78 Bench e1RM']);
  // The old app's own formatters, on the same switch: the number is relabelled too.
  assert.equal(formatWorkoutVolume(1350, 'lbs').toUpperCase(), '1,350 LBS');
  assert.equal(formatLoggedSetLine({ weight: 60, reps: 8 }, { unit: 'lbs' }), '60 lbs × 8');
  const report = weekReport({ history, plan: null, units: 'lbs', weekOf: at(9, 1) });
  assert.equal(report.volume, '1,350 LBS');
  assert.equal(report.best, 'BENCH 78');
  // Metric tonnes only for kg: 12,000 logged reads 12,000 LBS after the switch, never 12.0 T.
  assert.equal(weekVolume(12000, 'lbs'), '12,000 LBS');
});

if (failures > 0) {
  throw new Error(`check-receipt-logic: ${failures} failed, ${passed} passed`);
}
console.log(`check-receipt-logic: ${passed} passed`);
