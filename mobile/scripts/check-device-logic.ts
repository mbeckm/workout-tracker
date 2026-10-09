/**
 * Plain TS checks for the device's pure logic (PLAN §10), run with `tsx` by `npm run check`
 * and CI. No test runner: each `check` throws on a mismatch and the script exits 1.
 *
 * Covers Home's week definitions (PLAN Phase 3): stamps, lamps (a repeated day too),
 * selection (the stamped-next case), week done, 0-lift days, no plans, more workouts than
 * days, 1- and 7-day plans, the Monday boundary, PR stamps, `WEEK n` and the streak.
 */
import { deviceReducer, initialDeviceState } from '@/device/device-state';
import {
  READY_BEAT,
  TEACH,
  TOUR_SCRIPT,
  TOUR_SETS,
  initialTourState,
  lineOf,
  litControl,
  tourLiftLamps,
  tourReducer,
  type TourAction,
  type TourLift,
  type TourState,
} from '@/device/tour/tour-model';
import { rollWindow, tourRollRows } from '@/device/roll-call-model';
import { estimateDayMinutes, TIME_BUFFER } from '@/domain/day-facts';
import { finishLock } from '@/domain/finish';
import {
  HOME_LIFT_LINES,
  displayPrescription,
  expandedRowHeight,
  homeModel,
  planWeekNumber,
  stampName,
  type HomeModel,
  type HomeModelInput,
} from '@/device/home-model';
import type { ExercisePrescription, LoggedWorkout, WorkoutDay, WorkoutPlan } from '@/domain/types';

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

function lift(name: string, sets = 3, reps = 8, extra: Partial<ExercisePrescription> = {}): ExercisePrescription {
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
    ...extra,
  };
}

function day(title: string, lifts: ExercisePrescription[]): WorkoutDay {
  return { id: id('day'), title, exercises: lifts };
}

function makePlan(days: WorkoutDay[], createdAt = new Date(2026, 0, 5)): WorkoutPlan {
  return { id: id('plan'), name: 'Test', daysPerWeek: days.length, createdAt: createdAt.toISOString(), days };
}

/** A workout of `planDay` at `at`, each lift logged as `sets` × [weight, reps]. */
function trained(
  plan: WorkoutPlan,
  planDay: WorkoutDay,
  at: Date,
  options: { weight?: number; reps?: number; minutes?: number; weights?: Record<string, number> } = {},
): LoggedWorkout {
  const exercises = planDay.exercises.map((exercise) => ({
    id: id('lx'),
    exerciseName: exercise.name,
    sets: Array.from({ length: exercise.sets }, (_, index) => ({
      id: id('set'),
      index,
      weight: options.weights?.[exercise.name] ?? options.weight ?? 50,
      reps: options.reps ?? exercise.reps,
    })),
  }));
  return {
    id: id('w'),
    title: planDay.title,
    completedAt: at.toISOString(),
    durationMinutes: options.minutes ?? 48,
    exerciseCount: exercises.length,
    setCount: exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    exercises,
    planId: plan.id,
    dayId: planDay.id,
  };
}

/** Newest first, as the store keeps history. */
function newestFirst(workouts: LoggedWorkout[]): LoggedWorkout[] {
  return [...workouts].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

function model(input: Partial<HomeModelInput> & { plan: WorkoutPlan | null }): Extract<HomeModel, { kind: 'plan' }> {
  const result = homeModel({
    plans: input.plan ? [input.plan] : [],
    history: [],
    now: THU,
    ...input,
  });
  assert.equal(result.kind, 'plan');
  return result as Extract<HomeModel, { kind: 'plan' }>;
}

// The week of Monday 28 September 2026. "Now" is Thursday evening.
const at = (month: number, date: number, hour = 18, minute = 0) => new Date(2026, month, date, hour, minute);
const MON = at(8, 28);
const TUE = at(8, 29);
const WED = at(8, 30);
const THU = at(9, 1);
const LAST_FRI = at(8, 25);
const LAST_SAT = at(8, 26);
const LAST_TUE = at(8, 22);

const push = () =>
  day('Push 1', [
    lift('Bench Press'),
    lift('Cable Fly', 3, 12),
    lift('Overhead Press'),
    lift('Dip', 3, 10),
    lift('Lateral Raise', 3, 15),
    lift('Triceps Pushdown', 3, 12),
  ]);
const fourDays = () => [day('Pull 1', [lift('Barbell Row')]), day('Legs 1', [lift('Squat', 5, 5)]), push(), day('Legs 2', [lift('Deadlift'), lift('Leg Curl'), lift('Calf Raise')])];

// ---------------------------------------------------------------------------------------------
// Stamps

check('stamps: a day trained this week is stamped; last week is not', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const history = newestFirst([
    trained(plan, days[0], MON, { minutes: 48 }),
    trained(plan, days[1], TUE, { minutes: 55 }),
    trained(plan, days[2], LAST_FRI),
  ]);
  const home = model({ plan, history });
  assert.deepEqual(
    home.rows.map((row) => row.done != null),
    [true, true, false, false],
  );
  assert.deepEqual(home.rows[0].done && { ...home.rows[0].done, workoutId: '' }, {
    workoutId: '',
    weekday: 'MON',
    weekdaySpoken: 'Monday',
    minutes: 48,
    sets: 3,
  });
  assert.equal(home.rows[1].done?.weekday, 'TUE');
});

