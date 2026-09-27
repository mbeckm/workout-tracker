import {
  formatLoggedSetLine,
  formatSetsCount,
  personalBestSetIds,
  type SetLineOptions,
} from '@/domain/helpers';
import type { LoggedExercise, LoggedSet, LoggedWorkout } from '@/domain/types';

/** One recap line: consecutive sets at the same load, e.g. `85 kg × 8, 8, 8, 7`. */
export type SetLine = {
  /** Carries the weight unit on the load (`85 kg × 8`) when one is passed. */
  text: string;
  /** Spoken form for VoiceOver: `85 for 8, 8, 8 and 7 reps`. */
  accessibilityLabel: string;
  setIds: string[];
};

type LineSet = Pick<LoggedSet, 'id' | 'weight' | 'reps' | 'counterweight' | 'durationSeconds'>;

function loadOf(set: LineSet): number | null {
  return set.weight ?? set.counterweight ?? null;
}

/** Sets that compress on reps: a load with reps, or bodyweight reps. */
function groupKey(set: LineSet): string | null {
  if (set.reps == null) {
    return null;
  }
  const load = loadOf(set);
  return load == null ? 'reps' : `load:${load}`;
}

function spokenList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? '';
  }
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function lineFor(group: LineSet[], options?: SetLineOptions): SetLine {
  const first = group[0];
  const setIds = group.map((set) => set.id);
  const key = first ? groupKey(first) : null;

  if (!first || key == null) {
    const text = first ? formatLoggedSetLine(first, options) : '—';
    return { text, accessibilityLabel: text.replace('×', 'for'), setIds };
  }

  const reps = group.map((set) => String(set.reps));
  if (key === 'reps') {
    const unit = group.length === 1 && group[0]?.reps === 1 ? 'rep' : 'reps';
    return {
      text: `${reps.join(', ')} ${unit}`,
      accessibilityLabel: `${spokenList(reps)} ${unit}`,
      setIds,
    };
  }

  const load = formatLoggedSetLine({ weight: loadOf(first) }, { unit: options?.unit });
  const repsUnit = group.length === 1 && first.reps === 1 ? 'rep' : 'reps';
  return {
    text: `${load} × ${reps.join(', ')}`,
    accessibilityLabel: `${load} for ${spokenList(reps)} ${repsUnit}`,
    setIds,
  };
}

/**
 * Same-weight compression for recaps (D-1, SD-1).
 * Consecutive sets at the same load collapse into one line (`85 kg × 8, 8, 8, 7`);
 * a load change starts a new line. Duration and other sets stay one line each,
 * except that identical consecutive durations collapse too (`45s, 45s` → `45s × 2`).
 */
export function compressSetLines(sets: LineSet[], options?: SetLineOptions): SetLine[] {
  const groups: LineSet[][] = [];
  for (const set of sets) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    const key = groupKey(set);
    const sameRepsGroup = key != null && previous != null && groupKey(previous) === key;
    const sameOther =
      key == null &&
      previous != null &&
      groupKey(previous) == null &&
      formatLoggedSetLine(previous, options) === formatLoggedSetLine(set, options);
    if (current && (sameRepsGroup || sameOther)) {
      current.push(set);
    } else {
      groups.push([set]);
    }
  }

  return groups.map((group) => {
    const first = group[0];
    if (first && groupKey(first) == null && group.length > 1) {
      const single = formatLoggedSetLine(first, options);
      return {
        text: `${single} × ${group.length}`,
        accessibilityLabel: `${group.length} sets of ${single}`,
        setIds: group.map((set) => set.id),
      };
    }
    return lineFor(group, options);
  });
}

/** Whether any set in the workout carries a load, so the screen should state the unit. */
export function workoutUsesLoad(workout: Pick<LoggedWorkout, 'exercises'>): boolean {
  return workout.exercises.some((exercise) => exercise.sets.some((set) => loadOf(set) != null));
}

export type WorkoutPersonalBests = {
  /** Set ids that beat a prior session's 10RM (at most one per exercise). */
  setIds: Set<string>;
  /** Logged exercise ids that contain a PR set. */
  exerciseIds: Set<string>;
  count: number;
};

/**
 * PR lookup for one session against the rest of history.
 * Wraps `personalBestSetIds`, which compares only against older sessions, so a
 * just-finished workout that is not in history yet is compared against all of it.
 */
export function workoutPersonalBests(
  workout: LoggedWorkout,
  history: LoggedWorkout[],
): WorkoutPersonalBests {
  const setIds = personalBestSetIds(workout, history);
  const exerciseIds = new Set<string>();
  for (const exercise of workout.exercises) {
    if (exercise.sets.some((set) => setIds.has(set.id))) {
      exerciseIds.add(exercise.id);
    }
  }
  return { setIds, exerciseIds, count: setIds.size };
}

export function loggedSetTotal(workout: Pick<LoggedWorkout, 'setCount' | 'exercises'>): number {
  return (
    workout.setCount || workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  );
}

/** `19 sets`, falling back to counting logged sets when `setCount` is missing. */
export function formatLoggedSetTotal(workout: Pick<LoggedWorkout, 'setCount' | 'exercises'>): string {
  return formatSetsCount(loggedSetTotal(workout));
}

const SPOKEN_UNITS = { kg: 'weights in kilograms', lbs: 'weights in pounds' } as const;

/**
 * One facts line with the weight unit stated once at the end (G-9):
 * `Push · 58 min · 19 sets · 3 PRs · kg`. Set lines below it stay unitless.
 */
export function recapFacts(
  parts: (string | null | false | undefined)[],
  unit: 'kg' | 'lbs' | null,
): { text: string; accessibilityLabel: string } {
  const kept = parts.filter((part): part is string => Boolean(part));
  return {
    text: [...kept, unit].filter(Boolean).join(' · '),
    accessibilityLabel: [...kept, unit ? SPOKEN_UNITS[unit] : null]
      .filter(Boolean)
      .join(', ')
      .replace(/ · /g, ', '),
  };
}

export function formatPrCount(count: number): string {
  return count === 1 ? '1 PR' : `${count} PRs`;
}

/**
 * VoiceOver summary for an exercise recap:
 * `Bench Press, personal best 85 for 8, 85 for 8, 8, 8 and 7 reps`.
 * `prSetLine` is the PR set as displayed (`85 × 8`), or null when there is no PR.
 */
export function exerciseRecapLabel(
  exercise: Pick<LoggedExercise, 'exerciseName'>,
  lines: SetLine[],
  prSetLine: string | null,
): string {
  return [
    exercise.exerciseName,
    prSetLine ? `personal best ${prSetLine.replace(' × ', ' for ')}` : null,
    ...lines.map((line) => line.accessibilityLabel),
  ]
    .filter(Boolean)
    .join(', ');
}
