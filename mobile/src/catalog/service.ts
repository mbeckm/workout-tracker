import { BUNDLED_EXERCISES } from './bundled';
import {
  cachedItemsForQuery,
  recentCatalogItemIDs,
  recentCatalogItems,
  saveCatalogQuery,
  saveSelectedCatalogItem,
} from './cache';
import {
  catalogItemFromCustom,
  catalogItemFromPrescription,
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

function matchingLocalItems(
  query: string,
  customExercises: CustomExerciseDefinition[],
): ExerciseCatalogItem[] {
  return [...customCatalogItems(customExercises), ...SEED_ITEMS].filter((item) =>
    exerciseCatalogNameMatches(item.name, query),
  );
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