check('stamps: the Monday boundary (00:00 local counts, Sunday 23:59 does not)', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], at(8, 27, 23, 59)), trained(plan, days[1], at(8, 28, 0, 0))]);
  const home = model({ plan, history, now: at(8, 28, 0, 1) });
  assert.deepEqual(
    home.rows.map((row) => row.done != null),
    [false, true, false, false],
  );
  assert.deepEqual(home.week.lamps, ['done', 'on', 'off', 'off']);
  // A minute before midnight, it was all last week's.
  const sunday = model({ plan, history: history.slice(1), now: at(8, 27, 23, 59, ) });
  assert.equal(sunday.rows[0].done?.weekday, 'SUN');
});

check('stamps: PR stamp text from workoutPersonalBests', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const legsBefore = trained(plan, days[1], LAST_TUE, { weight: 100 });
  const legs = trained(plan, days[1], TUE, { weight: 105 });
  const legs2Before = trained(plan, days[3], LAST_SAT, { weight: 80 });
  const legs2 = trained(plan, days[3], WED, { weight: 90 });
  const pull = trained(plan, days[0], MON, { weight: 50 });
  const home = model({ plan, history: newestFirst([legsBefore, legs, legs2Before, legs2, pull]) });
  assert.deepEqual(home.rows[1].stamp, { text: 'SQUAT PR', spoken: 'squat record' });
  assert.deepEqual(home.rows[3].stamp, { text: '3 PRS', spoken: '3 records' });
  // The first log of a lift is not a record.
  assert.equal(home.rows[0].stamp, null);
});

check('stamps: stamp names drop how-words and parentheses', () => {
  assert.equal(stampName('Squat'), 'SQUAT');
  assert.equal(stampName('Leg Curl'), 'CURL');
  assert.equal(stampName('Bench Press'), 'BENCH');
  assert.equal(stampName('Flat Barbell Bench Press'), 'BENCH');
  assert.equal(stampName('Incline Bench Press (Barbell)'), 'BENCH');
  assert.equal(stampName('Barbell Back Squat'), 'SQUAT');
  assert.equal(stampName('Romanian Deadlift'), 'DEADLIFT');
  assert.equal(stampName('Close-Grip Lat Pulldown'), 'PULLDOWN');
  assert.equal(stampName('Overhead Press'), 'OVERHEAD');
});

// ---------------------------------------------------------------------------------------------
// Lamps

check('lamps: filled in the order trained, the next slot orange', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], MON), trained(plan, days[1], TUE)]);
  const home = model({ plan, history });
  assert.deepEqual(home.week.lamps, ['done', 'done', 'on', 'off']);
  assert.equal(home.week.filled, 2);
  assert.equal(home.week.goal, 4);
  assert.equal(home.week.done, false);
  assert.equal(home.week.accessibilityLabel, 'Week 39, 2 of 4 days done');
});

check('lamps: a repeated day lights a lamp; the row shows its latest workout', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], MON, { minutes: 40 }), trained(plan, days[0], WED, { minutes: 51 })]);
  const home = model({ plan, history });
  assert.deepEqual(home.week.lamps, ['done', 'done', 'on', 'off']);
  assert.deepEqual(
    home.rows.map((row) => row.done != null),
    [true, false, false, false],
  );
  assert.equal(home.rows[0].done?.weekday, 'WED');
  assert.equal(home.rows[0].done?.minutes, 51);
});

