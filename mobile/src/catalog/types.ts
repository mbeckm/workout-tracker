import type { ExercisePrescription, ExerciseTrackingMode, WorkoutItemType } from '@/domain/types';

export type ExerciseCatalogItem = {
  sourceId?: string | null;
  providerExerciseId?: string | null;
  customExerciseID?: string | null;
  name: string;
  exerciseType?: string | null;
  itemType?: WorkoutItemType | null;
  trackingMode?: ExerciseTrackingMode | null;
  suggestedSets?: number | null;
  suggestedReps?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  restSeconds?: number | null;
  intensityZone?: number | null;
  side?: string | null;
  rounds?: number | null;
  bodyParts: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  movementType?: string | null;
  equipments: string[];
  thumbnailURL?: string | null;
  imageURL?: string | null;
  imageURLs: Record<string, string>;
  videoURL?: string | null;
};

export type ExerciseCatalogNotice =
  | 'cachedFallback'
  | 'seedFallback'
  | 'rateLimited'
  | 'offline'
  | 'unavailable';

export type ExerciseCatalogSearchResponse = {
  exercises: ExercisePrescription[];
  notice: ExerciseCatalogNotice | null;
};

export type ExerciseCatalogErrorCode =
  | 'offline'
  | 'rateLimited'
  | 'unavailable'
  | 'unauthorized'
  | 'invalidResponse'
  | 'aborted';

export class ExerciseCatalogError extends Error {
  readonly code: ExerciseCatalogErrorCode;
  readonly httpStatus?: number;

  constructor(code: ExerciseCatalogErrorCode, message?: string, httpStatus?: number) {
    super(message ?? code);
    this.name = 'ExerciseCatalogError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const EXERCISE_CATALOG_NOTICE_MESSAGE: Record<ExerciseCatalogNotice, string> = {
  cachedFallback: 'Using saved exercise results',
  seedFallback: 'Using built-in exercises',
  rateLimited: 'Too many searches. Try again soon',
  offline: 'Offline. Check your connection',
  unavailable: 'Exercise search unavailable',
};
