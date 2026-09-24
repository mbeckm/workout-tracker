import { catalogItemId, catalogKey } from './prescription';
import { normalizedExerciseCatalogKey, normalizedExerciseCatalogWords } from './text';
import type { ExerciseCatalogItem } from './types';
import type { ExercisePrescription } from '@/domain/types';

/** Gym shorthand typed as one query word. Matched in addition to the literal token. */
const QUERY_TOKEN_SYNONYMS: Record<string, string> = {
  db: 'dumbbell',
  bb: 'barbell',
};

/**
 * Plural-tolerant prefix match. Name words already match by prefix ("tricep" finds
 * "Triceps"), so only the query side needs the plural dropped: a trailing `s` (not `ss`)
 * is stripped for words of 4+ letters ("triceps" finds "Tricep Pushdowns"), and a short
 * plural matches its whole singular word ("ups" finds "Push-Up", "abs" finds "Ab Wheel"
 * but not "Abduction").
 */
function queryWordMatches(token: string, word: string): boolean {
  if (word.startsWith(token)) {
    return true;
  }
  if (!token.endsWith('s') || token.endsWith('ss')) {
    return false;
  }
  const stem = token.slice(0, -1);
  return token.length >= 4 ? word.startsWith(stem) : word === stem;
}

/** Ordered word-prefix match: every query word starts a later name word, in order. */
export function exerciseCatalogNameMatches(name: string, query: string): boolean {
  const queryTokens = normalizedExerciseCatalogWords(query);
  if (queryTokens.length === 0) {
    return false;
  }

  const nameWords = normalizedExerciseCatalogWords(name);
  if (nameWords.length === 0) {
    return false;
  }

  let wordIndex = 0;
  for (const token of queryTokens) {
    const synonym = QUERY_TOKEN_SYNONYMS[token];
    let matched = false;
    while (wordIndex < nameWords.length) {
      const word = nameWords[wordIndex] ?? '';
      if (queryWordMatches(token, word) || (synonym != null && word.startsWith(synonym))) {
        matched = true;
        wordIndex += 1;
        break;
      }
      wordIndex += 1;
    }
    if (!matched) {
      return false;
    }
  }

  return true;
}

function scoreForItem(
  item: ExerciseCatalogItem,
  query: string,
  priorityLookup: Map<string, number>,
  recentItemIDs: Set<string>,
): number {
  const normalizedName = normalizedExerciseCatalogKey(item.name);
  const normalizedQuery = normalizedExerciseCatalogKey(query);
  const nameWords = normalizedExerciseCatalogWords(item.name);
  let score = 10_000;

  const priorityIndex = priorityLookup.get(normalizedName);
  if (priorityIndex != null) {
    score = priorityIndex;
  }

  if (recentItemIDs.has(catalogItemId(item))) {
    score -= 500;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    score -= 300;
  }

  const firstToken = normalizedExerciseCatalogWords(query)[0];
  if (firstToken) {
    const firstMatchIndex = nameWords.findIndex((word) => word.startsWith(firstToken));
    if (firstMatchIndex >= 0) {
      score += firstMatchIndex * 20;
    }
  }

  score += nameWords.length;
  return score;
}

type CatalogDisplayItem = {
  name: string;
  customExerciseID?: string | null;
  thumbnailURL?: string | null;
  imageURL?: string | null;
  imageURLs?: Record<string, string>;
};

function hasCatalogMedia(item: CatalogDisplayItem): boolean {
  return Boolean(item.thumbnailURL ?? item.imageURL ?? item.imageURLs?.['360p']);
}

function nameMatchQuality(name: string, query: string): number {
  const normalizedQuery = normalizedExerciseCatalogKey(query);
  if (!normalizedQuery) {
    return 0;
  }
  const normalizedName = normalizedExerciseCatalogKey(name);
  if (normalizedName === normalizedQuery) {
    return 0;
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return 1;
  }
  return 2 + normalizedExerciseCatalogWords(name).length;
}

function preferCatalogItem(
  candidate: CatalogDisplayItem,
  current: CatalogDisplayItem,
  query = '',
): boolean {
  if (candidate.customExerciseID && !current.customExerciseID) {
    return true;
  }
  if (current.customExerciseID && !candidate.customExerciseID) {
    return false;
  }
  if (normalizedExerciseCatalogKey(query)) {
    const candidateQuality = nameMatchQuality(candidate.name, query);
    const currentQuality = nameMatchQuality(current.name, query);
    if (candidateQuality !== currentQuality) {
      return candidateQuality < currentQuality;
    }
  }
  if (hasCatalogMedia(candidate) && !hasCatalogMedia(current)) {
    return true;
  }
  return false;
}

function uniqueByKey<T>(
  items: T[],
  keyOf: (item: T) => string,
  prefer: (candidate: T, current: T) => boolean,
): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = best.get(key);
    if (!existing || prefer(item, existing)) {
      best.set(key, item);
    }
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (best.get(key) !== item || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** Collapse aliases that share a catalog identity or display name so one row is selectable. */
export function uniqueCatalogExercises(
  exercises: ExercisePrescription[],
  query = '',
): ExercisePrescription[] {
  const prefer = (candidate: ExercisePrescription, current: ExercisePrescription) =>
    preferCatalogItem(candidate, current, query);
  return uniqueByKey(
    uniqueByKey(exercises, catalogKey, prefer),
    (item) => normalizedExerciseCatalogKey(item.name),
    prefer,
  );
}

export function rankCatalogItems(
  items: ExerciseCatalogItem[],
  query: string,
  priorityNames: string[],
  recentItemIDs: Set<string>,
  limit: number,
): ExerciseCatalogItem[] {
  const priorityLookup = new Map(priorityNames.map((name, index) => [name, index]));
  const scored = uniqueByKey(
    items.filter(
      (item) => Boolean(item.providerExerciseId) || exerciseCatalogNameMatches(item.name, query),
    ),
    catalogItemId,
    (candidate, current) => preferCatalogItem(candidate, current, query),
  )
    .sort((left, right) => {
      return (
        scoreForItem(left, query, priorityLookup, recentItemIDs) -
        scoreForItem(right, query, priorityLookup, recentItemIDs)
      );
    })
    .slice(0, limit);

  return uniqueByKey(
    scored,
    (item) => normalizedExerciseCatalogKey(item.name),
    (candidate, current) => preferCatalogItem(candidate, current, query),
  );
}