check('estimate: a prescription is stretched by TIME_BUFFER; timed history is not (D93)', () => {
  const days = fourDays();
  const plan = makePlan(days);
  assert.equal(TIME_BUFFER, 1.3);
  assert.equal(estimateDayMinutes(plan, days[2], []), 45);
  const history = newestFirst([trained(plan, days[2], MON, { minutes: 40 }), trained(plan, days[2], WED, { minutes: 51 })]);
  assert.equal(estimateDayMinutes(plan, days[2], history), 51);
});

check('lamps: the just-finished day flickers its own slot', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], MON), trained(plan, days[2], TUE), trained(plan, days[1], WED)]);
  assert.equal(model({ plan, history, justFinishedDayId: days[1].id }).week.litIndex, 2);
  assert.equal(model({ plan, history, justFinishedDayId: days[2].id }).week.litIndex, 1);
  assert.equal(model({ plan, history }).week.litIndex, null);
  // A day not trained this week has no lamp to light.
  assert.equal(model({ plan, history, justFinishedDayId: days[3].id }).week.litIndex, null);
});

check('lamps: more workouts than days cap at the goal, and the week is done', () => {
  const days = [day('A', [lift('Squat')]), day('B', [lift('Bench Press')])];
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], MON), trained(plan, days[1], TUE), trained(plan, days[0], WED)]);
  const home = model({ plan, history });
  assert.deepEqual(home.week.lamps, ['done', 'done']);
  assert.equal(home.week.filled, 2);
  assert.equal(home.week.done, true);
  assert.equal(home.rows.length, 2);
  assert.equal(home.rows[0].done?.weekday, 'WED');
});

// ---------------------------------------------------------------------------------------------
// Selection

check('selection: the plan loop’s next day', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], MON), trained(plan, days[1], TUE)]);
  const home = model({ plan, history });
  assert.equal(home.selectedIndex, 2);
  assert.equal(home.rows[2].selected, true);
  // The prescription's work and rest, × TIME_BUFFER (D93), to the nearest 5.
  assert.equal(home.rows[2].accessibilityLabel, 'Push 1, next, 6 lifts, about 45 minutes');
});

check('selection: no history selects the first day (after onboarding)', () => {
  const days = fourDays();
  const home = model({ plan: makePlan(days) });
  assert.equal(home.selectedIndex, 0);
  assert.deepEqual(home.week.lamps, ['on', 'off', 'off', 'off']);
  assert.ok(home.rows.every((row) => row.done == null && row.stamp == null));
});

check('selection: the loop’s next day is stamped this week → the first unstamped day', () => {
  const days = [day('A', [lift('Squat')]), day('B', [lift('Bench Press')]), day('C', [lift('Deadlift')])];
  const plan = makePlan(days);
  // Last week B and C, this week A: the loop closes on A and starts again at A.
  const history = newestFirst([trained(plan, days[1], LAST_FRI), trained(plan, days[2], LAST_SAT), trained(plan, days[0], MON)]);
  const home = model({ plan, history });
  assert.equal(home.rows[0].done != null, true);
  assert.equal(home.selectedIndex, 1);
});

check('selection: a tapped row wins, stamped rows too; a stale pick falls back', () => {
  const days = fourDays();
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], MON)]);
  const picked = model({ plan, history, pickedDayId: days[0].id });
  assert.equal(picked.selectedIndex, 0);
  assert.equal(picked.rows[0].accessibilityLabel, 'Pull 1, selected, done Monday, 3 sets');
  assert.equal(model({ plan, history, pickedDayId: days[3].id }).selectedIndex, 3);
  assert.equal(model({ plan, history, pickedDayId: 'gone' }).selectedIndex, 1);
});

check('week done: every row stamped, all lamps green, Start repeats the loop’s day', () => {
  const days = [day('A', [lift('Squat')]), day('B', [lift('Bench Press')]), day('C', [lift('Deadlift')])];
  const plan = makePlan(days);
  const history = newestFirst([trained(plan, days[0], MON), trained(plan, days[1], TUE), trained(plan, days[2], WED)]);
  const home = model({ plan, history });
  assert.equal(home.week.done, true);
  assert.deepEqual(home.week.lamps, ['done', 'done', 'done']);
  assert.ok(home.rows.every((row) => row.done != null));
  assert.equal(home.selectedIndex, 0);
});

// ---------------------------------------------------------------------------------------------
// Rows

