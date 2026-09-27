import { CATALOG } from './config';

/**
 * Exercise media is resolved from catalog identity only. URLs saved on plans, archived
 * plans or history (from earlier builds) are never read: they may point at media Trim
 * has no licence to show.
 */
export type ExerciseMediaSource = {
  name: string;
  providerExerciseId?: string | null;
};

function trimmedBaseURL(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '') ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Licensed, self-hosted media keyed by the catalog's provider id. Only used when
 * `CATALOG.media` is on; 1.0 ships with it off and no host set.
 */
const LICENSED_MEDIA_BASE_URL = CATALOG.media
  ? trimmedBaseURL(process.env.EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL)
  : null;

function licensedMediaURL(exercise: ExerciseMediaSource): string | null {
  if (!CATALOG.media || !LICENSED_MEDIA_BASE_URL || !exercise.providerExerciseId) {
    return null;
  }
  return `${LICENSED_MEDIA_BASE_URL}/${encodeURIComponent(exercise.providerExerciseId)}.gif`;
}

/** Media URL for an exercise, or `null` (always `null` while media is off). */
export function exerciseMediaURL(exercise: ExerciseMediaSource): string | null {
  return licensedMediaURL(exercise);
}

/** Still-frame media for lists and the Live Activity, or `null` while media is off. */
export function exerciseStillMediaURL(exercise: ExerciseMediaSource): string | null {
  return licensedMediaURL(exercise);
}
