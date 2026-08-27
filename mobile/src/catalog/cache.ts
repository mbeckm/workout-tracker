import AsyncStorage from '@react-native-async-storage/async-storage';

import { catalogItemId } from './prescription';
import { normalizedExerciseCatalogKey } from './text';
import type { ExerciseCatalogItem } from './types';

const STORAGE_KEY = 'scratchWorkout.exerciseCatalog.v1';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = {
  createdAt: string;
  items: ExerciseCatalogItem[];
};

type CacheSnapshot = {
  queries: Record<string, CacheEntry>;
  selected: Record<string, ExerciseCatalogItem>;
  /** Most-recent-first catalog item ids. */
  recentOrder: string[];
};

const MAX_RECENT = 20;

const emptySnapshot = (): CacheSnapshot => ({ queries: {}, selected: {}, recentOrder: [] });

let memory: CacheSnapshot | null = null;
let loadPromise: Promise<CacheSnapshot> | null = null;

function isCacheSnapshot(value: unknown): value is CacheSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as { queries?: unknown; selected?: unknown };
  return record.queries != null && typeof record.queries === 'object' && !Array.isArray(record.queries);
}

function normalizeRecentOrder(
  recentOrder: unknown,
  selected: Record<string, ExerciseCatalogItem>,
): string[] {
  if (Array.isArray(recentOrder)) {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of recentOrder) {
      if (typeof id !== 'string' || !selected[id] || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ordered.push(id);
    }
    for (const id of Object.keys(selected)) {
      if (seen.has(id)) {
        continue;
      }
      ordered.push(id);
    }
    return ordered.slice(0, MAX_RECENT);
  }
  return Object.keys(selected).slice(0, MAX_RECENT);
}

function parseSnapshot(raw: string): CacheSnapshot {
  const parsed: unknown = JSON.parse(raw);
  if (isCacheSnapshot(parsed)) {
    const selected = parsed.selected ?? {};
    return {
      queries: parsed.queries ?? {},
      selected,
      recentOrder: normalizeRecentOrder(
        (parsed as { recentOrder?: unknown }).recentOrder,
        selected,
      ),
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return emptySnapshot();
  }
  const queries: Record<string, CacheEntry> = {};
  for (const [key, items] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(items)) {
      queries[key] = { createdAt: new Date().toISOString(), items: items as ExerciseCatalogItem[] };
    }
  }
  return { queries, selected: {}, recentOrder: [] };
}

async function readSnapshot(): Promise<CacheSnapshot> {
  if (memory) {
    return memory;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const snapshot = raw ? parseSnapshot(raw) : emptySnapshot();
        memory = snapshot;
        return snapshot;
      } catch {
        const snapshot = emptySnapshot();
        memory = snapshot;
        return snapshot;
      }
    })();
  }
  return loadPromise;
}

async function persist(snapshot: CacheSnapshot): Promise<void> {
  memory = snapshot;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-fatal: search still works without cache.
  }
}

export async function cachedItemsForQuery(query: string): Promise<ExerciseCatalogItem[] | null> {
  const key = normalizedExerciseCatalogKey(query);
  const snapshot = await readSnapshot();
  const entry = snapshot.queries[key];
  if (!entry) {
    return null;
  }
  if (Date.now() - Date.parse(entry.createdAt) > EXPIRY_MS) {
    return null;
  }
  return entry.items;
}

export async function recentCatalogItemIDs(): Promise<Set<string>> {
  const snapshot = await readSnapshot();
  return new Set(snapshot.recentOrder.length > 0 ? snapshot.recentOrder : Object.keys(snapshot.selected));
}

export async function recentCatalogItems(limit = 4): Promise<ExerciseCatalogItem[]> {
  const snapshot = await readSnapshot();
  const order =
    snapshot.recentOrder.length > 0 ? snapshot.recentOrder : Object.keys(snapshot.selected);
  const items: ExerciseCatalogItem[] = [];
  for (const id of order) {
    const item = snapshot.selected[id];
    if (!item) {
      continue;
    }
    items.push(item);
    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

export async function saveCatalogQuery(query: string, items: ExerciseCatalogItem[]): Promise<void> {
  const key = normalizedExerciseCatalogKey(query);
  if (!key) {
    return;
  }
  const snapshot = await readSnapshot();
  const selected = { ...snapshot.selected };
  for (const item of items) {
    if (item.providerExerciseId) {
      selected[catalogItemId(item)] = item;
    }
  }
  await persist({
    queries: {
      ...snapshot.queries,
      [key]: { createdAt: new Date().toISOString(), items },
    },
    selected,
    recentOrder: snapshot.recentOrder,
  });
}

export async function saveSelectedCatalogItem(item: ExerciseCatalogItem): Promise<void> {
  const id = catalogItemId(item);
  const snapshot = await readSnapshot();
  const selected = {
    ...snapshot.selected,
    [id]: item,
  };
  const recentOrder = [id, ...snapshot.recentOrder.filter((entry) => entry !== id)].slice(
    0,
    MAX_RECENT,
  );
  await persist({
    ...snapshot,
    selected,
    recentOrder,
  });
}
