/**
 * What the finish screen, its receipt and History show (decision 90; trim-ui → Receipt, History).
 * Pure TS, no `react-native`, so `scripts/check-receipt-logic.ts` can assert it with `tsx`.
 *
 * - The stats (`finishStats`): three numbers (volume, minutes, the first lift's estimated max)
 *   and one line per lift, each against the last time: the same plan day (or title) for the
 *   numbers, the lift's own last session for its line. Records read `★` in gold.
 * - The receipt (`receiptStub`): it only prints for a moment, a record (all of them), a goal
 *   reached or a milestone. `TRIM`, `No. 047`, the name (D20), the moment, the day and volume.
 *   Most workouts print nothing.
 * - History (`historyLog`): training weeks (Monday start), newest first, each a header with its
 *   lamps over clean rows; a workout that printed shows as its paper slip instead of a row.
 */
import { planWeekNumber, stampName } from '@/device/home-model';
import { goalsReachedIn, type Goal } from '@/domain/goals';
import { bestTenRMSetId, estimatedOneRM, tenRMForSet, workoutMilestone, workoutVolume } from '@/domain/helpers';
import { startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import { loggedSetTotal, workoutPersonalBests } from '@/domain/set-lines';
import { normalizedStatsKey, type LoggedExercise, type LoggedSet, type LoggedWorkout, type WorkoutPlan } from '@/domain/types';

export type WeightUnits = 'kg' | 'lbs';

export type ReceiptInput = {
  workout: LoggedWorkout;
  /** Newest first, as the store keeps it. The workout may or may not be in it yet. */
  history: readonly LoggedWorkout[];
  units: WeightUnits;
  userName?: string | null;
  /** `milestoneFor(workout)` (D7), or null. */
  milestone?: string | null;
  goals?: readonly Goal[];
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const WEEKDAYS_SPOKEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const MONTHS_SPOKEN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `THU 2 OCT` */
export function receiptDate(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `2 OCT` */
export function receiptDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `Thursday 2 October`, for VoiceOver. */
export function spokenDate(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAYS_SPOKEN[date.getDay()]} ${date.getDate()} ${MONTHS_SPOKEN[date.getMonth()]}`;
}

/** `Thu 2 Oct`, for sentences (the delete prompt). */
export function sentenceDate(iso: string): string {
  const [weekday, day, month] = receiptDate(iso).split(' ');
  const title = (word: string) => word.charAt(0) + word.slice(1).toLowerCase();
  return `${title(weekday)} ${day} ${title(month)}`;
}

/** `9,108`: grouped by thousands without leaning on Intl. */
export function groupThousands(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** A load as the paper prints it: `107.5`, `90`. */
export function receiptLoad(value: number): string {
  const tidy = Math.round(value * 100) / 100;
  return String(tidy);
}

/** `KG`, `LBS` */
export function unitLabel(units: WeightUnits): string {
  return units === 'kg' ? 'KG' : 'LBS';
}

const SPOKEN_UNITS: Record<WeightUnits, string> = { kg: 'kilograms', lbs: 'pounds' };

function minutesOf(workout: LoggedWorkout): number {
  return Math.max(1, Math.round(workout.durationMinutes || 0));
}

function loadOf(set: LoggedSet): number | null {
  return set.weight ?? set.counterweight ?? null;
}

/** The best estimated 1RM among a lift's sets, rounded to 0.5 (prototype `E1RM`). */
export function exerciseOneRM(exercise: Pick<LoggedExercise, 'sets'>): number | null {
  let best: number | null = null;
  for (const set of exercise.sets) {
    const value = estimatedOneRM(set.weight, set.reps);
    if (value != null && (best == null || value > best)) {
      best = value;
    }
  }
  return best == null ? null : Math.round(best * 2) / 2;
}

/** `9,108 KG` */
export function receiptVolume(volume: number, units: WeightUnits): string {
  return `${groupThousands(volume)} ${unitLabel(units)}`;
}

/** The lifts this workout set a record on, in workout order (`workoutPersonalBests`). */
export function receiptRecords(workout: LoggedWorkout, history: readonly LoggedWorkout[]): LoggedExercise[] {
  const { exerciseIds } = workoutPersonalBests(workout, history as LoggedWorkout[]);
  return workout.exercises.filter((exercise) => exerciseIds.has(exercise.id));
}

/**
 * A set as the big Doto lines draw it: Doto is monospaced, a space a full cell, so `×` joins
 * without spaces as on the device's display (`90×8`, trim-ui → Copy).
 */
export function dotoSet(text: string): string {
  return text.replace(/ × /g, '×');
}

/** `kg`, `lbs`: the unit inside sentence-case sheet text. */
function unitWord(units: WeightUnits): string {
  return units === 'kg' ? 'kg' : 'lbs';
}

/** The workouts finished before this one (newest first); all of history when it isn't in it yet. */
function olderThan(workout: LoggedWorkout, history: readonly LoggedWorkout[]): readonly LoggedWorkout[] {
  const index = history.findIndex((item) => item.id === workout.id);
  return index === -1 ? history.filter((item) => item.completedAt < workout.completedAt) : history.slice(index + 1);
}

/** This workout's place in the whole history, from 1 (`No. 047`). */
export function workoutNumber(workout: LoggedWorkout, history: readonly LoggedWorkout[]): number {
  return olderThan(workout, history).length + 1;
}

/** The set a lift's record (and its line) is about: its best estimated 10RM. */
function bestSet(sets: readonly LoggedSet[]): LoggedSet | null {
  const setId = bestTenRMSetId(sets as LoggedSet[]);
  return setId ? (sets.find((set) => set.id === setId) ?? null) : null;
}

/** `90 × 8`; a set without a load reads its reps (`× 12`). */
function setText(set: LoggedSet): string {
  const load = loadOf(set);
  return load != null ? `${receiptLoad(load)} × ${set.reps ?? 0}` : `× ${set.reps ?? 0}`;
}

// ---------------------------------------------------------------------------------------------
// The finish screen's stats (decision 90): today against the last time

/** `up` green (better than last time), `record` gold, `quiet` muted (same, fewer, first time). */
export type DeltaTone = 'up' | 'record' | 'quiet';
export type Delta = { text: string; tone: DeltaTone };

export type FinishStat = {
  key: 'volume' | 'minutes' | 'sets' | 'oneRM' | 'lifts';
  /** The number it counts up to. */
  value: number;
  /** `5,908` */
  label: string;
  delta: Delta | null;
  /** The record lift's estimated max reads gold. */
  record: boolean;
  accessibilityLabel: string;
};

export type FinishLift = {
  id: string;
  name: string;
  delta: Delta;
  accessibilityLabel: string;
};

export type FinishStats = { stats: FinishStat[]; lifts: FinishLift[] };

/** The last time this plan day was done (by day id, else by title). */
function previousSession(workout: LoggedWorkout, older: readonly LoggedWorkout[]): LoggedWorkout | null {
  const title = normalizedStatsKey(workout.title);
  return (
    older.find((item) =>
      workout.dayId && item.dayId ? item.dayId === workout.dayId : normalizedStatsKey(item.title) === title,
    ) ?? null
  );
}

/** The lift's sets the last time it was done, in any workout ("last time" is keyed by name). */
function lastSetsOf(name: string, older: readonly LoggedWorkout[]): LoggedSet[] | null {
  const key = normalizedStatsKey(name);
  for (const prior of older) {
    const match = prior.exercises.find((item) => normalizedStatsKey(item.exerciseName) === key && item.sets.length > 0);
    if (match) return match.sets;
  }
  return null;
}

/** The best estimated max the lift had before today. */
function previousBestOneRM(name: string, older: readonly LoggedWorkout[]): number | null {
  const key = normalizedStatsKey(name);
  let best: number | null = null;
  for (const prior of older) {
    for (const exercise of prior.exercises) {
      if (normalizedStatsKey(exercise.exerciseName) !== key) continue;
      const value = exerciseOneRM(exercise);
      if (value != null && (best == null || value > best)) best = value;
    }
  }
  return best;
}

/** `↑ 312`, `↓ 6`, `Same`; green only when more is better and it went up. */
function countDelta(now: number, before: number | null, upIsGood: boolean, decimals = 0): Delta | null {
  if (before == null) return null;
  const factor = 10 ** decimals;
  const diff = Math.round((now - before) * factor) / factor;
  if (diff === 0) return { text: 'Same', tone: 'quiet' };
  const text = `${diff > 0 ? '↑' : '↓'} ${decimals > 0 ? receiptLoad(Math.abs(diff)) : groupThousands(Math.abs(diff))}`;
  return { text, tone: upIsGood && diff > 0 ? 'up' : 'quiet' };
}

/** `Bench` from `BENCH` (the stamp word, in sentence case). */
function stampWord(name: string): string {
  const word = stampName(name);
  return word.charAt(0) + word.slice(1).toLowerCase();
}

/**
 * A lift's line against its last session: `+2.5 kg` (heavier best set), `+1 rep` (same load,
 * more reps), `Same`, `−2 reps`, `First time`; a record reads `★ +2.5 kg` in gold. Lifts
 * without a load read their set count.
 */
export function liftDelta(
  exercise: Pick<LoggedExercise, 'exerciseName' | 'sets'>,
  older: readonly LoggedWorkout[],
  record: boolean,
  units: WeightUnits,
): Delta {
  const now = bestSet(exercise.sets);
  if (!now || tenRMForSet(now) == null) {
    const count = exercise.sets.length;
    return { text: count === 1 ? '1 set' : `${count} sets`, tone: 'quiet' };
  }
  const lastSets = lastSetsOf(exercise.exerciseName, older);
  const before = lastSets ? bestSet(lastSets) : null;
  if (!before || tenRMForSet(before) == null) {
    return { text: 'First time', tone: 'quiet' };
  }
  const loadDiff = Math.round(((loadOf(now) ?? 0) - (loadOf(before) ?? 0)) * 100) / 100;
  const repDiff = (now.reps ?? 0) - (before.reps ?? 0);
  const reps = (count: number) => (Math.abs(count) === 1 ? 'rep' : 'reps');
  const loadText = `${loadDiff > 0 ? '+' : '−'}${receiptLoad(Math.abs(loadDiff))} ${unitWord(units)}`;
  const repText = `${repDiff > 0 ? '+' : '−'}${Math.abs(repDiff)} ${reps(repDiff)}`;
  if (record) {
    if (loadDiff > 0) return { text: `★ ${loadText}`, tone: 'record' };
    if (repDiff > 0) return { text: `★ ${repText}`, tone: 'record' };
    return { text: '★ Record', tone: 'record' };
  }
  if (loadDiff !== 0) return { text: loadText, tone: loadDiff > 0 ? 'up' : 'quiet' };
  if (repDiff !== 0) return { text: repText, tone: repDiff > 0 ? 'up' : 'quiet' };
  return { text: 'Same', tone: 'quiet' };
}

const SPOKEN_TONE: Record<DeltaTone, string> = { up: '', record: 'record, ', quiet: '' };

function spokenDelta(delta: Delta | null): string {
  if (!delta) return '';
  const words = delta.text
    .replace('★ ', '')
    .replace('↑ ', 'up ')
    .replace('↓ ', 'down ')
    .replace(/^\+/, 'up ')
    .replace(/^−/, 'down ');
  return `, ${SPOKEN_TONE[delta.tone]}${words.toLowerCase()}`;
}

/** The finish screen's numbers (F3a): three stats and a line per lift, against last time. */
export function finishStats(input: Pick<ReceiptInput, 'workout' | 'history' | 'units'>): FinishStats {
  const { workout, history, units } = input;
  const older = olderThan(workout, history);
  const previous = previousSession(workout, older);
  const lifts = workout.exercises.filter((exercise) => exercise.sets.length > 0);
  const records = new Set(receiptRecords(workout, history as LoggedWorkout[]).map((exercise) => exercise.id));
  const stats: FinishStat[] = [];

  const volume = Math.round(workoutVolume(workout));
  const sets = loggedSetTotal(workout);
  const minutes = minutesOf(workout);
  if (volume > 0) {
    const delta = countDelta(volume, previous ? Math.round(workoutVolume(previous)) : null, true);
    stats.push({
      key: 'volume',
      value: volume,
      label: unitWord(units),
      delta,
      record: false,
      accessibilityLabel: `${groupThousands(volume)} ${SPOKEN_UNITS[units]}${spokenDelta(delta)}`,
    });
  } else {
    const delta = countDelta(sets, previous ? loggedSetTotal(previous) : null, true);
    stats.push({ key: 'sets', value: sets, label: 'sets', delta, record: false, accessibilityLabel: `${sets} sets${spokenDelta(delta)}` });
  }
  const minuteDelta = countDelta(minutes, previous ? minutesOf(previous) : null, false);
  stats.push({
    key: 'minutes',
    value: minutes,
    label: 'min',
    delta: minuteDelta,
    record: false,
    accessibilityLabel: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}${spokenDelta(minuteDelta)}`,
  });

  // The first lift with an estimate (a plank first doesn't hide the bench's).
  const top = lifts.find((exercise) => exerciseOneRM(exercise) != null);
  const topOneRM = top ? exerciseOneRM(top) : null;
  if (top && topOneRM != null) {
    const record = records.has(top.id);
    const lastSets = lastSetsOf(top.exerciseName, older);
    const before = record
      ? previousBestOneRM(top.exerciseName, older)
      : lastSets
        ? exerciseOneRM({ sets: lastSets })
        : null;
    const counted = countDelta(topOneRM, before, true, 1);
    const delta: Delta | null =
      record && counted ? { text: `★ ${counted.text.replace('↑ ', '+')}`, tone: 'record' } : counted;
    stats.push({
      key: 'oneRM',
      value: topOneRM,
      label: `${stampWord(top.exerciseName)} e1RM`,
      delta,
      record,
      accessibilityLabel: `${top.exerciseName} estimated max ${receiptLoad(topOneRM)}${spokenDelta(delta)}`,
    });
  } else if (volume > 0) {
    const delta = countDelta(sets, previous ? loggedSetTotal(previous) : null, true);
    stats.push({ key: 'sets', value: sets, label: 'sets', delta, record: false, accessibilityLabel: `${sets} sets${spokenDelta(delta)}` });
  } else {
    stats.push({
      key: 'lifts',
      value: lifts.length,
      label: lifts.length === 1 ? 'lift' : 'lifts',
      delta: null,
      record: false,
      accessibilityLabel: `${lifts.length} ${lifts.length === 1 ? 'lift' : 'lifts'}`,
    });
  }

  return {
    stats,
    lifts: lifts.map((exercise) => {
      const delta = liftDelta(exercise, older, records.has(exercise.id), units);
      return {
        id: exercise.id,
        name: exercise.exerciseName,
        delta,
        accessibilityLabel: `${exercise.exerciseName}${spokenDelta(delta)}`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// The receipt: printed only for a moment (decision 90)

export type StubRecord = {
  /** `BENCH PRESS` */
  lift: string;
  /** `90 × 8` */
  now: string;
  /** The record it beat, `87.5 × 8`, and when (`2 OCT`). */
  was: string | null;
  wasDate: string | null;
};

export type StubGoal = { lift: string; target: string };

export type ReceiptStub = {
  /** `No. 047` */
  number: string;
  /** `MARVIN`, or null without a name (D20). */
  name: string | null;
  /** `10TH WORKOUT` (D7). */
  milestone: string | null;
  goals: StubGoal[];
  /** `★ NEW RECORD`, `★ 3 NEW RECORDS`, or null. */
  recordsHeading: string | null;
  records: StubRecord[];
  /** `PUSH 1` with `5,908 KG` (or `52 MIN` without a load) in its lane, the date under it. */
  footer: { title: string; amount: string; date: string };
  /** The rubber stamp's lines: `★ BEST EVER`, `★ 3 IN A DAY`, `GOAL ✓`, `★ 10TH`. */
  stamp: string[];
  /** The receipt as plain text, for Share. */
  text: string;
  accessibilityLabel: string;
};

/** The record each record lift beat: its best estimated 10RM before today, and when. */
function beatenRecord(name: string, older: readonly LoggedWorkout[]): { set: LoggedSet; at: string } | null {
  const key = normalizedStatsKey(name);
  let best: { set: LoggedSet; at: string; value: number } | null = null;
  for (const prior of older) {
    for (const exercise of prior.exercises) {
      if (normalizedStatsKey(exercise.exerciseName) !== key) continue;
      for (const set of exercise.sets) {
        const value = tenRMForSet(set);
        if (value != null && (best == null || value > best.value)) best = { set, at: prior.completedAt, value };
      }
    }
  }
  return best;
}

/**
 * The receipt, or null when the workout has no moment: one or more records, a goal reached, or
 * a milestone (`milestoneFor`). Every record prints, in workout order.
 */
export function receiptStub(input: ReceiptInput): ReceiptStub | null {
  const { workout, history, units } = input;
  const older = olderThan(workout, history);
  const records = receiptRecords(workout, history as LoggedWorkout[]);
  const goals = goalsReachedIn(workout, input.goals ?? []);
  const milestone = input.milestone ?? null;
  if (records.length === 0 && goals.length === 0 && !milestone) return null;

  const stubRecords: StubRecord[] = records.map((exercise) => {
    const now = bestSet(exercise.sets);
    const beaten = beatenRecord(exercise.exerciseName, older);
    return {
      lift: exercise.exerciseName.toUpperCase(),
      now: now ? setText(now) : '',
      was: beaten ? setText(beaten.set) : null,
      wasDate: beaten ? receiptDayMonth(new Date(beaten.at)) : null,
    };
  });
  const stubGoals: StubGoal[] = goals.map((goal) => ({
    lift: goal.exerciseName.toUpperCase(),
    target: `${receiptLoad(goal.target)} ${unitLabel(units)}`,
  }));
  const volume = workoutVolume(workout);
  const name = input.userName?.trim() ? input.userName.trim().toUpperCase() : null;
  const number = `No. ${String(workoutNumber(workout, history)).padStart(3, '0')}`;
  const footer = {
    title: workout.title.toUpperCase(),
    amount: volume > 0 ? receiptVolume(volume, units) : `${minutesOf(workout)} MIN`,
    date: receiptDate(workout.completedAt),
  };
  const recordsHeading =
    stubRecords.length === 0 ? null : stubRecords.length === 1 ? '★ NEW RECORD' : `★ ${stubRecords.length} NEW RECORDS`;
  const stamp =
    stubRecords.length > 1
      ? ['★', `${stubRecords.length} IN`, 'A DAY']
      : stubRecords.length === 1
        ? ['★', 'BEST', 'EVER']
        : stubGoals.length > 0
          ? ['GOAL', '✓']
          : ['★', (milestone ?? '').split(' ')[0].toUpperCase()];

  const lines = ['TRIM', number];
  if (name) lines.push(name);
  if (milestone) lines.push(milestone.toUpperCase());
  for (const goal of stubGoals) lines.push(`GOAL ${goal.lift} ${goal.target} ✓`);
  if (recordsHeading) lines.push(recordsHeading);
  for (const record of stubRecords) {
    lines.push(`${record.lift} ${record.now}${record.was ? ` (WAS ${record.was})` : ''}`);
  }
  lines.push(`${footer.title} ${footer.amount}`, footer.date);

  const spoken = [
    `Trim receipt, workout ${workoutNumber(workout, history)}`,
    name ? input.userName?.trim() : null,
    milestone,
    ...goals.map((goal) => `${goal.exerciseName} goal ${receiptLoad(goal.target)} reached`),
    ...records.map((exercise, index) => {
      const record = stubRecords[index];
      const was = record.was ? `, was ${record.was.replace(' × ', ' for ')}` : '';
      return `${exercise.exerciseName} record ${record.now.replace(' × ', ' for ')}${was}`;
    }),
    `${workout.title}, ${spokenDate(workout.completedAt)}`,
  ];

  return {
    number,
    name,
    milestone: milestone ? milestone.toUpperCase() : null,
    goals: stubGoals,
    recordsHeading,
    records: stubRecords,
    footer,
    stamp,
    text: lines.join('\n'),
    accessibilityLabel: spoken.filter(Boolean).join('. '),
  };
}

// ---------------------------------------------------------------------------------------------
// History

export type WallWeek = {
  type: 'week';
  key: string;
  /** `WEEK 12`, or `WEEK OF 22 SEP` before the active plan existed. */
  label: string;
  /** One lamp per planned day, the done ones first. Empty without a plan. */
  lamps: boolean[];
  accessibilityLabel: string;
};

/** Weeks since the plan's creation week, from 1 (Home's `WEEK n`), or null before it. */
export function planWeekIndex(plan: WorkoutPlan | null, weekStart: Date): number | null {
  if (!plan) return null;
  const created = new Date(plan.createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const days = Math.round((weekStart.getTime() - startOfLocalWeek(created).getTime()) / DAY_MS);
  return days < 0 ? null : Math.floor(days / 7) + 1;
}

/** A workout without a moment: a clean row in its week's card. */
export type LogRow = {
  type: 'row';
  key: string;
  workoutId: string;
  /** `Push 1` */
  title: string;
  /** `Thu 9 Oct, 52 min` */
  sub: string;
  /** `5,908 kg`, or `12 sets` without a load. */
  trailing: string;
  /** Its place in the run of rows between week headers and slips (the card's corners). */
  first: boolean;
  last: boolean;
  accessibilityLabel: string;
  /** `Delete Push 1 from Thu 9 Oct?` (D9). */
  deletePrompt: string;
};

/** A workout that printed: its paper slip, in the list where it happened. */
export type LogSlip = {
  type: 'slip';
  key: string;
  workoutId: string;
  /** `★ RECORD`, `★ 2 RECORDS`, `GOAL REACHED`, `10TH WORKOUT` */
  heading: string;
  /** `PUSH 1` */
  title: string;
  /** `THU 9 OCT` over `5,908 KG` */
  meta: string[];
  /** What it printed, big: `90 × 8` over `BENCH PRESS`, the goal's target, the workout count. */
  highlights: { value: string; label: string }[];
  /** The slip's place in History, for its tilt. */
  index: number;
  accessibilityLabel: string;
  deletePrompt: string;
};

export type HistoryItem = WallWeek | LogRow | LogSlip;

export type HistoryInput = {
  /** Newest first. */
  history: readonly LoggedWorkout[];
  plan: WorkoutPlan | null;
  units: WeightUnits;
  goals?: readonly Goal[];
  /** The store's `milestoneFor` (a milestone prints once ever); defaults to the plain count. */
  milestoneFor?: (workout: LoggedWorkout) => string | null;
};

/** At most this many big lines on a slip; more records fold into the heading's count. */
const SLIP_HIGHLIGHTS = 3;

function logItem(workout: LoggedWorkout, input: HistoryInput, slipIndex: number): LogRow | LogSlip {
  const { history, units } = input;
  const minutes = minutesOf(workout);
  const volume = workoutVolume(workout);
  const sets = loggedSetTotal(workout);
  const deletePrompt = `Delete ${workout.title} from ${sentenceDate(workout.completedAt)}?`;
  const milestone = input.milestoneFor
    ? input.milestoneFor(workout)
    : workoutMilestone(workout, history as LoggedWorkout[]);
  const stub = receiptStub({ workout, history, units, milestone, goals: input.goals });
  if (stub) {
    const highlights = [
      ...stub.records.map((record) => ({ value: record.now, label: record.lift })),
      ...stub.goals.map((goal) => ({ value: goal.target, label: `GOAL ${goal.lift}` })),
    ];
    if (highlights.length === 0) {
      const count = workoutNumber(workout, history);
      highlights.push({ value: String(count), label: count === 1 ? 'WORKOUT' : 'WORKOUTS' });
    }
    const heading =
      stub.records.length > 1
        ? `★ ${stub.records.length} RECORDS`
        : stub.records.length === 1
          ? '★ RECORD'
          : stub.goals.length > 0
            ? 'GOAL REACHED'
            : (stub.milestone ?? '');
    return {
      type: 'slip',
      key: `slip-${workout.id}`,
      workoutId: workout.id,
      heading,
      title: workout.title.toUpperCase(),
      meta: [stub.footer.date, stub.footer.amount],
      highlights: highlights.slice(0, SLIP_HIGHLIGHTS),
      index: slipIndex,
      accessibilityLabel: stub.accessibilityLabel,
      deletePrompt,
    };
  }
  const trailing = volume > 0 ? `${groupThousands(volume)} ${unitWord(units)}` : `${sets} ${sets === 1 ? 'set' : 'sets'}`;
  const sub = `${sentenceDate(workout.completedAt)}, ${minutes} min`;
  return {
    type: 'row',
    key: `row-${workout.id}`,
    workoutId: workout.id,
    title: workout.title,
    sub,
    trailing,
    first: false,
    last: false,
    accessibilityLabel: [
      workout.title,
      spokenDate(workout.completedAt),
      `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
      volume > 0 ? `${groupThousands(volume)} ${SPOKEN_UNITS[units]}` : `${sets} ${sets === 1 ? 'set' : 'sets'}`,
    ].join(', '),
    deletePrompt,
  };
}

/** History's items (H2): per training week (newest first) a header, then rows and slips. */
export function historyLog(input: HistoryInput): HistoryItem[] {
  const { history, plan } = input;
  const goal = plan ? trainableDays(plan).length : 0;
  const items: HistoryItem[] = [];
  let slips = 0;

  let index = 0;
  while (index < history.length) {
    const weekStart = startOfLocalWeek(new Date(history[index].completedAt));
    const weekMs = weekStart.getTime();
    const week: LoggedWorkout[] = [];
    while (index < history.length && startOfLocalWeek(new Date(history[index].completedAt)).getTime() === weekMs) {
      week.push(history[index]);
      index += 1;
    }
    const number = planWeekIndex(plan, weekStart);
    // Home's week definition: every finished workout counts, capped at the plan's days.
    const filled = Math.min(goal, week.filter((workout) => workout.setCount > 0).length);
    const label = number != null ? `WEEK ${number}` : `WEEK OF ${receiptDayMonth(weekStart)}`;
    const spokenLabel = number != null ? `Week ${number}` : `Week of ${spokenDate(weekStart.toISOString()).split(' ').slice(1).join(' ')}`;
    items.push({
      type: 'week',
      key: `week-${weekMs}`,
      label,
      lamps: Array.from({ length: goal }, (_, lamp) => lamp < filled),
      accessibilityLabel:
        goal > 0 ? `${spokenLabel}, ${filled} of ${goal} ${goal === 1 ? 'day' : 'days'} done` : spokenLabel,
    });
    const start = items.length;
    for (const workout of week) {
      const item = logItem(workout, input, slips);
      if (item.type === 'slip') slips += 1;
      items.push(item);
    }
    // Consecutive rows share one card: mark where each run starts and ends.
    for (let at = start; at < items.length; at += 1) {
      const item = items[at];
      if (item.type !== 'row') continue;
      item.first = items[at - 1]?.type !== 'row' || at === start;
      item.last = at === items.length - 1 || items[at + 1]?.type !== 'row';
    }
  }
  return items;
}

/** The fresh receipt's header (`Week 12, 3 of 4 done`); null when the workout isn't this plan's week. */
export function freshReceiptTitle(
  workout: LoggedWorkout,
  history: readonly LoggedWorkout[],
  plan: WorkoutPlan | null,
): string | null {
  if (!plan) return null;
  const goal = trainableDays(plan).length;
  if (goal === 0) return null;
  const completed = new Date(workout.completedAt);
  const weekStart = startOfLocalWeek(completed);
  const end = weekStart.getTime() + 7 * DAY_MS;
  const counted = new Set(
    history
      .filter((item) => {
        const at = new Date(item.completedAt).getTime();
        return item.setCount > 0 && at >= weekStart.getTime() && at < end;
      })
      .map((item) => item.id),
  );
  if (workout.setCount > 0) counted.add(workout.id);
  const done = Math.min(goal, counted.size);
  return `Week ${planWeekNumber(plan.createdAt, completed)}, ${done} of ${goal} done`;
}