check('rows: only trainable days; the expanded row lists 3 lifts and +N MORE past 4', () => {
  const days = [...fourDays(), day('Empty', [])];
  const plan = makePlan(days);
  const home = model({ plan });
  assert.equal(home.rows.length, 4);
  assert.equal(home.week.goal, 4);
  const pushRow = home.rows[2];
  assert.equal(pushRow.liftCount, 6);
  assert.equal(pushRow.lines.length, HOME_LIFT_LINES);
  assert.deepEqual(pushRow.lines[0], { kind: 'lift', name: 'BENCH PRESS', prescription: '3×8' });
  assert.deepEqual(pushRow.lines[3], { kind: 'more', count: 3 });
  assert.equal(home.rows[3].lines.length, 3);
  assert.equal(pushRow.estimate, '~45 MIN');
  assert.equal(expandedRowHeight(6, 70, 27), 178);
  assert.equal(expandedRowHeight(3, 70, 27), 151);
  assert.equal(expandedRowHeight(1, 70, 27), 97);
});

check('rows: a plan whose days have no lifts shows them as 0 LIFTS rows', () => {
  const days = [day('Day 1', []), day('Day 2', [])];
  const home = model({ plan: makePlan(days) });
  assert.equal(home.rows.length, 2);
  assert.equal(home.rows[0].liftCount, 0);
  assert.equal(home.rows[0].estimate, null);
  assert.equal(home.selectedIndex, 0);
  assert.equal(home.rows[0].accessibilityLabel, 'Day 1, next, 0 lifts');
  assert.deepEqual(home.week.lamps, []);
});

check('rows: no plans → SLOT EMPTY', () => {
  assert.deepEqual(homeModel({ plans: [], plan: null, history: [], now: THU }), { kind: 'empty' });
});

check('rows: a 1-day plan and a 7-day plan', () => {
  const one = makePlan([day('Full body', [lift('Squat'), lift('Bench Press')])]);
  const single = model({ plan: one, history: [trained(one, one.days[0], MON)] });
  assert.deepEqual(single.week.lamps, ['done']);
  assert.equal(single.week.done, true);
  assert.equal(single.week.streak, null);

  const seven = makePlan(Array.from({ length: 7 }, (_, index) => day(`Day ${index + 1}`, [lift('Squat')])));
  const history = newestFirst([trained(seven, seven.days[0], MON), trained(seven, seven.days[1], TUE)]);
  const week = model({ plan: seven, history });
  assert.equal(week.rows.length, 7);
  assert.deepEqual(week.week.lamps, ['done', 'done', 'on', 'off', 'off', 'off', 'off']);
  assert.equal(week.selectedIndex, 2);
});

check('rows: the display prescription per tracking mode', () => {
  assert.equal(displayPrescription(lift('Bench Press', 4, 6)), '4×6');
  assert.equal(displayPrescription(lift('Plank', 3, 0, { trackingMode: 'duration', durationSeconds: 45 })), '3×0:45');
  assert.equal(displayPrescription(lift('Bike', 1, 0, { itemType: 'cardio', trackingMode: 'duration', durationSeconds: 1200 })), '20 MIN');
});

// ---------------------------------------------------------------------------------------------
// WEEK n and the streak (D20)

check('week: WEEK n counts Mondays since the plan was made, from 1', () => {
  assert.equal(planWeekNumber(at(8, 30).toISOString(), THU), 1);
  assert.equal(planWeekNumber(at(8, 27, 23).toISOString(), THU), 2);
  assert.equal(planWeekNumber(at(8, 9).toISOString(), THU), 4);
  assert.equal(planWeekNumber('not a date', THU), 1);
  // Over the October DST change (Europe and US) a week is 167 or 169 hours.
  assert.equal(planWeekNumber(at(9, 19).toISOString(), at(10, 2, 9)), 3);
});

check('week: ▲n once the streak reaches STREAK_MIN', () => {
  const days = [day('A', [lift('Squat')]), day('B', [lift('Bench Press')])];
  const plan = makePlan(days, at(8, 7));
  const twoFull = newestFirst([
    trained(plan, days[0], at(8, 14)),
    trained(plan, days[1], at(8, 15)),
    trained(plan, days[0], at(8, 21)),
    trained(plan, days[1], at(8, 22)),
  ]);
  const home = model({ plan, history: twoFull });
  assert.equal(home.week.label, 'WEEK 4');
  assert.equal(home.week.streak, '  ▲2');
  assert.equal(home.week.accessibilityLabel, 'Week 4, 0 of 2 days done, 2 weeks in a row');
  assert.equal(model({ plan, history: twoFull.slice(0, 2) }).week.streak, null);
});

