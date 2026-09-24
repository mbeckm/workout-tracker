/**
 * The in-progress log session: drafts, restore rules and the small pure helpers the
 * log screen and the store share. No React, no storage: safe to unit-test with tsx.
 */
import {
  emptyLoggedSet,
  formatLoggedSetLine,
  repsForSet,
  setCount,
  tenRMForSet,
} from '@/domain/helpers';
import type {
  ExercisePrescription,
  LoggedSet,
  LoggedWorkout,
  WorkoutDay,
  WorkoutPlan,
} from '@/domain/types';
import { normalizedStatsKey } from '@/domain/types';

export type DraftSet = LoggedSet & {
  done: boolean;
  /** Added in the log with + Add set. Session-only: never written to the plan. */
  extra?: boolean;
};

export type DraftExercise = {
  prescription: ExercisePrescription;
  sets: DraftSet[];
  /**
   * Restored from a saved session after the exercise left the plan day. Kept only
   * because it has logged sets; never written back to the plan.
   */
  orphan?: boolean;
};

export type RestWindow = {
  startedAtMs: number;
  endsAtMs: number;
};

/** What the store persists for the open log. One at a time. */
export type LogSession = {
  planId: string;
  dayId: string;
  /** ISO. Workout start; duration is measured from here. */
  startedAt: string;
  /** ISO. Last time a set changed (logged, edited, added, undone). */
  updatedAt: string;
  exerciseIndex: number;
  drafts: DraftExercise[];
  rest: RestWindow | null;
};

/** After this much quiet since the last set, Finish stops counting the clock. */
export const SESSION_IDLE_TAIL_MS = 10 * 60 * 1000;

export function buildDrafts(
  exercises: ExercisePrescription[],
  previousSetsForExercise: (name: string) => LoggedSet[],
): DraftExercise[] {
  return exercises.map((exercise) => {
    const history = previousSetsForExercise(exercise.name);
    const lastLogged = history[history.length - 1] ?? null;
    return {
      prescription: exercise,
      sets: Array.from({ length: setCount(exercise) }, (_, index) => {
        const previous = history[index] ?? lastLogged;
        return {
          ...emptyLoggedSet(index + 1, previous),
          reps: previous?.reps ?? repsForSet(exercise, index),
          durationSeconds: previous?.durationSeconds ?? exercise.durationSeconds ?? null,
          done: false,
        };
      }),
    };
  });
}

type HasDoneSets = { sets: readonly { done: boolean }[] };

export function exerciseIsComplete(exercise: HasDoneSets | undefined): boolean {
  return Boolean(exercise && exercise.sets.length > 0 && exercise.sets.every((set) => set.done));
}

export function loggedSetCount(drafts: readonly HasDoneSets[]): number {
  return drafts.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
}

export function unloggedSetCount(drafts: readonly HasDoneSets[]): number {
  return drafts.reduce((sum, exercise) => sum + exercise.sets.filter((set) => !set.done).length, 0);
}

/**
 * Next exercise with work left after `from`. Wraps to earlier exercises unless
 * `wrap: false` (auto-advance only moves forward). -1 = none.
 */
export function nextIncompleteIndex(
  drafts: readonly HasDoneSets[],
  from: number,
  options?: { wrap?: boolean },
): number {
  const count = drafts.length;
  const wrap = options?.wrap ?? true;
  for (let step = 1; step <= count; step += 1) {
    if (!wrap && from + step >= count) {
      return -1;
    }
    const index = (from + step) % count;
    if (!exerciseIsComplete(drafts[index])) {
      return index;
    }
  }
  return -1;
}

/**
 * Rebuild the log from a saved session against the plan as it is now.
 * - Same exercise id and name: saved sets win (logged work, typed values, added sets).
 * - New in the plan since: fresh drafts from history.
 * - Gone from the plan but with logged sets: kept at the end as an orphan, so a
 *   plan edit never silently deletes work. Gone with nothing logged: dropped.
 */
