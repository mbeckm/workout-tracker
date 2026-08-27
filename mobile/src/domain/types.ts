export type { BodyCheckIn, BodyMetricKey } from '@/domain/check-in';
export { BODY_METRICS, emptyCheckInDraft, newCheckIn } from '@/domain/check-in';

export type ExerciseTrackingMode =
  | 'weightAndReps'
  | 'counterweightAndReps'
  | 'reps'
  | 'repsAndDuration'
  | 'duration'
  | 'distanceAndDuration'
  | 'weightAndDistance';

export type WorkoutItemType =
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'stability'
  | 'stretch'
  | 'timer';

export type ExercisePrescriptionMetric =
  | 'weight'
  | 'counterweight'
  | 'reps'
  | 'duration'
  | 'distance'
  | 'rest'
  | 'zone'
  | 'rounds';

export type WorkoutPlan = {
  id: string;
  name: string;
  daysPerWeek: number;
  createdAt: string;
  days: WorkoutDay[];
};

export type WorkoutDay = {
  id: string;
  title: string;
  exercises: ExercisePrescription[];
};

export type CustomExerciseDefinition = {
  id: string;
  name: string;
  equipment: string;
  muscle: string;
  exerciseType: WorkoutItemType;
  trackingMode: ExerciseTrackingMode;
  createdAt: string;
  updatedAt?: string | null;
  isArchived?: boolean | null;
  notes?: string | null;
};

export type ExercisePrescription = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  /** Legacy per-set reps. The day editor writes a single `reps` value and clears this. */
  repScheme?: number[] | null;
  providerExerciseId?: string | null;
  exerciseType?: string | null;
  bodyParts: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  /** Compound vs isolation when the catalog provides it. */
  movementType?: string | null;
  equipments: string[];
  thumbnailURL?: string | null;
  imageURL?: string | null;
  imageURLs: Record<string, string>;
  videoURL?: string | null;
  itemType: WorkoutItemType;
  trackingMode: ExerciseTrackingMode;
  targetWeight?: number | null;
  targetCounterweight?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  restSeconds?: number | null;
  intensityZone?: number | null;
  side?: string | null;
  rounds?: number | null;
  customExerciseID?: string | null;
  localImageAssetName?: string | null;
};

export type LoggedSet = {
  id: string;
  index: number;
  weight?: number | null;
  reps?: number | null;
  counterweight?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  /** Epley estimated 10RM in the logged weight unit. Stamped at finish. */
  estimatedTenRM?: number | null;
};

export type LoggedExercise = {
  id: string;
  exerciseName: string;
  sets: LoggedSet[];
  /** Best set 10RM this session — the progression KPI. */
  bestTenRM?: number | null;
  thumbnailURL?: string | null;
  imageURL?: string | null;
  imageURLs?: Record<string, string>;
};

export type LoggedWorkout = {
  id: string;
  title: string;
  completedAt: string;
  durationMinutes: number;
  exerciseCount: number;
  setCount: number;
  exercises: LoggedExercise[];
  planId?: string | null;
  dayId?: string | null;
};

export function normalizedStatsKey(name: string): string {
  return name.trim().toLowerCase();
}

export function loggedSetHasValues(set: LoggedSet): boolean {
  return (
    set.weight != null ||
    set.reps != null ||
    set.counterweight != null ||
    set.durationSeconds != null ||
    set.distanceMeters != null
  );
}

export { newId } from '@/domain/id';
