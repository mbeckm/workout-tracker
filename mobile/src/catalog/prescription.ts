import type { CustomExerciseDefinition, ExercisePrescription, ExerciseTrackingMode } from '@/domain/types';

import { exerciseCatalogDisplayText, normalizedExerciseCatalogKey } from './text';
import type { ExerciseCatalogItem } from './types';

type PrescriptionSuggestion = {
  itemType: ExercisePrescription['itemType'];
  trackingMode: ExerciseTrackingMode;
  sets: number;
  reps: number;
  durationSeconds: number | null;
  distanceMeters: number | null;
};

function planHasMetric(
  mode: ExerciseTrackingMode,
  metric: 'reps' | 'duration' | 'distance',
): boolean {
  switch (mode) {
    case 'weightAndReps':
    case 'counterweightAndReps':
    case 'reps':
      return metric === 'reps';
    case 'repsAndDuration':
      return metric === 'reps' || metric === 'duration';
    case 'duration':
      return metric === 'duration';
    case 'distanceAndDuration':
      return metric === 'distance' || metric === 'duration';
    case 'weightAndDistance':
      return metric === 'distance';
    default:
      return false;
  }
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
}

function containsWord(word: string, value: string): boolean {
  return value.split(/[^a-z0-9]+/).includes(word);
}

function isCardioEquipment(equipment: string): boolean {
  return [
    'stationary bike',
    'treadmill',
    'elliptical',
    'stepmill',
    'stair machine',
    'rowing machine',
  ].some((token) => equipment.includes(token));
}

/** Port of Swift `ExerciseCatalogPrescriptionSuggester`. */
export function suggestionForCatalogItem(item: ExerciseCatalogItem): PrescriptionSuggestion {
  const name = normalized(item.name);
  const exerciseType = normalized(item.exerciseType ?? '');
  const bodyParts = item.bodyParts.map(normalized);
  const targetMuscles = item.targetMuscles.map(normalized);
  const equipments = item.equipments.map(normalized);

  const hasCardioMetadata =
    bodyParts.some((part) => part === 'cardio') ||
    targetMuscles.some((muscle) => muscle.includes('cardiovascular')) ||
    equipments.some(isCardioEquipment);
  const looksLikeStretch = containsWord('stretch', name);
  const looksLikeTimer = containsWord('timer', name);
  const looksLikeHold = ['plank', 'wall sit', 'isometric hold', 'static hold'].some((token) =>
    name.includes(token),
  );
  const looksLikeMobility =
    containsWord('mobility', name) ||
    name.includes('controlled articular rotation') ||
    name.endsWith(' cars');

  let inferredItemType: ExercisePrescription['itemType'];
  if (item.itemType) {
    inferredItemType = item.itemType;
  } else if (exerciseType.includes('cardio') || exerciseType.includes('endurance') || hasCardioMetadata) {
    inferredItemType = 'cardio';
  } else if (exerciseType.includes('stretch') || looksLikeStretch) {
    inferredItemType = 'stretch';
  } else if (exerciseType.includes('timer') || looksLikeTimer) {
    inferredItemType = 'timer';
  } else if (exerciseType.includes('mobility') || looksLikeMobility) {
    inferredItemType = 'mobility';
  } else if (exerciseType.includes('stability') || looksLikeHold) {
    inferredItemType = 'stability';
  } else {
    inferredItemType = 'strength';
  }

  const isBodyweight = equipments.some(
    (equipment) => equipment.includes('body weight') || equipment === 'bodyweight',
  );
  const isAssisted = equipments.some((equipment) => equipment.includes('assisted'));

  let inferredTrackingMode: ExerciseTrackingMode;
  switch (inferredItemType) {
    case 'cardio':
    case 'stretch':
    case 'timer':
      inferredTrackingMode = 'duration';
      break;
    case 'stability':
      inferredTrackingMode = looksLikeHold ? 'duration' : 'reps';
      break;
    case 'mobility':
      inferredTrackingMode = 'reps';
      break;
    default:
      inferredTrackingMode = isAssisted
        ? 'counterweightAndReps'
        : isBodyweight
          ? 'reps'
          : 'weightAndReps';
      break;
  }

  const resolvedTrackingMode = item.trackingMode ?? inferredTrackingMode;

  const defaultSets =
    inferredItemType === 'cardio' || inferredItemType === 'stretch' || inferredItemType === 'timer'
      ? 1
      : inferredItemType === 'mobility'
        ? 2
        : 3;
  const defaultReps =
    inferredItemType === 'mobility'
      ? 8
      : inferredItemType === 'strength' || inferredItemType === 'stability'
        ? 12
        : 0;

  const defaultDuration = planHasMetric(resolvedTrackingMode, 'duration')
    ? inferredItemType === 'cardio'
      ? 20 * 60
      : inferredItemType === 'timer'
        ? 60
        : 30
    : null;
  const defaultDistance = planHasMetric(resolvedTrackingMode, 'distance') ? 1000 : null;

  return {
    itemType: inferredItemType,
    trackingMode: resolvedTrackingMode,
    sets: defaultSets,
    reps: planHasMetric(resolvedTrackingMode, 'reps') ? defaultReps : 0,
    durationSeconds: defaultDuration,
    distanceMeters: defaultDistance,
  };
}