export function restoreDrafts(
  session: Pick<LogSession, 'drafts'>,
  day: WorkoutDay,
  previousSetsForExercise: (name: string) => LoggedSet[],
): DraftExercise[] {
  const saved = new Map(session.drafts.map((draft) => [draft.prescription.id, draft]));
  const restored: DraftExercise[] = [];
  const orphans: DraftExercise[] = [];

  for (const prescription of day.exercises) {
    const match = saved.get(prescription.id);
    saved.delete(prescription.id);
    if (match && sameExercise(match.prescription, prescription)) {
      restored.push({ prescription, sets: match.sets });
      continue;
    }
    if (match && match.sets.some((set) => set.done)) {
      orphans.push({ ...match, orphan: true });
    }
    restored.push(...buildDrafts([prescription], previousSetsForExercise));
  }

  for (const leftover of saved.values()) {
    if (leftover.sets.some((set) => set.done)) {
      orphans.push({ ...leftover, orphan: true });
    }
  }

  return [...restored, ...orphans];
}

function sameExercise(left: ExercisePrescription, right: ExercisePrescription): boolean {
  return normalizedStatsKey(left.name) === normalizedStatsKey(right.name);
}

export type OpenedLog = {
  drafts: DraftExercise[];
  exerciseIndex: number;
  startedAt: string;
  updatedAt: string;
  rest: RestWindow | null;
  /** True when the log continues a saved session for this plan/day. */
  restored: boolean;
};

/**
 * What the log shows when it opens for `planId`/`day`: the saved session when it is
 * for this same plan and day (restore), else fresh drafts from history.
 */
export function openLogSession(input: {
  planId: string | undefined;
  day: WorkoutDay | undefined;
  session: LogSession | null;
  previousSetsForExercise: (name: string) => LoggedSet[];
  nowMs?: number;
}): OpenedLog {
  const { planId, day, session, previousSetsForExercise, nowMs = Date.now() } = input;
  if (day && session && session.planId === planId && session.dayId === day.id) {
    const drafts = restoreDrafts(session, day, previousSetsForExercise);
    const focusedId = session.drafts[session.exerciseIndex]?.prescription.id;
    const focused = drafts.findIndex((draft) => draft.prescription.id === focusedId);
    return {
      drafts,
      exerciseIndex: clampExerciseIndex(focused >= 0 ? focused : session.exerciseIndex, drafts.length),
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      rest: liveRest(session.rest, nowMs),
      restored: true,
    };
  }
  const startedAt = new Date(nowMs).toISOString();
  return {
    drafts: day ? buildDrafts(day.exercises, previousSetsForExercise) : [],
    exerciseIndex: 0,
    startedAt,
    updatedAt: startedAt,
    rest: null,
    restored: false,
  };
}

export function findSessionDay(
  session: Pick<LogSession, 'planId' | 'dayId'>,
  plans: readonly WorkoutPlan[],
): { plan: WorkoutPlan; day: WorkoutDay } | null {
  const plan = plans.find((item) => item.id === session.planId);
  const day = plan?.days.find((item) => item.id === session.dayId);
  return plan && day ? { plan, day } : null;
}

/** A session survives only while its plan and day do (plan deleted, day removed → dropped). */
export function sessionStillValid(
  session: LogSession | null,
  plans: readonly WorkoutPlan[],
): LogSession | null {
  return session && findSessionDay(session, plans) ? session : null;
}

/** Finish / discard: clear the session, or only when it is `match`'s plan and day. */
export function clearedSession(
  session: LogSession | null,
  match?: { planId: string; dayId: string },
): LogSession | null {
  if (!session) {
    return null;
  }
  if (match && (session.planId !== match.planId || session.dayId !== match.dayId)) {
    return session;
  }
  return null;
}

/** A completed workout closes the session for its own plan/day and leaves any other alone. */
export function sessionAfterWorkout(
  session: LogSession | null,
  workout: { planId?: string | null; dayId?: string | null },
): LogSession | null {
  if (!session || !workout.planId || !workout.dayId) {
    return session;
  }
  return clearedSession(session, { planId: workout.planId, dayId: workout.dayId });
}

