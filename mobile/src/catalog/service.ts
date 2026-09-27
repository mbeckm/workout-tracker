import { BUNDLED_BY_ID, BUNDLED_EXERCISES, bundledSearchAliases } from './bundled';
import {
  cachedItemsForQuery,
  recentCatalogItemIDs,
  recentCatalogItems,
  saveCatalogQuery,
  saveSelectedCatalogItem,
} from './cache';
import { CATALOG } from './config';
import {
  catalogItemFromCustom,
  catalogItemFromPrescription,
  catalogItemId,
  catalogKey,
  prescriptionFromCatalogItem,
} from './prescription';
import { fetchCatalogSearch } from './provider';
import { exerciseCatalogNameMatches, rankCatalogItems, uniqueCatalogExercises } from './ranker';
import { normalizedExerciseCatalogKey } from './text';
import type {
  ExerciseCatalogItem,
  ExerciseCatalogNotice,
  ExerciseCatalogSearchResponse,
} from './types';
import { ExerciseCatalogError } from './types';
import type { CustomExerciseDefinition, ExercisePrescription } from '@/domain/types';

function availableCustom(customExercises: CustomExerciseDefinition[]): CustomExerciseDefinition[] {
  return customExercises.filter((item) => item.isArchived !== true);
}

const SEED_ITEMS = BUNDLED_EXERCISES.map(catalogItemFromPrescription);
const SEED_PRIORITY_NAMES = SEED_ITEMS.map((item) => normalizedExerciseCatalogKey(item.name));

function customCatalogItems(customExercises: CustomExerciseDefinition[]): ExerciseCatalogItem[] {
  return availableCustom(customExercises).map(catalogItemFromCustom);
}

export function offlineCatalogExercises(
  customExercises: CustomExerciseDefinition[],
): ExercisePrescription[] {
  return [
    ...customCatalogItems(customExercises).map((item) => prescriptionFromCatalogItem(item)),
    ...BUNDLED_EXERCISES,
  ];
}

/** Name match, or a catalog-only alias match for bundled rows ("RDL", "OHP"). */
function localItemMatches(item: ExerciseCatalogItem, query: string): boolean {
  if (exerciseCatalogNameMatches(item.name, query)) {
    return true;
  }
  if (item.customExerciseID) {
    return false;
  }
  return bundledSearchAliases(item.sourceId).some((alias) => exerciseCatalogNameMatches(alias, query));
}

function matchingLocalItems(
  query: string,
  customExercises: CustomExerciseDefinition[],
): ExerciseCatalogItem[] {
  return [...customCatalogItems(customExercises), ...SEED_ITEMS].filter((item) =>
    localItemMatches(item, query),
  );
}

/** Bundled rows come back exactly as shipped (names, metadata); custom rows as in browse. */
function localPrescription(item: ExerciseCatalogItem): ExercisePrescription {
  const bundled = !item.customExerciseID && item.sourceId ? BUNDLED_BY_ID.get(item.sourceId) : undefined;
  return bundled ?? prescriptionFromCatalogItem(item);
}

const LOCAL_RESULT_LIMIT = 50;

/** Exact name or exact alias ("rdl" → Romanian Deadlift, "dip" → Dip). */
function isExactLocalMatch(item: ExerciseCatalogItem, normalizedQuery: string): boolean {
  if (normalizedExerciseCatalogKey(item.name) === normalizedQuery) {
    return true;
  }
  return (
    !item.customExerciseID &&
    bundledSearchAliases(item.sourceId).some(
      (alias) => normalizedExerciseCatalogKey(alias) === normalizedQuery,
    )
  );
}

/**
 * Ranked search over bundled + custom exercises. Synchronous and offline: this is the
 * whole production search while `CATALOG.remote` is off.
 *
 * Order: exact name/alias, then recently picked, then catalog order (custom first, then
 * the bundled file order, which is curated big lifts first). Catalog order beats word
 * position so "bench" leads with Flat Barbell Bench Press, not Bench Dip.
 */