export function catalogItemId(item: ExerciseCatalogItem): string {
  if (item.customExerciseID) {
    return `custom-${item.customExerciseID}`;
  }
  if (item.providerExerciseId) {
    return item.providerExerciseId;
  }
  if (item.sourceId) {
    return item.sourceId;
  }
  return `seed-${normalizedExerciseCatalogKey(item.name)}`;
}

export function createCatalogItem(
  input: Omit<ExerciseCatalogItem, 'bodyParts' | 'targetMuscles' | 'secondaryMuscles' | 'equipments' | 'imageURLs'> & {
    bodyParts?: string[];
    targetMuscles?: string[];
    secondaryMuscles?: string[];
    equipments?: string[];
    imageURLs?: Record<string, string>;
  },
): ExerciseCatalogItem {
  const imageURLs = { ...(input.imageURLs ?? {}) };
  const imageURL = input.imageURL ?? null;
  return {
    sourceId: input.sourceId ?? null,
    providerExerciseId: input.providerExerciseId ?? null,
    customExerciseID: input.customExerciseID ?? null,
    name: exerciseCatalogDisplayText(input.name),
    exerciseType: input.exerciseType ? exerciseCatalogDisplayText(input.exerciseType) : input.exerciseType,
    itemType: input.itemType ?? null,
    trackingMode: input.trackingMode ?? null,
    suggestedSets: input.suggestedSets ?? null,
    suggestedReps: input.suggestedReps ?? null,
    durationSeconds: input.durationSeconds ?? null,
    distanceMeters: input.distanceMeters ?? null,
    restSeconds: input.restSeconds ?? null,
    intensityZone: input.intensityZone ?? null,
    side: input.side ?? null,
    rounds: input.rounds ?? null,
    movementType: input.movementType ?? null,
    bodyParts: (input.bodyParts ?? []).map(exerciseCatalogDisplayText),
    targetMuscles: (input.targetMuscles ?? []).map(exerciseCatalogDisplayText),
    secondaryMuscles: (input.secondaryMuscles ?? []).map(exerciseCatalogDisplayText),
    equipments: (input.equipments ?? []).map(exerciseCatalogDisplayText),
    thumbnailURL: input.thumbnailURL ?? imageURLs['360p'] ?? imageURL,
    imageURL,
    imageURLs,
    videoURL: input.videoURL ?? null,
  };
}

export function catalogItemFromPrescription(prescription: ExercisePrescription): ExerciseCatalogItem {
  return createCatalogItem({
    sourceId: prescription.id,
    providerExerciseId: prescription.providerExerciseId,
    customExerciseID: prescription.customExerciseID,
    name: prescription.name,
    exerciseType: prescription.exerciseType,
    itemType: prescription.itemType,
    trackingMode: prescription.trackingMode,
    suggestedSets: prescription.sets,
    suggestedReps: prescription.reps,
    durationSeconds: prescription.durationSeconds,
    distanceMeters: prescription.distanceMeters,
    restSeconds: prescription.restSeconds,
    intensityZone: prescription.intensityZone,
    side: prescription.side,
    rounds: prescription.rounds,
    bodyParts: prescription.bodyParts,
    targetMuscles: prescription.targetMuscles,
    secondaryMuscles: prescription.secondaryMuscles,
    movementType: prescription.movementType,
    equipments: prescription.equipments,
    thumbnailURL: prescription.thumbnailURL,
    imageURL: prescription.imageURL,
    imageURLs: prescription.imageURLs,
    videoURL: prescription.videoURL,
  });
}

