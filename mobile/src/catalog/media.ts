import type { LoggedExercise } from '@/domain/types';

import { BUNDLED_EXERCISES } from './bundled';
import { normalizedExerciseCatalogKey } from './text';
import type { ExerciseCatalogItem } from './types';

export type ExerciseMediaSource = {
  name: string;
  thumbnailURL?: string | null;
  imageURL?: string | null;
  imageURLs?: Record<string, string> | null;
};

type ExerciseMediaFields = Omit<ExerciseMediaSource, 'name'>;

const STILL_IMAGE_KEYS = ['360p', '480p', '720p', '1080p'] as const;

function isAnimatedMediaURL(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.gif');
  } catch {
    return /\.gif(?:$|[?#])/i.test(url);
  }
}

function mediaCandidates(exercise: ExerciseMediaFields): string[] {
  const keyed = STILL_IMAGE_KEYS.map((key) => exercise.imageURLs?.[key]);
  const rest = Object.entries(exercise.imageURLs ?? {})
    .filter(([key]) => !(STILL_IMAGE_KEYS as readonly string[]).includes(key))
    .map(([, url]) => url);
  return [...keyed, ...rest, exercise.imageURL, exercise.thumbnailURL].filter(
    (url): url is string => Boolean(url),
  );
}

function firstStillURL(urls: string[]): string | null {
  return urls.find((url) => !isAnimatedMediaURL(url)) ?? null;
}

function directMediaURL(exercise: ExerciseMediaFields): string | null {
  return (
    exercise.thumbnailURL ??
    exercise.imageURL ??
    exercise.imageURLs?.['360p'] ??
    Object.values(exercise.imageURLs ?? {})[0] ??
    null
  );
}

function directStillMediaURL(exercise: ExerciseMediaFields): string | null {
  return firstStillURL(mediaCandidates(exercise));
}

const bundledMediaByName = new Map(
  BUNDLED_EXERCISES.map((exercise) => {
    const url = directMediaURL(exercise);
    return url ? ([normalizedExerciseCatalogKey(exercise.name), url] as const) : null;
  }).filter((entry): entry is readonly [string, string] => entry != null),
);

export function catalogMediaURL(
  item: Pick<ExerciseCatalogItem, 'thumbnailURL' | 'imageURL' | 'imageURLs'>,
): string | null {
  return item.thumbnailURL ?? item.imageURLs['360p'] ?? item.imageURL ?? null;
}

/** First usable GIF/image URL for library and day pills. */
export function exerciseMediaURL(exercise: ExerciseMediaSource): string | null {
  return directMediaURL(exercise) ?? bundledMediaByName.get(normalizedExerciseCatalogKey(exercise.name)) ?? null;
}

/** Prefer a still frame for the log strip. Falls back to a GIF if that is all the catalog has. */
export function exerciseStillMediaURL(exercise: ExerciseMediaSource): string | null {
  return directStillMediaURL(exercise) ?? exerciseMediaURL(exercise);
}

export function loggedExerciseStillMediaURL(exercise: LoggedExercise): string | null {
  return exerciseStillMediaURL({
    name: exercise.exerciseName,
    thumbnailURL: exercise.thumbnailURL,
    imageURL: exercise.imageURL,
    imageURLs: exercise.imageURLs,
  });
}
