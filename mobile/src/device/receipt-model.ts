/**
 * What the receipt and the History wall print (PLAN Phase 5, SPEC §6 Receipt and History wall).
 * Pure TS, no `react-native`, so `scripts/check-receipt-logic.ts` can assert it with `tsx`.
 *
 * - The receipt: `TRIM`, the name when set (D20), the milestone (D7), the day, `date N MIN`;
 *   per lift its name and set count over an indented `w × r, r, r` line (`compressSetLines`;
 *   `w×r` per set when the weights differ); `SETS`, `VOLUME`, the first lift's estimated max,
 *   one PR line per lift `workoutPersonalBests` finds (the old History detail's PR detection),
 *   one `GOAL <LIFT> <target> ✓` line per goal reached (D7).
 * - The wall: `workoutHistory` grouped by training week (Monday start), newest first, each week
 *   a header with its lamps (done of planned) over rows of three mini receipts.
 */
import { planWeekNumber, stampName } from '@/device/home-model';
import { goalsReachedIn, type Goal } from '@/domain/goals';
import { estimatedOneRM, workoutVolume } from '@/domain/helpers';
import { startOfLocalWeek, trainableDays } from '@/domain/plan-loop';
import { compressSetLines, loggedSetTotal, workoutPersonalBests } from '@/domain/set-lines';
import type { LoggedExercise, LoggedSet, LoggedWorkout, WorkoutPlan } from '@/domain/types';

export type WeightUnits = 'kg' | 'lbs';

/** One printed line. `pair` is a left and a right column; `detail` is the indented set line. */
export type ReceiptRow =
  | { kind: 'center'; text: string; bold?: boolean }
  | { kind: 'rule' }
  | { kind: 'detail'; text: string }
  | { kind: 'pair'; left: string; right: string; tone: 'plain' | 'bold' | 'pr' };

export type Receipt = {
  rows: ReceiptRow[];
  /** The receipt as plain text, 32 columns wide, for Share. */
  text: string;
  /** VoiceOver reads the paper as one element. */
  accessibilityLabel: string;
};

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

/** Columns of the shared text receipt. */
export const RECEIPT_TEXT_WIDTH = 32;

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

