/**
 * Import plan, step two: matches parsed lifts (`domain/plan-import.ts`) to Trim's catalog with
 * the shipped offline search, and builds the plan to save. Offline, no network.
 *
 * A match must be confident: the search must find every word of the name ("Hip airplane" finds
 * nothing, so it stays unknown; single words only ever suggest alternatives).
 */
import { bundledSearchAliases } from './bundled';
import { searchLocalExercises } from './service';
import { normalizedExerciseCatalogKey, normalizedExerciseCatalogWords } from './text';
import { clonePrescription, usesDuration, usesReps } from '@/domain/helpers';
import { newId } from '@/domain/id';
import type { ImportedLift, ParsedPlan } from '@/domain/plan-import';
import type {
  CustomExerciseDefinition,
  ExercisePrescription,
  WorkoutDay,
  WorkoutPlan,
} from '@/domain/types';
import { withPrescriptionDefaults } from '@/device/plans-model';

export type LiftMatch = {
  lift: ImportedLift;
  /** A confident catalog/custom match, or null when unknown. */
  exercise: ExercisePrescription | null;
  /** Up to 3 closest catalog lifts for the Fix screen (empty when matched). */
  alternatives: ExercisePrescription[];
};

/** `title` falls back to `Day n`. */
export type DayMatch = { title: string; lifts: LiftMatch[] };

/** `name` is '' when unknown. */
export type PlanMatch = { name: string; days: DayMatch[] };

const EQUIPMENT_WORDS = new Set([
  'barbell', 'dumbbell', 'dumbbells', 'cable', 'machine', 'smith', 'smith machine', 'kettlebell',
  'band', 'bands', 'bodyweight', 'body weight', 'ez bar', 'ez-bar', 'trap bar', 'plate',
]);

/** One word that names a family, not a lift: alone it only suggests alternatives. */
const GENERIC_WORDS = new Set([
  'press', 'presses', 'row', 'rows', 'curl', 'curls', 'raise', 'raises', 'fly', 'flys', 'extension',
  'extensions', 'pulldown', 'pushdown', 'lunge', 'lunges', 'crunch', 'stretch', 'hold', 'cardio',
]);

/** Words too common to suggest anything on their own. */
const STOPWORDS = new Set([
  'with', 'the', 'and', 'on', 'of', 'single', 'arm', 'leg', 'one', 'for', 'each', 'side', 'per',
  'using', 'grip', 'wide', 'close', 'narrow', 'seated', 'standing', 'weighted',
]);

/** Gym spellings the catalog words don't cover by prefix. */
const SPELLINGS: readonly [RegExp, string][] = [
  [/\bbiceps?\s+curl/g, 'curl'],
  [/\bfl(?:ye|ie)s?\b/g, 'fly'],
  [/\bpush\s*ups?\b/g, 'push-up'],
  [/\bsit\s*ups?\b/g, 'sit-up'],
  [/\bskull\s*crushers?\b/g, 'skull crusher'],
  [/\bweighted\s+/g, ''],
  [/\bdumbbells\b/g, 'dumbbell'],
];

function spelled(query: string): string {
  return SPELLINGS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), query.toLowerCase()).trim();
}

/** The searches to try for a lift, most specific first. */
function queriesFor(lift: ImportedLift): string[] {
  const queries: string[] = [];
  const qualifier = lift.qualifier?.trim().toLowerCase() ?? '';
  const names = [lift.name, ...lift.name.split(/\s+(?:\/|or)\s+|\s*\/\s*/i).slice(0, 1)];
  for (const name of names) {
    if (qualifier && EQUIPMENT_WORDS.has(qualifier)) {
      queries.push(`${qualifier} ${name}`, `${name} ${qualifier}`);
    }
    queries.push(name);
  }
  return [...new Set(queries.map(spelled).filter(Boolean))];
}

function isExactHit(exercise: ExercisePrescription, query: string): boolean {
  const key = normalizedExerciseCatalogKey(query);
  return (
    normalizedExerciseCatalogKey(exercise.name) === key ||
    bundledSearchAliases(exercise.id).some((alias) => normalizedExerciseCatalogKey(alias) === key)
  );
}