// ---------------------------------------------------------------------------------------------
// Device state: the just-finished day (Phase 5 sets it, Home plays it once)

check('device state: justFinished is set, then cleared by its own id only', () => {
  const marked = deviceReducer(initialDeviceState, { type: 'markJustFinished', dayId: 'day-a' });
  assert.equal(marked.justFinished?.dayId, 'day-a');
  const id = marked.justFinished?.id ?? -1;
  const newer = deviceReducer(marked, { type: 'markJustFinished', dayId: 'day-b' });
  assert.equal(deviceReducer(newer, { type: 'clearJustFinished', id }).justFinished?.dayId, 'day-b');
  assert.equal(deviceReducer(marked, { type: 'clearJustFinished', id }).justFinished, null);
});

check('loading: Use plan closes the sheet; only its own finish ends it', () => {
  const open = deviceReducer(initialDeviceState, { type: 'openSheet', kind: 'editor', params: { planId: 'p' } });
  const loading = deviceReducer(open, { type: 'startLoading', planId: 'p' });
  assert.equal(loading.sheet, null);
  assert.equal(loading.uiMode, 'loading');
  const id = loading.loading?.id ?? -1;
  const again = deviceReducer(loading, { type: 'startLoading', planId: 'q' });
  assert.equal(deviceReducer(again, { type: 'finishLoading', id }).uiMode, 'loading');
  const done = deviceReducer(loading, { type: 'finishLoading', id });
  assert.equal(done.uiMode, null);
  assert.equal(done.loading, null);
});

check('edit: the rocker moves the lift; leaving puts the editor back', () => {
  const editing = deviceReducer(initialDeviceState, {
    type: 'startEdit',
    target: { planId: 'p', dayId: 'd', exerciseId: 'a', back: { planId: 'p', dirty: '1' } },
  });
  const moved = deviceReducer(editing, { type: 'editLift', exerciseId: 'b' });
  assert.equal(moved.edit?.exerciseId, 'b');
  const left = deviceReducer(moved, { type: 'leaveEdit' });
  assert.equal(left.uiMode, null);
  assert.equal(left.sheet?.kind, 'editor');
  assert.equal(left.sheet?.params.dirty, '1');
});

/* The guided tour (decision 85). */

const TOUR_FACTS = { name: 'Sam' };
const TOUR_LIFTS: TourLift[] = [
  { id: 'a', name: 'Bench', alternatives: [{ id: 'a1', name: 'DB Bench', meta: '' }, { id: 'a2', name: 'Machine', meta: '' }] },
  { id: 'b', name: 'Incline', alternatives: [{ id: 'b1', name: 'Incline Barbell', meta: '' }, { id: 'b2', name: 'Fly', meta: '' }] },
  { id: 'c', name: 'Press', alternatives: [] },
];

function tourStep(state: TourState, action: TourAction): TourState {
  return tourReducer(state, action, TOUR_FACTS);
}

/** Types the current line out, then taps (a `tap` beat goes on). */
function tourTap(state: TourState): TourState {
  return tourStep(tourStep(state, { type: 'tap' }), { type: 'tap' });
}

check('tour: a tap first finishes the line, then goes on', () => {
  const start = initialTourState(TOUR_LIFTS);
  const typed = tourStep(start, { type: 'tap' });
  assert.equal(typed.beat, 0);
  assert.equal(typed.typed, lineOf(0, TOUR_FACTS).length);
  const next = tourStep(typed, { type: 'tap' });
  assert.equal(next.beat, 1);
  assert.equal(next.previous, lineOf(0, TOUR_FACTS));
});

check('tour: controls do nothing before they are taught', () => {
  let state = initialTourState(TOUR_LIFTS);
  state = tourTap(tourTap(state));
  state = tourStep(state, { type: 'show' });
  assert.equal(state.screen, 'log');
  const logged = tourStep(state, { type: 'log', now: 0 });
  assert.deepEqual(logged.sets, [0, 0, 0]);
  const undone = tourStep(state, { type: 'undo' });
  assert.equal(undone.beat, state.beat);
});

