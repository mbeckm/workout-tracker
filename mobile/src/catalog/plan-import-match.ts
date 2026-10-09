/**
 * Import plan, step two: matches parsed lifts (`domain/plan-import.ts`) to Trim's catalog with
 * the shipped offline search, and builds the plan to save. Offline, no network.
 *
 * A lift is recognized only when there's no doubt (decision 91): the owner's words are a catalog
 * name or alias, word for word (spelling, plurals and DB/BB aside; equipment the row already uses
 * may be said or not). Anything else the search finds is a guess: the lift goes to Fix like an
 * unknown one, with the guess as its first choice. So "Chest-supported row" is a guess at
 * Chest-Supported Dumbbell Row (dumbbell wasn't said), "Weighted chin-ups" at Chin-Up (weighted
 * was dropped), "Calf raise" at Standing Calf Raise (seated fits too). "Hip airplane" finds
 * nothing and stays unknown; single generic words ("Press") only ever suggest alternatives.
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
  /** The catalog/custom lift when it's recognized beyond doubt; null when unknown or a guess. */
  exercise: ExercisePrescription | null;
  /** Up to 3 choices for the Fix screen, the guess first when there is one (empty when matched). */
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
  [/\bdumbbells\b/g, 'dumbbell'],
];

/** What the search looks past to find the base lift. A match without it is only a guess. */
const SEARCH_SKIPS = /\bweighted\s+/g;

function spelled(query: string): string {
  return SPELLINGS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), query.toLowerCase()).trim();
}

/**
 * Plain gym names that mean one catalog row in a plan, on top of the catalog's names and search
 * aliases. Import-only: the picker's search doesn't use them.
 */
const PLAN_NAMES: Readonly<Record<string, readonly string[]>> = {
  'bundled-flat-barbell-bench-press': ['Bench Press', 'Bench'],
  'bundled-barbell-back-squat': ['Back Squat', 'Squat'],
};

const FILLER_WORDS = new Set(['a', 'an', 'the', 'with', 'of', 'on']);
const SHORT_WORDS: Record<string, string> = { db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell' };

function singular(word: string): string {
  if (/(?:ch|sh|ss|x)es$/.test(word)) return word.slice(0, -2);
  return word.length >= 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

/** A name's words for comparing: spelled, singular, shorthand spelled out, filler dropped. */
function wordSet(value: string): Set<string> {
  const text = spelled(value).replace(/\bbody\s*weight\b/g, 'bodyweight').replace(/\bez[\s-]*bar\b/g, 'ezbar');
  return new Set(
    normalizedExerciseCatalogWords(text)
      .filter((word) => !FILLER_WORDS.has(word))
      .map((word) => SHORT_WORDS[word] ?? singular(word)),
  );
}

function namesFor(exercise: ExercisePrescription): readonly string[] {
  if (exercise.customExerciseID) return [exercise.name];
  return [exercise.name, ...bundledSearchAliases(exercise.id), ...(PLAN_NAMES[exercise.id] ?? [])];
}

/**
 * The owner's words say exactly this lift: they equal its name or an alias, word for word,
 * except for equipment the row itself uses ("Lat Pulldown (Cable)" is Lat Pulldown). Nothing
 * added that they didn't say, nothing they said dropped.
 */
function clearlyIs(lift: ImportedLift, exercise: ExercisePrescription): boolean {
  const said = wordSet(`${lift.name} ${lift.qualifier ?? ''}`);
  const kit = wordSet(exercise.equipments.join(' '));
  return namesFor(exercise).some((name) => {
    const words = wordSet(name);
    const meant = [...said].filter((word) => words.has(word) || !kit.has(word));
    return meant.length === words.size && meant.every((word) => words.has(word));
  });
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
  return [...new Set(queries.map((query) => spelled(query).replace(SEARCH_SKIPS, '').trim()).filter(Boolean))];
}

function isExactHit(exercise: ExercisePrescription, query: string): boolean {
  const key = normalizedExerciseCatalogKey(query);
  return (
    normalizedExerciseCatalogKey(exercise.name) === key ||
    bundledSearchAliases(exercise.id).some((alias) => normalizedExerciseCatalogKey(alias) === key)
  );
}

/** The lift it clearly is (`sure`), else the best guess: Claude's pick first, then the search's. */
function bestMatch(
  lift: ImportedLift,
  customExercises: CustomExerciseDefinition[],
): { exercise: ExercisePrescription | null; sure: boolean } {
  let guess: ExercisePrescription | null = null;
  const suggestion = lift.suggestion?.trim();
  if (suggestion) {
    const picked = searchLocalExercises(suggestion, customExercises).find((hit) => isExactHit(hit, suggestion)) ?? null;
    if (picked && clearlyIs(lift, picked)) {
      return { exercise: picked, sure: true };
    }
    guess = picked;
  }
  for (const query of queriesFor(lift)) {
    const queryWords = normalizedExerciseCatalogWords(query);
    if (queryWords.length === 0 || (queryWords.length === 1 && GENERIC_WORDS.has(queryWords[0]))) {
      continue;
    }
    const hits = searchLocalExercises(query, customExercises);
    const clear = hits.find((hit) => clearlyIs(lift, hit));
    if (clear) {
      return { exercise: clear, sure: true };
    }
    guess ??= hits[0] ?? null;
  }
  // "Dumbbell lateral raise" is Lateral Raises, a dumbbell lift. Without its equipment the name
  // only ever finds the lift it clearly is, never a guess (that could be another kit's variant).
  const bare = spelled(lift.name)
    .split(/\s+/)
    .filter((word) => !EQUIPMENT_WORDS.has(word))
    .join(' ');
  if (bare && bare !== spelled(lift.name)) {
    const clear = searchLocalExercises(bare, customExercises).find((hit) => clearlyIs(lift, hit));
    if (clear) {
      return { exercise: clear, sure: true };
    }
  }
  return { exercise: guess, sure: false };
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
      lifts: day.lifts.map((lift): LiftMatch => {
        const { exercise, sure } = bestMatch(lift, customExercises);
        if (sure) {
          return { lift, exercise, alternatives: [] };
        }
        // A guess is asked about like an unknown lift, offered first (decision 91).
        const closest = alternativesFor(lift, customExercises).filter((other) => other.id !== exercise?.id);
        return { lift, exercise: null, alternatives: (exercise ? [exercise, ...closest] : closest).slice(0, 3) };
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
