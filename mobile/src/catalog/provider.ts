import { createCatalogItem } from './prescription';
import type { ExerciseCatalogItem } from './types';
import { ExerciseCatalogError } from './types';

const OSS_BASE_URL = 'https://oss.exercisedb.dev';
const RAPIDAPI_BASE_URL = 'https://exercisedb.p.rapidapi.com';
const DEFAULT_RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com';
const TIMEOUT_MS = 12_000;

type CatalogConfig = {
  baseURL: string;
  rapidApiKey: string | null;
  rapidApiHost: string;
};

function trimEnv(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed.replace(/\/+$/, '') : null;
}

export function exerciseCatalogConfig(): CatalogConfig {
  const customBase = trimEnv(process.env.EXPO_PUBLIC_EXERCISE_CATALOG_BASE_URL);
  const rapidApiKey = trimEnv(process.env.EXPO_PUBLIC_EXERCISEDB_RAPIDAPI_KEY);
  const rapidApiHost =
    trimEnv(process.env.EXPO_PUBLIC_EXERCISEDB_RAPIDAPI_HOST) ?? DEFAULT_RAPIDAPI_HOST;

  if (customBase) {
    return { baseURL: customBase, rapidApiKey, rapidApiHost };
  }
  if (rapidApiKey) {
    return { baseURL: RAPIDAPI_BASE_URL, rapidApiKey, rapidApiHost };
  }
  return { baseURL: OSS_BASE_URL, rapidApiKey: null, rapidApiHost };
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asStringList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(asString).filter((entry): entry is string => entry != null);
}

function asUrl(value: unknown): string | null {
  const text = asString(value);
  if (!text) {
    return null;
  }
  if (/^https:\/\//i.test(text)) {
    return text;
  }
  if (/^http:\/\//i.test(text)) {
    return `https://${text.slice('http://'.length)}`;
  }
  return null;
}

function asUrlMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const url = asUrl(entry);
    if (url) {
      result[key] = url;
    }
  }
  return result;
}

function parseDto(value: unknown): ExerciseCatalogItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const dto = value as Record<string, unknown>;
  const name = asString(dto.name);
  if (!name) {
    return null;
  }

  const gifUrl = asUrl(dto.gifUrl ?? dto.gifURL);
  const imageUrl = asUrl(dto.imageUrl ?? dto.imageURL);
  const imageUrls = asUrlMap(dto.imageUrls ?? dto.imageURLs);
  const mediaURL = imageUrl ?? gifUrl;
  const bodyParts = asStringList(dto.bodyParts);
  const targetMuscles = asStringList(dto.targetMuscles);
  const secondaryMuscles = asStringList(dto.secondaryMuscles);
  const equipments = asStringList(dto.equipments);
  const overview = asString(dto.overview)?.toLowerCase() ?? '';
  const movementType =
    asString(dto.movementType ?? dto.mechanic) ??
    (/\bisolation\b|\bsingle[- ]joint\b/.test(overview)
      ? 'isolation'
      : /\bcompound\b|\bmulti[- ]joint\b/.test(overview)
        ? 'compound'
        : null);

  return createCatalogItem({
    providerExerciseId: asString(dto.exerciseId ?? dto.id),
    name,
    exerciseType: asString(dto.exerciseType ?? dto.category),
    movementType,
    bodyParts: bodyParts.length > 0 ? bodyParts : asStringList(dto.bodyPart),
    targetMuscles:
      targetMuscles.length > 0
        ? targetMuscles
        : secondaryMuscles.length > 0
          ? secondaryMuscles
          : asStringList(dto.target),
    secondaryMuscles,
    equipments: equipments.length > 0 ? equipments : asStringList(dto.equipment),
    thumbnailURL: imageUrls['360p'] ?? mediaURL,
    imageURL: mediaURL,
    imageURLs: imageUrls,
    videoURL: asUrl(dto.videoUrl ?? dto.videoURL),
  });
}