export function clampExerciseIndex(index: number, count: number): number {
  if (!Number.isFinite(index) || count <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(count - 1, Math.trunc(index)));
}

/** A rest window that is still running at `nowMs`, else null. */
export function liveRest(rest: RestWindow | null | undefined, nowMs: number): RestWindow | null {
  if (!rest || !Number.isFinite(rest.endsAtMs) || rest.endsAtMs <= nowMs) {
    return null;
  }
  return rest;
}

/**
 * Minutes from start to finish. If the app sat idle after the last set (killed and
 * resumed later, or left open), stop the clock a short tail after the last change.
 */
export function sessionDurationMinutes(
  startedAt: string,
  updatedAt: string | null,
  nowMs: number = Date.now(),
): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) {
    return 1;
  }
  const last = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  const end = Number.isFinite(last) ? Math.min(nowMs, Math.max(last, start) + SESSION_IDLE_TAIL_MS) : nowMs;
  return Math.max(1, Math.round((end - start) / 60_000));
}

// ---------------------------------------------------------------------------
// Validation (persisted JSON is untrusted: older builds, partial writes)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeDraftSet(raw: unknown, index: number): DraftSet | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    index: finiteOrNull(raw.index) ?? index + 1,
    weight: finiteOrNull(raw.weight),
    reps: finiteOrNull(raw.reps),
    counterweight: finiteOrNull(raw.counterweight),
    durationSeconds: finiteOrNull(raw.durationSeconds),
    distanceMeters: finiteOrNull(raw.distanceMeters),
    done: raw.done === true,
    ...(raw.extra === true ? { extra: true } : {}),
  };
}

function normalizeDraftExercise(raw: unknown): DraftExercise | null {
  if (!isRecord(raw) || !isRecord(raw.prescription) || !Array.isArray(raw.sets)) {
    return null;
  }
  const prescription = raw.prescription as ExercisePrescription;
  if (typeof prescription.id !== 'string' || typeof prescription.name !== 'string') {
    return null;
  }
  const sets = raw.sets
    .map((set, index) => normalizeDraftSet(set, index))
    .filter((set): set is DraftSet => set != null);
  if (sets.length === 0) {
    return null;
  }
  return {
    prescription: {
      ...prescription,
      bodyParts: Array.isArray(prescription.bodyParts) ? prescription.bodyParts : [],
      targetMuscles: Array.isArray(prescription.targetMuscles) ? prescription.targetMuscles : [],
      secondaryMuscles: Array.isArray(prescription.secondaryMuscles)
        ? prescription.secondaryMuscles
        : [],
      equipments: Array.isArray(prescription.equipments) ? prescription.equipments : [],
      imageURLs: {},
      thumbnailURL: null,
      imageURL: null,
      videoURL: null,
    },
    sets,
    ...(raw.orphan === true ? { orphan: true } : {}),
  };
}

/**
 * Validate a persisted session. Dropped (null) when malformed or when its plan or
 * day no longer exists: a stale session must never open a log for nothing.
 */
export function normalizeLogSession(
  raw: unknown,
  plans: readonly WorkoutPlan[],
): LogSession | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { planId, dayId, startedAt } = raw;
  if (typeof planId !== 'string' || typeof dayId !== 'string' || typeof startedAt !== 'string') {
    return null;
  }
  if (!Number.isFinite(Date.parse(startedAt))) {
    return null;
  }
  if (!findSessionDay({ planId, dayId }, plans)) {
    return null;
  }
  const drafts = Array.isArray(raw.drafts)
    ? raw.drafts
        .map(normalizeDraftExercise)
        .filter((draft): draft is DraftExercise => draft != null)
    : [];
  const updatedAt =
    typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : startedAt;
  const rest = isRecord(raw.rest)
    ? (() => {
        const startedAtMs = finiteOrNull(raw.rest.startedAtMs);
        const endsAtMs = finiteOrNull(raw.rest.endsAtMs);
        return startedAtMs != null && endsAtMs != null ? { startedAtMs, endsAtMs } : null;
      })()
    : null;
  return {
    planId,
    dayId,
    startedAt,
    updatedAt,
    exerciseIndex: clampExerciseIndex(finiteOrNull(raw.exerciseIndex) ?? 0, Math.max(drafts.length, 1)),
    drafts,
    rest,
  };
}

