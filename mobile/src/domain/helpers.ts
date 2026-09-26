import type {
  ExercisePrescription,
  ExerciseTrackingMode,
  LoggedSet,
  LoggedWorkout,
  WorkoutDay,
  WorkoutPlan,
} from '@/domain/types';
import { newId } from '@/domain/id';
import { normalizedStatsKey } from '@/domain/types';

export function emptyLoggedSet(index: number, previous?: LoggedSet | null): LoggedSet {
  return {
    id: newId(),
    index,
    weight: previous?.weight ?? null,
    reps: previous?.reps ?? null,
    counterweight: previous?.counterweight ?? null,
    durationSeconds: previous?.durationSeconds ?? null,
    distanceMeters: previous?.distanceMeters ?? null,
  };
}

export function clonePrescription(source: ExercisePrescription): ExercisePrescription {
  return {
    ...source,
    id: newId(),
    imageURLs: { ...source.imageURLs },
    bodyParts: [...source.bodyParts],
    targetMuscles: [...source.targetMuscles],
    secondaryMuscles: [...(source.secondaryMuscles ?? [])],
    equipments: [...source.equipments],
    repScheme: source.repScheme ? [...source.repScheme] : null,
  };
}

export function emptyDay(title = 'Day 1'): WorkoutDay {
  return {
    id: newId(),
    title,
    exercises: [],
  };
}

export function emptyPlan(name = ''): WorkoutPlan {
  return {
    id: newId(),
    name,
    daysPerWeek: 1,
    createdAt: new Date().toISOString(),
    days: [emptyDay('Day 1')],
  };
}

export function withDay(
  plan: WorkoutPlan,
  dayId: string,
  update: (day: WorkoutDay) => WorkoutDay,
): WorkoutPlan {
  const days = plan.days.map((day) => (day.id === dayId ? update(day) : day));
  return {
    ...plan,
    days,
    daysPerWeek: days.length,
  };
}

export function setCount(exercise: ExercisePrescription): number {
  return Math.max(exercise.sets, exercise.repScheme?.length ?? 0, 1);
}

export function repsForSet(exercise: ExercisePrescription, index: number): number | null {
  const value = exercise.repScheme?.[index] ?? exercise.reps;
  return value > 0 ? value : null;
}

export function usesWeight(mode: ExerciseTrackingMode): boolean {
  return (
    mode === 'weightAndReps' ||
    mode === 'counterweightAndReps' ||
    mode === 'weightAndDistance'
  );
}

export function usesReps(mode: ExerciseTrackingMode): boolean {
  return (
    mode === 'weightAndReps' ||
    mode === 'counterweightAndReps' ||
    mode === 'reps' ||
    mode === 'repsAndDuration'
  );
}

export function usesDuration(mode: ExerciseTrackingMode): boolean {
  return (
    mode === 'duration' ||
    mode === 'repsAndDuration' ||
    mode === 'distanceAndDuration'
  );
}

export function durationIsMinutes(exercise: ExercisePrescription): boolean {
  return exercise.itemType === 'cardio' || exercise.trackingMode === 'distanceAndDuration';
}

export function formatPlanMetric(exercise: ExercisePrescription): string {
  if (durationIsMinutes(exercise)) {
    const minutes = Math.max(1, Math.round((exercise.durationSeconds ?? 0) / 60) || 20);
    return `${minutes} min`;
  }
  if (usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode)) {
    return `${setCount(exercise)} × ${exercise.durationSeconds ?? 30}s`;
  }
  return `${setCount(exercise)} × ${exercise.reps || 8} reps`;
}

/**
 * `4 × 8 reps · 15 kg`: the prescription plus the working weight from the last session
 * (its heaviest set). Plans store no weights, so the load comes from history; without
 * history, or for bodyweight and timed work, it's the prescription alone.
 */