check('tour: the whole script, each control answering its own line', () => {
  let state = initialTourState(TOUR_LIFTS);
  state = tourTap(tourTap(state));
  state = tourStep(state, { type: 'show' });
  state = tourTap(state);
  assert.equal(state.beat, TEACH.wheel);
  // The line types before the wheel lights.
  assert.equal(litControl(state, TOUR_FACTS), null);
  state = tourStep(state, { type: 'tap' });
  assert.equal(litControl(state, TOUR_FACTS), 'wheel');
  state = tourStep(state, { type: 'wheel', direction: 1, step: 2.5 });
  assert.equal(state.beat, TEACH.wheel);
  state = tourStep(state, { type: 'wheel', direction: 1, step: 2.5 });
  assert.equal(state.beat, TEACH.wheel + 1);
  assert.equal(state.weight, 25);
  state = tourTap(state);
  state = tourStep(state, { type: 'reps', direction: 1 });
  assert.equal(state.reps, 9);
  state = tourTap(state);
  state = tourStep(state, { type: 'log', now: 1000 });
  assert.equal(state.screen, 'rest');
  assert.deepEqual(state.sets, [1, 0, 0]);
  state = tourTap(state);
  assert.equal(state.beat, TEACH.undo);
  state = tourStep(state, { type: 'undo' });
  assert.deepEqual(state.sets, [0, 0, 0]);
  assert.equal(state.screen, 'log');
  state = tourTap(state);
  state = tourStep(state, { type: 'lift', direction: 1 });
  assert.equal(state.lift, 1);
  // Moving on doesn't finish a lift: the one left behind with nothing logged goes dark.
  assert.deepEqual(tourLiftLamps(state), ['off', 'on', 'off']);
  state = tourTap(state);
  assert.equal(state.beat, TEACH.swap);
  // Only the asked-for alternative answers the swap line.
  const wrong = tourStep(state, { type: 'swap', alternativeId: 'b2' });
  assert.equal(wrong.beat, TEACH.swap);
  state = tourStep(state, { type: 'swap', alternativeId: 'b1' });
  assert.equal(state.lifts[1].name, 'Incline Barbell');
  assert.equal(state.previous, '');
  state = tourTap(state);
  assert.equal(state.beat, TEACH.menu);
  state = tourStep(state, { type: 'menuClosed' });
  assert.equal(state.beat, READY_BEAT);
  assert.equal(state.screen, 'ready');
  assert.equal(lineOf(state.beat, TOUR_FACTS), "That's the tour, Sam.");
  state = tourTap(state);
  assert.equal(state.beat, TOUR_SCRIPT.length - 1);
});

check('tour: Skip on the first screen goes to the end', () => {
  const skipped = tourStep(initialTourState(TOUR_LIFTS), { type: 'skip' });
  assert.equal(skipped.beat, READY_BEAT);
  assert.equal(skipped.screen, 'ready');
});

check('finishes: Graphite is earned by the tour, Pro finishes need Pro', () => {
  assert.equal(finishLock('101', { isPro: false, tourDone: false }), 'tour');
  assert.equal(finishLock('101', { isPro: false, tourDone: true }), null);
  assert.equal(finishLock('707', { isPro: false, tourDone: true }), 'pro');
  assert.equal(finishLock('707', { isPro: true, tourDone: false }), null);
  assert.equal(finishLock('212', { isPro: false, tourDone: false }), null);
});

check('roll call: every row fits, or a window keeps the current lift near the middle', () => {
  assert.deepEqual(rollWindow(6, 2, 8), { start: 0, end: 6 });
  assert.deepEqual(rollWindow(8, 0, 6), { start: 0, end: 6 });
  assert.deepEqual(rollWindow(8, 4, 6), { start: 1, end: 7 });
  assert.deepEqual(rollWindow(8, 7, 6), { start: 2, end: 8 });
  assert.deepEqual(rollWindow(3, 1, 0), { start: 1, end: 2 });
});

check('roll call and lamps: a tour lift is done only when its sets are', () => {
  const state = { ...initialTourState(TOUR_LIFTS), lift: 2, sets: [TOUR_SETS, 1, 0] };
  const rows = tourRollRows(state);
  assert.deepEqual(
    rows.map((row) => [row.done, row.meta]),
    [
      [true, `${TOUR_SETS}/${TOUR_SETS}`],
      [false, `1/${TOUR_SETS}`],
      [false, `0/${TOUR_SETS}`],
    ],
  );
  assert.deepEqual(tourLiftLamps(state), ['done', 'part', 'on']);
});

if (failures > 0) {
  // An uncaught error exits non-zero.
  throw new Error(`check-device-logic: ${failures} failed, ${passed} passed`);
}
console.log(`check-device-logic: ${passed} passed`);