// ---------------------------------------------------------------------------
// Facts for the log stage and the exercise sheet

/** Last session's set at the same position (falls back to its last set). */
export function lastTimeSetFor(
  previousSets: readonly LoggedSet[] | null | undefined,
  setIndex: number,
): LoggedSet | null {
  if (!previousSets || previousSets.length === 0) {
    return null;
  }
  return previousSets[Math.max(0, setIndex)] ?? previousSets[previousSets.length - 1] ?? null;
}

/**
 * `Last time 72.5 × 8` for the set on the stage (0-based), or `Last time 80 × 8 · 8 · 7`
 * for the whole last session (`'all'`, exercise done). Null when there is no history.
 */
export function lastTimeText(
  previousSets: readonly LoggedSet[] | null | undefined,
  setIndex: number | 'all',
  options?: { minutes?: boolean },
): string | null {
  if (!previousSets || previousSets.length === 0) {
    return null;
  }
  if (setIndex === 'all') {
    return `Last time ${formatSetsCompact(previousSets, options)}`;
  }
  const set = lastTimeSetFor(previousSets, setIndex);
  return set ? `Last time ${formatLoggedSetLine(set, options)}` : null;
}

/** `80 × 8 · 8 · 7` when the load is constant, else `80 × 8 · 85 × 6`. Units never ride along. */
export function formatSetsCompact(
  sets: readonly LoggedSet[],
  options?: { minutes?: boolean },
): string {
  if (sets.length === 0) {
    return '—';
  }
  const loads = sets.map((set) => set.weight ?? set.counterweight ?? null);
  const allReps = sets.every((set) => set.reps != null);
  const firstLoad = loads[0];
  if (allReps && firstLoad != null && loads.every((load) => load === firstLoad)) {
    const [first, ...rest] = sets;
    const head = formatLoggedSetLine({ weight: firstLoad, reps: first?.reps });
    return [head, ...rest.map((set) => String(set.reps))].join(' · ');
  }
  if (allReps && loads.every((load) => load == null)) {
    return sets.map((set) => String(set.reps)).join(' · ');
  }
  return sets.map((set) => formatLoggedSetLine(set, options)).join(' · ');
}

export type BestSet = { set: LoggedSet; completedAt: string };

/**
 * Best logged set for an exercise: highest estimated 10RM when it has load, else the
 * most reps, else the longest hold. Ties go to the most recent.
 */
export function bestSetForExercise(
  history: readonly LoggedWorkout[],
  name: string,
): BestSet | null {
  const key = normalizedStatsKey(name);
  let best: { score: [number, number, number]; entry: BestSet } | null = null;
  for (const workout of history) {
    for (const exercise of workout.exercises) {
      if (normalizedStatsKey(exercise.exerciseName) !== key) {
        continue;
      }
      for (const set of exercise.sets) {
        const score: [number, number, number] = [
          tenRMForSet(set) ?? 0,
          set.reps ?? 0,
          set.durationSeconds ?? 0,
        ];
        if (score.every((value) => value === 0)) {
          continue;
        }
        if (!best || compareScore(score, best.score) > 0) {
          best = { score, entry: { set, completedAt: workout.completedAt } };
        }
      }
    }
  }
  return best?.entry ?? null;
}

function compareScore(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < left.length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (Math.abs(delta) > 1e-9) {
      return delta;
    }
  }
  return 0;
}

/** `Sep 22` (adds the year when it isn't this year). */
export function formatShortDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}