export function catalogItemFromCustom(definition: CustomExerciseDefinition): ExerciseCatalogItem {
  const defaultSets =
    definition.exerciseType === 'cardio' ||
    definition.exerciseType === 'stretch' ||
    definition.exerciseType === 'timer'
      ? 1
      : 3;

  return createCatalogItem({
    sourceId: definition.id,
    customExerciseID: definition.id,
    name: definition.name,
    exerciseType: definition.exerciseType,
    itemType: definition.exerciseType,
    trackingMode: definition.trackingMode,
    suggestedSets: defaultSets,
    suggestedReps: planHasMetric(definition.trackingMode, 'reps') ? 12 : 0,
    durationSeconds: planHasMetric(definition.trackingMode, 'duration')
      ? definition.exerciseType === 'cardio'
        ? 20 * 60
        : 30
      : null,
    distanceMeters: planHasMetric(definition.trackingMode, 'distance') ? 1000 : null,
    targetMuscles: definition.muscle ? [definition.muscle] : [],
    equipments: definition.equipment ? [definition.equipment] : [],
  });
}

export function prescriptionFromCatalogItem(
  item: ExerciseCatalogItem,
  defaults: { sets?: number; reps?: number } = {},
): ExercisePrescription {
  const defaultSets = defaults.sets ?? 3;
  const defaultReps = defaults.reps ?? 12;
  const suggestion = suggestionForCatalogItem(item);
  const resolvedTrackingMode = item.trackingMode ?? suggestion.trackingMode;
  const sets = item.suggestedSets ?? (item.trackingMode == null ? suggestion.sets : defaultSets);
  const reps = planHasMetric(resolvedTrackingMode, 'reps')
    ? (item.suggestedReps ?? (item.trackingMode == null ? suggestion.reps : defaultReps))
    : 0;

  return {
    id: catalogItemId(item),
    name: item.name,
    sets,
    reps,
    providerExerciseId: item.providerExerciseId ?? null,
    exerciseType: item.exerciseType ?? null,
    bodyParts: [...item.bodyParts],
    targetMuscles: [...item.targetMuscles],
    secondaryMuscles: [...item.secondaryMuscles],
    movementType: item.movementType ?? null,
    equipments: [...item.equipments],
    thumbnailURL: item.thumbnailURL ?? null,
    imageURL: item.imageURL ?? null,
    imageURLs: { ...item.imageURLs },
    videoURL: item.videoURL ?? null,
    itemType: item.itemType ?? suggestion.itemType,
    trackingMode: resolvedTrackingMode,
    durationSeconds: planHasMetric(resolvedTrackingMode, 'duration')
      ? (item.durationSeconds ?? suggestion.durationSeconds)
      : null,
    distanceMeters: planHasMetric(resolvedTrackingMode, 'distance')
      ? (item.distanceMeters ?? suggestion.distanceMeters)
      : null,
    restSeconds: item.restSeconds ?? null,
    intensityZone: item.intensityZone ?? null,
    side: item.side ?? null,
    rounds: item.rounds ?? null,
    customExerciseID: item.customExerciseID ?? null,
  };
}

export function catalogKey(
  exercise: Pick<ExercisePrescription, 'id' | 'name' | 'providerExerciseId' | 'customExerciseID'> | null | undefined,
): string {
  if (!exercise) {
    return 'missing';
  }
  if (exercise.customExerciseID) {
    return `custom-${exercise.customExerciseID}`;
  }
  if (exercise.providerExerciseId) {
    return `provider-${exercise.providerExerciseId}`;
  }
  const fromName = normalizedExerciseCatalogKey(exercise.name);
  if (fromName) {
    return `bundled-${fromName}`;
  }
  if (exercise.id) {
    return `bundled-${exercise.id}`;
  }
  return 'missing';
}