function confidentMatch(
  lift: ImportedLift,
  customExercises: CustomExerciseDefinition[],
): ExercisePrescription | null {
  let first: ExercisePrescription | null = null;
  for (const query of queriesFor(lift)) {
    const queryWords = normalizedExerciseCatalogWords(query);
    if (queryWords.length === 0 || (queryWords.length === 1 && GENERIC_WORDS.has(queryWords[0]))) {
      continue;
    }
    const hit = searchLocalExercises(query, customExercises)[0];
    if (!hit) {
      continue;
    }
    if (isExactHit(hit, query)) {
      return hit;
    }
    first ??= hit;
  }
  return first;
}

/** Up to three catalog lifts that share the most meaningful words with the name. */
function alternativesFor(
  lift: ImportedLift,
  customExercises: CustomExerciseDefinition[],
): ExercisePrescription[] {
  const scored = new Map<string, { exercise: ExercisePrescription; hits: number; order: number }>();
  let order = 0;
  const searchWords = normalizedExerciseCatalogWords(spelled(`${lift.name} ${lift.qualifier ?? ''}`));
  for (const word of new Set(searchWords)) {
    if (word.length < 3 || STOPWORDS.has(word)) {
      continue;
    }
    for (const exercise of searchLocalExercises(word, customExercises)) {
      const entry = scored.get(exercise.id);
      if (entry) {
        entry.hits += 1;
      } else {
        scored.set(exercise.id, { exercise, hits: 1, order: order++ });
      }
    }
  }
  return [...scored.values()]
    .sort((left, right) => right.hits - left.hits || left.order - right.order)
    .slice(0, 3)
    .map(({ exercise }) => exercise);
}

export function matchParsedPlan(parsed: ParsedPlan, customExercises: CustomExerciseDefinition[]): PlanMatch {
  return {
    name: parsed.name?.trim() ?? '',
    days: parsed.days.map((day, index) => ({
      title: day.title?.trim() || `Day ${index + 1}`,
      lifts: day.lifts.map((lift) => {
        const exercise = confidentMatch(lift, customExercises);
        return {
          lift,
          exercise,
          alternatives: exercise ? [] : alternativesFor(lift, customExercises),
        };
      }),
    })),
  };
}

export function liftKey(dayIndex: number, liftIndex: number): string {
  return `${dayIndex}:${liftIndex}`;
}

/** The catalog row as a fresh copy with the imported numbers; the row's defaults fill gaps. */
function importedPrescription(exercise: ExercisePrescription, lift: ImportedLift): ExercisePrescription {
  const copy = clonePrescription(exercise);
  const timed = usesDuration(copy.trackingMode) && !usesReps(copy.trackingMode);
  return withPrescriptionDefaults({
    ...copy,
    sets: lift.sets ?? copy.sets,
    reps: usesReps(copy.trackingMode) ? (lift.reps ?? copy.reps) : copy.reps,
    durationSeconds: timed && lift.seconds != null ? lift.seconds : copy.durationSeconds,
    repScheme: null,
  });
}

/**
 * Builds the plan to save. `resolved` maps a lift (by day index + lift index) to its final
 * exercise, or null to leave it out.
 */
export function planFromMatch(
  match: PlanMatch,
  resolved: ReadonlyMap<string, ExercisePrescription | null>,
  name: string,
): WorkoutPlan {
  const days: WorkoutDay[] = [];
  match.days.forEach((day, dayIndex) => {
    const exercises: ExercisePrescription[] = [];
    day.lifts.forEach((liftMatch, liftIndex) => {
      const key = liftKey(dayIndex, liftIndex);
      const exercise = resolved.has(key) ? resolved.get(key) : liftMatch.exercise;
      if (exercise) {
        exercises.push(importedPrescription(exercise, liftMatch.lift));
      }
    });
    if (exercises.length > 0) {
      days.push({ id: newId(), title: day.title, exercises });
    }
  });
  return {
    id: newId(),
    name: name.trim(),
    daysPerWeek: days.length,
    createdAt: new Date().toISOString(),
    days,
  };
}