export function formatPlanMetricWithLoad(
  exercise: ExercisePrescription,
  previousSets: readonly Pick<LoggedSet, 'weight'>[] | null | undefined,
  unit: WeightUnit,
): string {
  const base = formatPlanMetric(exercise);
  const loads = (previousSets ?? [])
    .map((set) => set.weight)
    .filter((value): value is number => value != null && value > 0);
  if (loads.length === 0) {
    return base;
  }
  return `${base} · ${formatLoadWithUnit(Math.max(...loads), unit)}`;
}

export function exerciseSubtitle(exercise: ExercisePrescription): string {
  const equipment = exercise.equipments[0] ?? exercise.exerciseType ?? exercise.itemType;
  return `${equipment} · ${formatPlanMetric(exercise)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours}h ${rest}min`;
  }
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}min ${seconds}s`;
}

export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function parsePositiveNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Epley estimated 1RM. */
export function estimatedOneRM(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number | null {
  if (weight == null || reps == null || weight <= 0 || reps <= 0) {
    return null;
  }
  return weight * (1 + reps / 30);
}

/** Epley 1RM, then convert to 10RM. Matches ScratchWorkout `LoggedSet.estimatedTenRM`. */
export function estimatedTenRM(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number | null {
  const oneRM = estimatedOneRM(weight, reps);
  if (oneRM == null) {
    return null;
  }
  return oneRM / (1 + 10 / 30);
}

export function tenRMForSet(
  set: Pick<LoggedSet, 'weight' | 'reps' | 'estimatedTenRM'>,
): number | null {
  if (set.estimatedTenRM != null && Number.isFinite(set.estimatedTenRM)) {
    return set.estimatedTenRM;
  }
  return estimatedTenRM(set.weight, set.reps);
}

export function bestTenRMForSets(sets: LoggedSet[]): number | null {
  const values = sets
    .map((set) => tenRMForSet(set))
    .filter((value): value is number => value != null);
  if (values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

export function withLoggedTenRM<T extends { sets: LoggedSet[]; bestTenRM?: number | null }>(
  exercise: T,
): T {
  const sets = exercise.sets.map((set) => ({
    ...set,
    estimatedTenRM: estimatedTenRM(set.weight, set.reps),
  }));
  return {
    ...exercise,
    sets,
    bestTenRM: bestTenRMForSets(sets),
  };
}

export function formatTenRM(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  if (Math.round(value) === value) {
    return String(Math.round(value));
  }
  return value.toFixed(1);
}

/** Weight × reps across logged sets. Matches Hevy volume on the save / complete screens. */
export function workoutVolume(workout: LoggedWorkout): number {
  return workout.exercises.reduce(
    (sum, exercise) =>
      sum + exercise.sets.reduce((inner, set) => inner + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  );
}

export function formatWorkoutVolume(volume: number, units: 'kg' | 'lbs'): string {
  return `${Math.round(volume).toLocaleString()} ${units}`;
}

/** Hevy save/complete duration: `24min`, `1h 5min`. */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 1) {
    return '<1min';
  }
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

function previousBestTenRM(
  exerciseName: string,
  older: LoggedWorkout[],
): number | null {
  const key = normalizedStatsKey(exerciseName);
  let previousBest: number | null = null;
  for (const prior of older) {
    const match = prior.exercises.find((item) => normalizedStatsKey(item.exerciseName) === key);
    const value = match ? (match.bestTenRM ?? bestTenRMForSets(match.sets)) : null;
    if (value != null && (previousBest == null || value > previousBest)) {
      previousBest = value;
    }
  }
  return previousBest;
}

function historyOlderThan(workout: LoggedWorkout, history: LoggedWorkout[]): LoggedWorkout[] {
  const index = history.findIndex((item) => item.id === workout.id);
  return index === -1 ? history : history.slice(index + 1);
}

function isPersonalBestTenRM(current: number, previousBest: number | null): boolean {
  return previousBest != null && current - previousBest >= 0.05;
}

/** Set that achieved the session's best 10RM for an exercise (first if tied). */
function bestTenRMSetId(sets: LoggedSet[]): string | null {
  let bestId: string | null = null;
  let bestValue = -Infinity;
  for (const set of sets) {
    const value = tenRMForSet(set);
    if (value != null && value > bestValue) {
      bestValue = value;
      bestId = set.id;
    }
  }
  return bestId;
}

/**
 * Sets that beat a prior session's 10RM for the same exercise.
 * First logs of an exercise are not PRs. At most one set per exercise.
 */
export function personalBestSetIds(workout: LoggedWorkout, history: LoggedWorkout[]): Set<string> {
  const older = historyOlderThan(workout, history);
  const ids = new Set<string>();

  for (const exercise of workout.exercises) {
    const current = exercise.bestTenRM ?? bestTenRMForSets(exercise.sets);
    if (current == null) {
      continue;
    }
    if (!isPersonalBestTenRM(current, previousBestTenRM(exercise.exerciseName, older))) {
      continue;
    }
    const setId = bestTenRMSetId(exercise.sets);
    if (setId) {
      ids.add(setId);
    }
  }

  return ids;
}

/** Beats a prior session's 10RM for the same exercise. First logs are not PRs. */
export function personalBestCount(workout: LoggedWorkout, history: LoggedWorkout[]): number {
  return personalBestSetIds(workout, history).size;
}

export function formatWorkoutWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatPaperMinutes(minutes: number): string {
  const value = Math.max(1, Math.round(minutes));
  return `${value} min`;
}

export function formatDaysCount(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

export function formatHistoryMonth(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'long' });
  }
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatHistoryWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** When under a month caption — avoid repeating the month (`Wed 13` not `Jul 13`). */
export function formatHistoryWhenInMonth(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  return `${weekday} ${date.getDate()}`;
}

export function formatHistoryMonthCount(label: string, count: number): string {
  return count === 1 ? `${label} · 1 session` : `${label} · ${count} sessions`;
}

export function formatExercisesCount(count: number): string {
  return count === 1 ? '1 exercise' : `${count} exercises`;
}

export function formatSetsCount(count: number): string {
  return count === 1 ? '1 set' : `${count} sets`;
}

export function formatPersonalBests(count: number): string {
  return count === 1 ? '1 personal best' : `${count} personal bests`;
}

function loggedExerciseCount(workout: LoggedWorkout): number {
  return workout.exerciseCount || workout.exercises.length;
}

function loggedSetCount(workout: LoggedWorkout): number {
  return (
    workout.setCount || workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  );
}

/** History row meta: `Yesterday · 3 exercises · 8 min`. */
export function formatHistorySessionMeta(
  workout: LoggedWorkout,
  now = new Date(),
  options?: { inMonth?: boolean },
): string {
  const when = options?.inMonth
    ? formatHistoryWhenInMonth(workout.completedAt, now)
    : formatHistoryWhen(workout.completedAt, now);
  return [
    when,
    formatExercisesCount(loggedExerciseCount(workout)),
    formatPaperMinutes(workout.durationMinutes),
  ].join(' · ');
}

/** Session detail facts: `Yesterday · 8 min · 3 exercises · 12 sets`. */
export function formatSessionFacts(workout: LoggedWorkout, now = new Date()): string {
  return [
    formatHistoryWhen(workout.completedAt, now),
    formatPaperMinutes(workout.durationMinutes),
    formatExercisesCount(loggedExerciseCount(workout)),
    formatSetsCount(loggedSetCount(workout)),
  ].join(' · ');
}

/** Stripped exercise names for the newest session row. Stops at `max`, no overflow count. */
export function formatSessionExerciseStrip(workout: LoggedWorkout, max = 4): string {
  return workout.exercises
    .slice(0, max)
    .map((exercise) => stripLabel(exercise.exerciseName))
    .filter((label) => label.length > 0)
    .join(' · ');
}

const STRIP_SKIP = new Set([
  'barbell',
  'dumbbell',
  'dumbbells',
  'machine',
  'cable',
  'ez',
  'kettlebell',
  'smith',
  'band',
  'bands',
  'lever',
  'flat',
  'incline',
  'decline',
  'seated',
  'standing',
  'lying',
  'prone',
  'supine',
  'reverse',
  'assisted',
]);

const STRIP_BODY = new Set([
  'leg',
  'legs',
  'arm',
  'arms',
  'hip',
  'hips',
  'calf',
  'calves',
  'face',
  'chest',
  'back',
  'rear',
  'front',
  'lat',
  'lats',
]);

const STRIP_MOVEMENT = new Set([
  'press',
  'fly',
  'flye',
  'flyes',
  'raise',
  'raises',
  'row',
  'rows',
  'curl',
  'curls',
  'pull',
  'pulls',
  'extension',
  'extensions',
  'squat',
  'deadlift',
  'lunge',
  'dip',
  'dips',
  'pulldown',
  'pulldowns',
  'pushdown',
]);

const STRIP_NICKNAMES: Record<string, string> = {
  'romanian deadlift': 'RDL',
  'romanian deadlifts': 'RDL',
};

function joinStripParts(parts: string[]): string {
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0] ?? '';
  }
  const joined = parts.join(' ');
  const nick = STRIP_NICKNAMES[joined.toLowerCase()];
  if (nick) {
    return nick;
  }
  const head = parts[0] ?? '';
  const tail = parts[parts.length - 1] ?? '';
  if (parts.length === 2 && STRIP_MOVEMENT.has(tail.toLowerCase()) && !STRIP_BODY.has(head.toLowerCase())) {
    return head;
  }
  if (joined.length <= 12) {
    return joined;
  }
  if (parts.length > 2) {
    return joinStripParts(parts.slice(-2));
  }
  return head;
}

export function stripLabel(name: string): string {
  const trimmed = name.trim();
  const nick = STRIP_NICKNAMES[trimmed.toLowerCase()];
  if (nick) {
    return nick;
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  const kept = words.filter((word) => !STRIP_SKIP.has(word.toLowerCase()));
  const parts = kept.length > 0 ? kept : words;
  return joinStripParts(parts) || trimmed;
}

export type WeightUnit = 'kg' | 'lbs';

export type SetLineOptions = {
  minutes?: boolean;
  /** The user's weight unit. Every load carries it: `60 kg × 8`, not `60 × 8`. */
  unit?: WeightUnit | null;
};

/** `60 kg`, or `60` when no unit is known. */
export function formatLoadWithUnit(value: number, unit?: WeightUnit | null): string {
  return unit ? `${formatLoad(value)} ${unit}` : formatLoad(value);
}

export function formatLoggedSetLine(
  set: Pick<LoggedSet, 'weight' | 'reps' | 'counterweight' | 'durationSeconds'>,
  options?: SetLineOptions,
): string {
  const load = set.weight ?? set.counterweight;
  if (load != null && set.reps != null) {
    return `${formatLoadWithUnit(load, options?.unit)} × ${set.reps}`;
  }
  if (set.reps != null && load == null) {
    return `${set.reps} reps`;
  }
  if (set.durationSeconds != null) {
    if (options?.minutes) {
      return `${Math.max(1, Math.round(set.durationSeconds / 60))} min`;
    }
    return `${set.durationSeconds}s`;
  }
  if (load != null) {
    return formatLoadWithUnit(load, options?.unit);
  }
  return '—';
}

function formatLoad(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function parseSetsTimesReps(value: string): { sets: number; reps: number } | null {
  const match = value.trim().match(/^(\d+)\s*[×xX]\s*(\d+)$/);
  if (!match) {
    return null;
  }
  const sets = Number(match[1]);
  const reps = Number(match[2]);
  if (!Number.isFinite(sets) || !Number.isFinite(reps) || sets < 1 || reps < 1) {
    return null;
  }
  return { sets: Math.min(99, sets), reps: Math.min(99, reps) };
}

export function ordinal(value: number): string {
  const teen = value % 100;
  if (teen >= 11 && teen <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