/** The indented line under a lift: `107.5 × 6, 6, 5`, or `85×8, 90×6` when the weights differ. */
export function setDetail(sets: LoggedSet[]): string {
  const lines = compressSetLines(sets);
  if (lines.length <= 1) {
    return (lines[0]?.text ?? '').toUpperCase();
  }
  return sets
    .map((set) => {
      const load = loadOf(set);
      if (load != null && set.reps != null) {
        return `${receiptLoad(load)}×${set.reps}`;
      }
      return compressSetLines([set])[0]?.text ?? '';
    })
    .join(', ')
    .toUpperCase();
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

export function receiptModel(input: ReceiptInput): Receipt {
  const { workout, history, units } = input;
  const rows: ReceiptRow[] = [];
  const spoken: string[] = [];
  const name = input.userName?.trim();
  const minutes = minutesOf(workout);

  rows.push({ kind: 'center', text: 'TRIM', bold: true });
  if (name) {
    rows.push({ kind: 'center', text: name.toUpperCase() });
  }
  if (input.milestone) {
    rows.push({ kind: 'center', text: input.milestone.toUpperCase(), bold: true });
  }
  rows.push({ kind: 'center', text: workout.title.toUpperCase() });
  rows.push({ kind: 'center', text: `${receiptDate(workout.completedAt)} ${minutes} MIN` });
  rows.push({ kind: 'rule' });
  spoken.push(
    workout.title,
    `${spokenDate(workout.completedAt)}, ${minutes === 1 ? '1 minute' : `${minutes} minutes`}`,
  );
  if (input.milestone) {
    spoken.push(input.milestone);
  }

  const lifts = workout.exercises.filter((exercise) => exercise.sets.length > 0);
  if (lifts.length === 0) {
    rows.push({ kind: 'pair', left: 'NO SETS LOGGED', right: '', tone: 'plain' });
    spoken.push('No sets logged');
  }
  for (const exercise of lifts) {
    const detail = setDetail(exercise.sets);
    rows.push({
      kind: 'pair',
      left: exercise.exerciseName.toUpperCase(),
      right: String(exercise.sets.length),
      tone: 'plain',
    });
    if (detail) {
      rows.push({ kind: 'detail', text: detail });
    }
    const sets = exercise.sets.length === 1 ? '1 set' : `${exercise.sets.length} sets`;
    spoken.push(`${exercise.exerciseName}, ${sets}${detail ? `, ${detail.toLowerCase().replace(/ × /g, ' for ')}` : ''}`);
  }
  rows.push({ kind: 'rule' });

  const setTotal = loggedSetTotal(workout);
  rows.push({ kind: 'pair', left: 'SETS', right: String(setTotal), tone: 'bold' });
  spoken.push(setTotal === 1 ? '1 set' : `${setTotal} sets`);

  const volume = workoutVolume(workout);
  if (volume > 0) {
    rows.push({ kind: 'pair', left: 'VOLUME', right: receiptVolume(volume, units), tone: 'bold' });
    spoken.push(`volume ${groupThousands(volume)} ${SPOKEN_UNITS[units]}`);
  }

  // The first lift with an estimate (a plank first doesn't hide the bench's).
  for (const exercise of lifts) {
    const oneRM = exerciseOneRM(exercise);
    if (oneRM != null) {
      const word = stampName(exercise.exerciseName);
      rows.push({ kind: 'pair', left: `${word} E1RM`, right: receiptLoad(oneRM), tone: 'pr' });
      spoken.push(`${exercise.exerciseName} estimated max ${receiptLoad(oneRM)}`);
      break;
    }
  }

  for (const exercise of receiptRecords(workout, history)) {
    rows.push({ kind: 'pair', left: `${stampName(exercise.exerciseName)} PR`, right: '★', tone: 'pr' });
    spoken.push(`${exercise.exerciseName} record`);
  }

  for (const goal of goalsReachedIn(workout, input.goals ?? [])) {
    rows.push({
      kind: 'pair',
      left: `GOAL ${stampName(goal.exerciseName)} ${receiptLoad(goal.target)}`,
      right: '✓',
      tone: 'bold',
    });
    spoken.push(`${goal.exerciseName} goal ${receiptLoad(goal.target)} reached`);
  }

  return { rows, text: receiptText(rows), accessibilityLabel: spoken.join('. ') };
}

/** The rows as monospace text: centred lines, `LEFT ... RIGHT` pairs, dashed rules. */
export function receiptText(rows: readonly ReceiptRow[], width = RECEIPT_TEXT_WIDTH): string {
  return rows
    .map((row) => {
      switch (row.kind) {
        case 'center': {
          const pad = Math.max(0, Math.floor((width - row.text.length) / 2));
          return `${' '.repeat(pad)}${row.text}`;
        }
        case 'rule':
          return '-'.repeat(width);
        case 'detail':
          return `  ${row.text}`;
        case 'pair': {
          if (!row.right) return row.left;
          const gap = Math.max(1, width - row.left.length - row.right.length);
          return `${row.left}${' '.repeat(gap)}${row.right}`;
        }
        default: {
          const exhaustive: never = row;
          return exhaustive;
        }
      }
    })
    .join('\n');
}

// ---------------------------------------------------------------------------------------------
// The History wall

export type MiniReceipt = {
  workoutId: string;
  /** `LEGS 1` */
  title: string;
  /** `TUE 30 SEP` */
  date: string;
  /** `9 SETS` */
  sets: string;
  /** `9,108 KG`, or null without weights. */
  volume: string | null;
  /** `SQUAT PR` / `2 PRS` in the record ink, else `48 MIN`. */
  last: { text: string; pr: boolean };
  accessibilityLabel: string;
  /** `Delete Legs 1 from Tue 30 Sep?` (D9). */
  deletePrompt: string;
};

export function miniReceipt(
  workout: LoggedWorkout,
  history: readonly LoggedWorkout[],
  units: WeightUnits,
): MiniReceipt {
  const setTotal = loggedSetTotal(workout);
  const volume = workoutVolume(workout);
  const minutes = minutesOf(workout);
  const records = receiptRecords(workout, history);
  const last =
    records.length > 1
      ? { text: `${records.length} PRS`, pr: true }
      : records.length === 1
        ? { text: `${stampName(records[0].exerciseName)} PR`, pr: true }
        : { text: `${minutes} MIN`, pr: false };
  const spoken = [
    workout.title,
    spokenDate(workout.completedAt),
    setTotal === 1 ? '1 set' : `${setTotal} sets`,
    volume > 0 ? `${groupThousands(volume)} ${SPOKEN_UNITS[units]}` : null,
    records.length > 1
      ? `${records.length} records`
      : records.length === 1
        ? `${records[0].exerciseName} record`
        : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
  ];
  return {
    workoutId: workout.id,
    title: workout.title.toUpperCase(),
    date: receiptDate(workout.completedAt),
    sets: `${setTotal} ${setTotal === 1 ? 'SET' : 'SETS'}`,
    volume: volume > 0 ? receiptVolume(volume, units) : null,
    last,
    accessibilityLabel: spoken.filter(Boolean).join(', '),
    deletePrompt: `Delete ${workout.title} from ${sentenceDate(workout.completedAt)}?`,
  };
}

export type WallWeek = {
  type: 'week';
  key: string;
  /** `WEEK 12`, or `WEEK OF 22 SEP` before the active plan existed. */
  label: string;
  /** One lamp per planned day, the done ones first. Empty without a plan. */
  lamps: boolean[];
  accessibilityLabel: string;
};

export type WallRow = {
  type: 'row';
  key: string;
  minis: MiniReceipt[];
  /** The first mini's place in its week, for the tilt pattern. */
  firstIndex: number;
  /** The week's last row: no grid gap under it (the next week's header margin follows). */
  lastInWeek: boolean;
};

export type WallItem = WallWeek | WallRow;

export type WallInput = {
  /** Newest first. */
  history: readonly LoggedWorkout[];
  plan: WorkoutPlan | null;
  units: WeightUnits;
  columns?: number;
};

/** Weeks since the plan's creation week, from 1 (Home's `WEEK n`), or null before it. */
export function planWeekIndex(plan: WorkoutPlan | null, weekStart: Date): number | null {
  if (!plan) return null;
  const created = new Date(plan.createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const days = Math.round((weekStart.getTime() - startOfLocalWeek(created).getTime()) / DAY_MS);
  return days < 0 ? null : Math.floor(days / 7) + 1;
}

/** The wall's items: per training week (newest first) a header, then rows of `columns` minis. */
export function historyWall(input: WallInput): WallItem[] {
  const { history, plan, units } = input;
  const columns = input.columns ?? 3;
  const goal = plan ? trainableDays(plan).length : 0;
  const items: WallItem[] = [];

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
    for (let start = 0; start < week.length; start += columns) {
      const slice = week.slice(start, start + columns);
      items.push({
        type: 'row',
        key: `row-${slice[0].id}`,
        firstIndex: start,
        lastInWeek: start + columns >= week.length,
        minis: slice.map((workout) => miniReceipt(workout, history, units)),
      });
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