function parseResponsePayload(payload: unknown): ExerciseCatalogItem[] {
  if (Array.isArray(payload)) {
    return payload.map(parseDto).filter((item): item is ExerciseCatalogItem => item != null);
  }
  if (!payload || typeof payload !== 'object') {
    throw new ExerciseCatalogError('invalidResponse');
  }

  const record = payload as Record<string, unknown>;
  if (record.success === false) {
    throw new ExerciseCatalogError('invalidResponse');
  }

  for (const key of ['data', 'items', 'results', 'exercises']) {
    if (key in record) {
      return parseResponsePayload(record[key]);
    }
  }

  const single = parseDto(record);
  if (single) {
    return [single];
  }

  throw new ExerciseCatalogError('invalidResponse');
}

function classifyNetworkError(error: unknown, timedOut: boolean): ExerciseCatalogError {
  if (error instanceof ExerciseCatalogError) {
    return error;
  }
  if (timedOut) {
    return new ExerciseCatalogError('unavailable');
  }
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (name === 'AbortError') {
    return new ExerciseCatalogError('aborted');
  }
  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('internet') ||
    message.includes('offline')
  ) {
    return new ExerciseCatalogError('offline');
  }
  return new ExerciseCatalogError('unavailable');
}

async function fetchCatalogJSON(
  url: string,
  config: CatalogConfig,
  externalSignal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  const onAbort = () => controller.abort();
  if (externalSignal?.aborted) {
    clearTimeout(timer);
    throw new ExerciseCatalogError('aborted');
  }
  externalSignal?.addEventListener('abort', onAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.rapidApiKey) {
    headers['X-RapidAPI-Key'] = config.rapidApiKey;
    headers['X-RapidAPI-Host'] = config.rapidApiHost;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (response.status >= 200 && response.status < 300) {
      try {
        return await response.json();
      } catch {
        throw new ExerciseCatalogError('invalidResponse');
      }
    }
    if (response.status === 401 || response.status === 403) {
      throw new ExerciseCatalogError('unauthorized');
    }
    if (response.status === 429) {
      throw new ExerciseCatalogError('rateLimited');
    }
    if (response.status >= 500 && response.status < 600) {
      throw new ExerciseCatalogError('unavailable');
    }
    throw new ExerciseCatalogError('invalidResponse', undefined, response.status);
  } catch (error) {
    if (externalSignal?.aborted) {
      throw new ExerciseCatalogError('aborted');
    }
    throw classifyNetworkError(error, timedOut);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

function searchURLs(query: string, limit: number, config: CatalogConfig): string[] {
  const clamped = String(Math.min(Math.max(limit, 1), 25));
  const v1 = new URL('api/v1/exercises', `${config.baseURL}/`);
  v1.searchParams.set('name', query);
  v1.searchParams.set('limit', clamped);

  const urls = [v1.toString()];
  const usingDefaultRapidHost =
    Boolean(config.rapidApiKey) && /rapidapi\.com$/i.test(new URL(config.baseURL).hostname);
  if (usingDefaultRapidHost) {
    urls.push(
      `${config.baseURL}/exercises/name/${encodeURIComponent(query)}?limit=${clamped}`,
    );
  }
  return urls;
}

export async function fetchCatalogSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<ExerciseCatalogItem[]> {
  const config = exerciseCatalogConfig();
  const urls = searchURLs(query, limit, config);
  let lastError: ExerciseCatalogError | null = null;

  for (const [index, url] of urls.entries()) {
    try {
      const payload = await fetchCatalogJSON(url, config, signal);
      return parseResponsePayload(payload);
    } catch (error) {
      const catalogError =
        error instanceof ExerciseCatalogError ? error : classifyNetworkError(error, false);
      if (catalogError.code === 'aborted') {
        throw catalogError;
      }
      const canFallback =
        index < urls.length - 1 &&
        (catalogError.httpStatus === 404 || catalogError.code === 'invalidResponse');
      if (canFallback) {
        lastError = catalogError;
        continue;
      }
      throw catalogError;
    }
  }

  throw lastError ?? new ExerciseCatalogError('unavailable');
}