export function searchLocalExercises(
  query: string,
  customExercises: CustomExerciseDefinition[],
  recentItemIDs: Set<string> = new Set(),
): ExercisePrescription[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return uniqueCatalogExercises(offlineCatalogExercises(customExercises));
  }
  const normalizedQuery = normalizedExerciseCatalogKey(trimmedQuery);
  const tier = (item: ExerciseCatalogItem) =>
    (isExactLocalMatch(item, normalizedQuery) ? 0 : 2) + (recentItemIDs.has(catalogItemId(item)) ? 0 : 1);
  const ranked = matchingLocalItems(trimmedQuery, customExercises)
    .map((item, index) => ({ item, index, tier: tier(item) }))
    .sort((left, right) => left.tier - right.tier || left.index - right.index)
    .map(({ item }) => localPrescription(item));
  return uniqueCatalogExercises(ranked, trimmedQuery).slice(0, LOCAL_RESULT_LIMIT);
}

function noticeForError(error: ExerciseCatalogError): ExerciseCatalogNotice {
  switch (error.code) {
    case 'rateLimited':
      return 'rateLimited';
    case 'offline':
      return 'offline';
    default:
      return 'unavailable';
  }
}

async function fallbackSearch(
  query: string,
  error: ExerciseCatalogError,
  customExercises: CustomExerciseDefinition[],
  recentItemIDs: Set<string>,
): Promise<ExerciseCatalogSearchResponse> {
  const cachedItems = await cachedItemsForQuery(query);
  const rankedItems = rankCatalogItems(
    [...(cachedItems ?? []), ...matchingLocalItems(query, customExercises)],
    query,
    SEED_PRIORITY_NAMES,
    recentItemIDs,
    20,
  );

  let notice: ExerciseCatalogNotice | null;
  if (rankedItems.length === 0) {
    notice = noticeForError(error);
  } else if (cachedItems && cachedItems.length > 0) {
    notice = 'cachedFallback';
  } else {
    notice = 'seedFallback';
  }

  return {
    exercises: uniqueCatalogExercises(
      rankedItems.map((item) => prescriptionFromCatalogItem(item)),
      query,
    ),
    notice,
  };
}

export async function searchExercises(
  query: string,
  customExercises: CustomExerciseDefinition[],
  signal?: AbortSignal,
): Promise<ExerciseCatalogSearchResponse> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      exercises: uniqueCatalogExercises(offlineCatalogExercises(customExercises)),
      notice: null,
    };
  }

  const recentItemIDs = await recentCatalogItemIDs();
  if (signal?.aborted) {
    throw new ExerciseCatalogError('aborted');
  }

  if (CATALOG.remote === 'off') {
    // Local-only: no network, no query cache writes, no notice.
    return {
      exercises: searchLocalExercises(trimmedQuery, customExercises, recentItemIDs),
      notice: null,
    };
  }

  try {
    const apiItems = await fetchCatalogSearch(trimmedQuery, 50, signal);
    const rankedItems = rankCatalogItems(
      [...apiItems, ...matchingLocalItems(trimmedQuery, customExercises)],
      trimmedQuery,
      SEED_PRIORITY_NAMES,
      recentItemIDs,
      20,
    );
    await saveCatalogQuery(trimmedQuery, rankedItems);
    return {
      exercises: uniqueCatalogExercises(
        rankedItems.map((item) => prescriptionFromCatalogItem(item)),
        trimmedQuery,
      ),
      notice: null,
    };
  } catch (error) {
    if (error instanceof ExerciseCatalogError && error.code === 'aborted') {
      throw error;
    }
    const catalogError =
      error instanceof ExerciseCatalogError ? error : new ExerciseCatalogError('unavailable');
    return fallbackSearch(trimmedQuery, catalogError, customExercises, recentItemIDs);
  }
}

export async function recordExerciseSelection(exercise: ExercisePrescription): Promise<void> {
  await saveSelectedCatalogItem(catalogItemFromPrescription(exercise));
}

/** Most recently selected exercises that still exist in the offline catalog. */
export async function recentOfflineExercises(
  customExercises: CustomExerciseDefinition[],
  limit = 4,
): Promise<ExercisePrescription[]> {
  const recentItems = await recentCatalogItems(limit * 2);
  if (recentItems.length === 0) {
    return [];
  }

  const offlineByKey = new Map(
    offlineCatalogExercises(customExercises).map((exercise) => [catalogKey(exercise), exercise]),
  );
  const recent: ExercisePrescription[] = [];
  for (const item of recentItems) {
    const prescription = prescriptionFromCatalogItem(item);
    const match = offlineByKey.get(catalogKey(prescription));
    if (!match) {
      continue;
    }
    recent.push(match);
    if (recent.length >= limit) {
      break;
    }
  }
  return recent;
}
