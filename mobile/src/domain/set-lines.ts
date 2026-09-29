import {
  bestTenRMSetId,
  formatLoadWithUnit,
  formatLoggedSetLine,
  formatSetsCount,
  personalBestSetIds,
  type SetLineOptions,
  type WeightUnit,
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

export type DoneLine = {
  /** `4 × 8 reps at 60 kg`, `4 sets, best 85 kg × 8`, or one set as logged (`60 kg × 8`). */
  text: string;
  /** VoiceOver: `4 sets of 8 reps at 60 kilograms`. */
  accessibilityLabel: string;
  /** The line names this exercise's personal-best set. */
  pr: boolean;
};

const SPOKEN_UNIT: Record<WeightUnit, string> = { kg: 'kilograms', lbs: 'pounds' };

function spokenLine(line: string, unit: WeightUnit | null | undefined): string {
  let spoken = line;
  if (unit) {
    spoken = spoken.replace(` ${unit}`, ` ${SPOKEN_UNIT[unit]}`);
  }
  return spoken.includes(' × ') ? `${spoken.replace(' × ', ' for ')} reps` : spoken;
}

/** The set a lifter would call their best: highest 10RM, else most reps, else longest. */
function bestSet(sets: LoggedSet[]): LoggedSet | undefined {
  const byTenRM = bestTenRMSetId(sets);
  if (byTenRM) {
    return sets.find((set) => set.id === byTenRM);
  }
  const score = (set: LoggedSet) => set.reps ?? set.durationSeconds ?? -1;
  return sets.reduce<LoggedSet | undefined>(
    (best, set) => (best == null || score(set) > score(best) ? set : best),
    undefined,
  );
}

/**
 * Done's one line per exercise (trim-ui → Done, PRODUCT-DECISIONS 46). When every set matched,
 * it says so in the plan's own words (`4 × 8 reps at 60 kg`, `3 × 30s`); otherwise the count and
 * the best set (`4 sets, best 85 kg × 8`), which is the PR set when there is one. History's
 * session detail keeps every set (decision 26): Done is the moment, detail is the record.
 */
export function exerciseDoneLine(
  exercise: Pick<LoggedExercise, 'sets'>,
  options: SetLineOptions & { prSetIds?: ReadonlySet<string> },
): DoneLine {
  const { sets } = exercise;
  const unit = options.unit;
  const pr = sets.some((set) => options.prSetIds?.has(set.id) ?? false);
  const first = sets[0];
  if (!first) {
    return { text: '—', accessibilityLabel: 'No sets', pr: false };
  }
  const lines = sets.map((set) => formatLoggedSetLine(set, options));
  const count = sets.length;

  if (count === 1) {
    return { text: lines[0] ?? '—', accessibilityLabel: spokenLine(lines[0] ?? '', unit), pr };
  }

  if (lines.every((line) => line === lines[0])) {
    const load = first.weight ?? first.counterweight ?? null;
    if (first.reps != null) {
      const reps = `${first.reps} ${first.reps === 1 ? 'rep' : 'reps'}`;
      if (load != null) {
        const loadText = formatLoadWithUnit(load, unit);
        return {
          text: `${count} × ${reps} at ${loadText}`,
          accessibilityLabel: `${count} sets of ${reps} at ${spokenLine(loadText, unit)}`,
          pr,
        };
      }
      return { text: `${count} × ${reps}`, accessibilityLabel: `${count} sets of ${reps}`, pr };
    }
    return {
      text: `${count} × ${lines[0]}`,
      accessibilityLabel: `${count} sets of ${spokenLine(lines[0] ?? '', unit)}`,
      pr,
    };
  }

  const prSet = sets.find((set) => options.prSetIds?.has(set.id));
  const best = prSet ?? bestSet(sets) ?? first;
  const bestText = formatLoggedSetLine(best, options);
  return {
    text: `${count} sets, best ${bestText}`,
    accessibilityLabel: `${count} sets, best ${spokenLine(bestText, unit)}`,
    pr,
  };
}
