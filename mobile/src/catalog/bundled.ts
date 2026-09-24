import type { ExercisePrescription, ExerciseTrackingMode, WorkoutItemType } from '../domain/types';

/**
 * Trim's first-party exercise catalog. Written by Trim; no third-party data or media.
 *
 * Stable identity rules (saved plans and history depend on them):
 * - `id` is `bundled-<slug of name>` and never changes once shipped. Starter plan
 *   templates reference rows by this id through `bundledExerciseById`.
 * - `name` is the "last time" key, so shipped names never change.
 * - `providerExerciseId` exists only on the original 1.0 rows. It is the `catalogKey`
 *   those rows were saved under, and maps to a licensed media source if one returns.
 *
 * File order is search priority and the order of Alternatives: big lifts first.
 */

type Movement = 'compound' | 'isolation';

type RowSpec = {
  bodyPart: string | null;
  target: string;
  equipment: string;
  sets: number;
  reps?: number;
  movement?: Movement | null;
  itemType?: WorkoutItemType;
  trackingMode?: ExerciseTrackingMode;
  exerciseType?: string | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  restSeconds?: number | null;
  intensityZone?: number | null;
  rounds?: number | null;
  eachSide?: boolean;
  /** Original 1.0 rows only: the id their saved `catalogKey` uses. */
  legacyProviderId?: string;
  /** Catalog-only search words. Never copied onto a prescription or persisted. */
  aliases?: string[];
};

export function bundledExerciseId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `bundled-${slug}`;
}

const aliasesById = new Map<string, readonly string[]>();

function exercise(name: string, spec: RowSpec): ExercisePrescription {
  const id = bundledExerciseId(name);
  if (spec.aliases?.length) {
    aliasesById.set(id, spec.aliases);
  }
  return {
    id,
    name,
    sets: spec.sets,
    reps: spec.reps ?? 0,
    ...(spec.legacyProviderId ? { providerExerciseId: spec.legacyProviderId } : null),
    ...(spec.exerciseType ? { exerciseType: spec.exerciseType } : null),
    bodyParts: spec.bodyPart ? [spec.bodyPart] : [],
    targetMuscles: [spec.target],
    secondaryMuscles: [],
    ...(spec.movement ? { movementType: spec.movement } : null),
    equipments: [spec.equipment],
    imageURLs: {},
    itemType: spec.itemType ?? 'strength',
    trackingMode: spec.trackingMode ?? 'weightAndReps',
    ...(spec.durationSeconds != null ? { durationSeconds: spec.durationSeconds } : null),
    ...(spec.distanceMeters != null ? { distanceMeters: spec.distanceMeters } : null),
    ...(spec.restSeconds != null ? { restSeconds: spec.restSeconds } : null),
    ...(spec.intensityZone != null ? { intensityZone: spec.intensityZone } : null),
    ...(spec.rounds != null ? { rounds: spec.rounds } : null),
    ...(spec.eachSide ? { side: 'Each side' } : null),
  };
}

type Extra = Partial<RowSpec>;

const C: Movement = 'compound';
const I: Movement = 'isolation';

/** Weight × reps strength row. */
function lift(
  name: string,
  bodyPart: string,
  target: string,
  equipment: string,
  movement: Movement,
  sets: number,
  reps: number,
  extra: Extra = {},
): ExercisePrescription {
  return exercise(name, { bodyPart, target, equipment, movement, sets, reps, ...extra });
}

/** Bodyweight strength row logged as reps only. */
function bodyweight(
  name: string,
  bodyPart: string,
  target: string,
  movement: Movement,
  sets: number,
  reps: number,
  extra: Extra = {},
): ExercisePrescription {
  return lift(name, bodyPart, target, 'Body Weight', movement, sets, reps, {
    trackingMode: 'reps',
    ...extra,
  });
}

/** Stability hold logged as seconds. */
function hold(
  name: string,
  bodyPart: string,
  target: string,
  sets: number,
  seconds: number,
  extra: Extra = {},
): ExercisePrescription {
  return exercise(name, {
    bodyPart,
    target,
    equipment: 'Body Weight',
    sets,
    itemType: 'stability',
    trackingMode: 'duration',
    exerciseType: 'Stability',
    durationSeconds: seconds,
    ...extra,
  });
}

/** Stability drill logged as reps. */
function drill(
  name: string,
  bodyPart: string,
  target: string,
  sets: number,
  reps: number,
  extra: Extra = {},
): ExercisePrescription {
  return exercise(name, {
    bodyPart,
    target,
    equipment: 'Body Weight',
    sets,
    reps,
    itemType: 'stability',
    trackingMode: 'reps',
    exerciseType: 'Stability',
    ...extra,
  });
}

/** One cardio block, logged as minutes. */
function cardio(
  name: string,
  equipment: string,
  minutes: number,
  trackingMode: 'duration' | 'distanceAndDuration',
  extra: Extra = {},
): ExercisePrescription {
  return exercise(name, {
    bodyPart: 'Cardio',
    target: 'Cardiovascular',
    equipment,
    sets: 1,
    itemType: 'cardio',
    trackingMode,
    exerciseType: 'Cardio',
    durationSeconds: minutes * 60,
    ...extra,
  });
}

function mobility(
  name: string,
  bodyPart: string,
  target: string,
  sets: number,
  reps: number,
  extra: Extra = {},
): ExercisePrescription {
  return exercise(name, {
    bodyPart,
    target,
    equipment: 'Body Weight',
    sets,
    reps,
    itemType: 'mobility',
    trackingMode: 'reps',
    exerciseType: 'Mobility',
    ...extra,
  });
}

function stretch(
  name: string,
  bodyPart: string,
  target: string,
  seconds: number,
  extra: Extra = {},
): ExercisePrescription {
  return exercise(name, {
    bodyPart,
    target,
    equipment: 'Body Weight',
    sets: 1,
    itemType: 'stretch',
    trackingMode: 'duration',
    exerciseType: 'Stretch',
    durationSeconds: seconds,
    ...extra,
  });
}

/** Interval timer. Logged as one set per round of `workSeconds`. */
function timer(name: string, rounds: number, workSeconds: number, restSeconds: number): ExercisePrescription {
  return exercise(name, {
    bodyPart: null,
    target: 'Full Body',
    equipment: 'None',
    sets: rounds,
    itemType: 'timer',
    trackingMode: 'duration',
    exerciseType: 'Timer',
    durationSeconds: workSeconds,
    restSeconds,
    rounds,
  });
}

const EACH = { eachSide: true } as const;

const CHEST: ExercisePrescription[] = [
  lift('Flat Barbell Bench Press', 'Chest', 'Pectorals', 'Barbell', C, 4, 8, { legacyProviderId: 'EIeI8Vf' }),
  lift('Incline Bench Press (Barbell)', 'Chest', 'Pectorals', 'Barbell', C, 4, 8, { legacyProviderId: '3TZduzM' }),
  lift('Incline Dumbbell Press', 'Chest', 'Pectorals', 'Dumbbell', C, 3, 12, { legacyProviderId: '8eqjhOl' }),
  lift('Dumbbell Bench Press', 'Chest', 'Pectorals', 'Dumbbell', C, 3, 10),
  lift('Decline Bench Press', 'Chest', 'Pectorals', 'Barbell', C, 3, 10),
  lift('Smith Machine Bench Press', 'Chest', 'Pectorals', 'Smith Machine', C, 3, 10),
  lift('Smith Machine Incline Press', 'Chest', 'Pectorals', 'Smith Machine', C, 3, 10),
  lift('Machine Chest Press', 'Chest', 'Pectorals', 'Machine', C, 3, 12),
  lift('Incline Machine Press', 'Chest', 'Pectorals', 'Machine', C, 3, 12),
  lift('Dumbbell Floor Press', 'Chest', 'Pectorals', 'Dumbbell', C, 3, 10),
  lift('Cable Chest Fly', 'Chest', 'Pectorals', 'Cable', I, 3, 15, {
    legacyProviderId: 'FVmZVhk',
    aliases: ['Cable Crossover'],
  }),
  lift('Dumbbell Fly', 'Chest', 'Pectorals', 'Dumbbell', I, 3, 12),
  lift('Incline Dumbbell Fly', 'Chest', 'Pectorals', 'Dumbbell', I, 3, 12),
  lift('Pec Deck', 'Chest', 'Pectorals', 'Machine', I, 3, 15, { aliases: ['Machine Fly'] }),
  lift('Low-to-High Cable Fly', 'Chest', 'Pectorals', 'Cable', I, 3, 15),
  lift('Incline Cable Fly', 'Chest', 'Pectorals', 'Cable', I, 3, 15),
  bodyweight('Push-Up', 'Chest', 'Pectorals', C, 3, 15),
  bodyweight('Incline Push-Up', 'Chest', 'Pectorals', C, 3, 12),
  bodyweight('Decline Push-Up', 'Chest', 'Pectorals', C, 3, 12),
  lift('Dip', 'Chest', 'Pectorals', 'Body Weight', C, 3, 10),
  lift('Assisted Dip', 'Chest', 'Pectorals', 'Assisted Machine', C, 3, 10, {
    trackingMode: 'counterweightAndReps',
  }),
  lift('Dumbbell Pullover', 'Chest', 'Pectorals', 'Dumbbell', I, 3, 12),
  // Existing search alias of Incline Dumbbell Press (same catalog key). Kept last in the
  // section so it never crowds another chest exercise out of Alternatives.
  lift('Incline Bench Press (Dumbbells)', 'Chest', 'Pectorals', 'Dumbbell', C, 3, 12, {
    legacyProviderId: '8eqjhOl',
  }),
];

const BACK: ExercisePrescription[] = [
  lift('Pull-Ups', 'Back', 'Lats', 'Body Weight', C, 4, 8, { legacyProviderId: '0V2YQjW', aliases: ['Pullup'] }),
  lift('Lat Pulldown', 'Back', 'Lats', 'Cable', C, 3, 12, { legacyProviderId: '0MlxeMn' }),
  lift('Barbell Row', 'Back', 'Upper Back', 'Barbell', C, 4, 10, { legacyProviderId: 'eZyBC3j' }),
  lift('Seated Cable Row', 'Back', 'Upper Back', 'Cable', C, 3, 12, { legacyProviderId: 'fUBheHs' }),
  lift('Deadlift', 'Back', 'Lower Back', 'Barbell', C, 3, 5),
  lift('Sumo Deadlift', 'Back', 'Lower Back', 'Barbell', C, 3, 5),
  lift('Trap Bar Deadlift', 'Back', 'Lower Back', 'Trap Bar', C, 3, 6),
  lift('Rack Pull', 'Back', 'Lower Back', 'Barbell', C, 3, 5),
  lift('Back Extension', 'Back', 'Lower Back', 'Body Weight', I, 3, 12, { aliases: ['Hyperextension'] }),
  lift('Chin-Up', 'Back', 'Lats', 'Body Weight', C, 3, 8, { aliases: ['Chinup'] }),
  lift('Assisted Pull-Up', 'Back', 'Lats', 'Assisted Machine', C, 3, 10, {
    trackingMode: 'counterweightAndReps',
  }),
  lift('Close-Grip Lat Pulldown', 'Back', 'Lats', 'Cable', C, 3, 12),
  lift('Neutral-Grip Lat Pulldown', 'Back', 'Lats', 'Cable', C, 3, 12),
  lift('Single-Arm Lat Pulldown', 'Back', 'Lats', 'Cable', C, 3, 12, EACH),
  lift('Straight-Arm Pulldown', 'Back', 'Lats', 'Cable', I, 3, 15),
  lift('One-Arm Dumbbell Row', 'Back', 'Upper Back', 'Dumbbell', C, 3, 10, EACH),
  lift('Pendlay Row', 'Back', 'Upper Back', 'Barbell', C, 4, 6),
  lift('T-Bar Row', 'Back', 'Upper Back', 'Landmine', C, 3, 10),
  lift('Chest-Supported Dumbbell Row', 'Back', 'Upper Back', 'Dumbbell', C, 3, 12),
  lift('Seal Row', 'Back', 'Upper Back', 'Barbell', C, 3, 10),
  lift('Seated Machine Row', 'Back', 'Upper Back', 'Machine', C, 3, 12),
  lift('Single-Arm Cable Row', 'Back', 'Upper Back', 'Cable', C, 3, 12, EACH),
  lift('Meadows Row', 'Back', 'Upper Back', 'Landmine', C, 3, 10, EACH),
  bodyweight('Inverted Row', 'Back', 'Upper Back', C, 3, 10),
  lift('Barbell Shrug', 'Back', 'Traps', 'Barbell', I, 3, 12),
  lift('Dumbbell Shrug', 'Back', 'Traps', 'Dumbbell', I, 3, 12),
];

const SHOULDERS: ExercisePrescription[] = [
  lift('Overhead Press', 'Shoulders', 'Delts', 'Barbell', C, 4, 10, {
    legacyProviderId: 'Kyd9Rz5',
    aliases: ['OHP', 'Military Press'],
  }),
  lift('Lateral Raises', 'Shoulders', 'Side Delts', 'Dumbbell', I, 3, 15, { legacyProviderId: 'DsgkuIt' }),
  lift('Face Pulls', 'Shoulders', 'Rear Delts', 'Cable', I, 3, 15, { legacyProviderId: 'CuaWCmC' }),
  lift('Seated Dumbbell Shoulder Press', 'Shoulders', 'Delts', 'Dumbbell', C, 3, 10),
  lift('Standing Dumbbell Shoulder Press', 'Shoulders', 'Delts', 'Dumbbell', C, 3, 10),
  lift('Arnold Press', 'Shoulders', 'Delts', 'Dumbbell', C, 3, 10),
  lift('Machine Shoulder Press', 'Shoulders', 'Delts', 'Machine', C, 3, 12),
  lift('Smith Machine Overhead Press', 'Shoulders', 'Delts', 'Smith Machine', C, 3, 10),
  lift('Push Press', 'Shoulders', 'Delts', 'Barbell', C, 3, 5),
  lift('Landmine Press', 'Shoulders', 'Delts', 'Landmine', C, 3, 10, EACH),
  bodyweight('Pike Push-Up', 'Shoulders', 'Delts', C, 3, 10),
  bodyweight('Handstand Push-Up', 'Shoulders', 'Delts', C, 3, 5),
  lift('Cable Lateral Raise', 'Shoulders', 'Side Delts', 'Cable', I, 3, 15, EACH),
  lift('Machine Lateral Raise', 'Shoulders', 'Side Delts', 'Machine', I, 3, 15),
  lift('Upright Row', 'Shoulders', 'Side Delts', 'Barbell', I, 3, 12),
  lift('Front Raise', 'Shoulders', 'Delts', 'Dumbbell', I, 3, 12),
  lift('Plate Front Raise', 'Shoulders', 'Delts', 'Plate', I, 3, 12),
  lift('Reverse Dumbbell Fly', 'Shoulders', 'Rear Delts', 'Dumbbell', I, 3, 15, {
    aliases: ['Rear Delt Fly'],
  }),
  lift('Reverse Pec Deck', 'Shoulders', 'Rear Delts', 'Machine', I, 3, 15),
  lift('Reverse Cable Fly', 'Shoulders', 'Rear Delts', 'Cable', I, 3, 15),
  bodyweight('Band Pull-Apart', 'Shoulders', 'Rear Delts', I, 3, 15, { equipment: 'Resistance Band' }),
];

const ARMS: ExercisePrescription[] = [
  lift('Barbell Curl', 'Upper Arms', 'Biceps', 'Barbell', I, 3, 12, { legacyProviderId: '25GPyDY' }),
  lift('Hammer Curl', 'Upper Arms', 'Biceps', 'Dumbbell', I, 3, 12, { legacyProviderId: '2NpxjC1' }),
  lift('Incline Bicep Curls', 'Upper Arms', 'Biceps', 'Dumbbell', I, 3, 12, { legacyProviderId: 'ae9UoXQ' }),
  lift('Dumbbell Curl', 'Upper Arms', 'Biceps', 'Dumbbell', I, 3, 12),
  lift('EZ-Bar Curl', 'Upper Arms', 'Biceps', 'EZ Bar', I, 3, 12),
  lift('Preacher Curl', 'Upper Arms', 'Biceps', 'EZ Bar', I, 3, 12),
  lift('Machine Preacher Curl', 'Upper Arms', 'Biceps', 'Machine', I, 3, 12),
  lift('Cable Curl', 'Upper Arms', 'Biceps', 'Cable', I, 3, 15),
  lift('Cable Hammer Curl', 'Upper Arms', 'Biceps', 'Cable', I, 3, 12),
  lift('Bayesian Curl', 'Upper Arms', 'Biceps', 'Cable', I, 3, 12, EACH),
  lift('Concentration Curl', 'Upper Arms', 'Biceps', 'Dumbbell', I, 3, 12, EACH),
  lift('Spider Curl', 'Upper Arms', 'Biceps', 'Dumbbell', I, 3, 12),
  lift('Zottman Curl', 'Upper Arms', 'Biceps', 'Dumbbell', I, 3, 12),
  lift('Tricep Pushdowns', 'Upper Arms', 'Triceps', 'Cable', I, 3, 15, { legacyProviderId: '3ZflifB' }),
  lift('Rope Tricep Pushdown', 'Upper Arms', 'Triceps', 'Cable', I, 3, 15),
  lift('Single-Arm Cable Pushdown', 'Upper Arms', 'Triceps', 'Cable', I, 3, 15, EACH),
  lift('Overhead Cable Tricep Extension', 'Upper Arms', 'Triceps', 'Cable', I, 3, 12),
  lift('Overhead Dumbbell Tricep Extension', 'Upper Arms', 'Triceps', 'Dumbbell', I, 3, 12, {
    aliases: ['French Press'],
  }),
  lift('Skull Crusher', 'Upper Arms', 'Triceps', 'EZ Bar', I, 3, 10, {
    aliases: ['Lying Triceps Extension'],
  }),
  lift('Dumbbell Tricep Kickback', 'Upper Arms', 'Triceps', 'Dumbbell', I, 3, 15),
  lift('Close-Grip Bench Press', 'Upper Arms', 'Triceps', 'Barbell', C, 3, 8),
  lift('Machine Dip', 'Upper Arms', 'Triceps', 'Machine', C, 3, 12),
  bodyweight('Bench Dip', 'Upper Arms', 'Triceps', C, 3, 12),
  bodyweight('Diamond Push-Up', 'Upper Arms', 'Triceps', C, 3, 12),
  lift('Reverse Curl', 'Lower Arms', 'Forearms', 'EZ Bar', I, 3, 12),
  lift('Wrist Curl', 'Lower Arms', 'Forearms', 'Dumbbell', I, 3, 15),
  lift('Reverse Wrist Curl', 'Lower Arms', 'Forearms', 'Dumbbell', I, 3, 15),
  hold('Dead Hang', 'Lower Arms', 'Forearms', 3, 30),
];

const LEGS: ExercisePrescription[] = [
  lift('Barbell Back Squat', 'Upper Legs', 'Quads', 'Barbell', C, 5, 5, { legacyProviderId: 'iYzB0Cz' }),
  lift('Leg Press', 'Upper Legs', 'Quads', 'Machine', C, 3, 15, { legacyProviderId: 'WWD6FzI' }),
  lift('Front Squat', 'Upper Legs', 'Quads', 'Barbell', C, 3, 6),
  lift('Box Squat', 'Upper Legs', 'Quads', 'Barbell', C, 3, 5),
  lift('Goblet Squat', 'Upper Legs', 'Quads', 'Dumbbell', C, 3, 12),
  lift('Hack Squat', 'Upper Legs', 'Quads', 'Machine', C, 3, 10),
  lift('Pendulum Squat', 'Upper Legs', 'Quads', 'Machine', C, 3, 10),
  lift('Belt Squat', 'Upper Legs', 'Quads', 'Machine', C, 3, 10),
  lift('Smith Machine Squat', 'Upper Legs', 'Quads', 'Smith Machine', C, 3, 10),
  bodyweight('Bodyweight Squat', 'Upper Legs', 'Quads', C, 3, 20),
  lift('Sumo Squat', 'Upper Legs', 'Adductors', 'Dumbbell', C, 3, 12),
  lift('Leg Extension', 'Upper Legs', 'Quads', 'Machine', I, 3, 15),
  lift('Bulgarian Split Squat', 'Upper Legs', 'Quads', 'Dumbbell', C, 3, 10, { ...EACH, aliases: ['BSS'] }),
  lift('Split Squat', 'Upper Legs', 'Quads', 'Dumbbell', C, 3, 10, EACH),
  lift('Walking Lunge', 'Upper Legs', 'Quads', 'Dumbbell', C, 3, 12, EACH),
  lift('Reverse Lunge', 'Upper Legs', 'Quads', 'Dumbbell', C, 3, 10, EACH),
  lift('Lateral Lunge', 'Upper Legs', 'Adductors', 'Dumbbell', C, 3, 10, EACH),
  lift('Step-Up', 'Upper Legs', 'Quads', 'Dumbbell', C, 3, 10, EACH),
  bodyweight('Box Jump', 'Upper Legs', 'Quads', C, 3, 5),
  lift('Romanian Deadlift', 'Upper Legs', 'Hamstrings', 'Barbell', C, 4, 10, {
    legacyProviderId: 'wQ2c4XD',
    aliases: ['RDL'],
  }),
  lift('Dumbbell Romanian Deadlift', 'Upper Legs', 'Hamstrings', 'Dumbbell', C, 3, 10),
  lift('Single-Leg Romanian Deadlift', 'Upper Legs', 'Hamstrings', 'Dumbbell', C, 3, 10, EACH),
  lift('Stiff-Leg Deadlift', 'Upper Legs', 'Hamstrings', 'Barbell', C, 3, 10, { aliases: ['SLDL'] }),
  lift('Good Morning', 'Upper Legs', 'Hamstrings', 'Barbell', C, 3, 10),
  lift('Leg Curl', 'Upper Legs', 'Hamstrings', 'Machine', I, 3, 12, { legacyProviderId: '17lJ1kr' }),
  lift('Seated Leg Curl', 'Upper Legs', 'Hamstrings', 'Machine', I, 3, 12),
  lift('Lying Leg Curl', 'Upper Legs', 'Hamstrings', 'Machine', I, 3, 12),
  bodyweight('Nordic Hamstring Curl', 'Upper Legs', 'Hamstrings', I, 3, 5),
  lift('Hip Thrust', 'Upper Legs', 'Glutes', 'Barbell', C, 3, 10),
  lift('Machine Hip Thrust', 'Upper Legs', 'Glutes', 'Machine', C, 3, 12),
  bodyweight('Glute Bridge', 'Upper Legs', 'Glutes', C, 3, 15),
  bodyweight('Single-Leg Glute Bridge', 'Upper Legs', 'Glutes', C, 3, 12, EACH),
  lift('Cable Pull-Through', 'Upper Legs', 'Glutes', 'Cable', C, 3, 12),
  lift('Kettlebell Swing', 'Upper Legs', 'Glutes', 'Kettlebell', C, 3, 15),
  lift('Cable Glute Kickback', 'Upper Legs', 'Glutes', 'Cable', I, 3, 15, EACH),
  lift('Hip Abduction', 'Upper Legs', 'Abductors', 'Machine', I, 3, 15),
  lift('Hip Adduction', 'Upper Legs', 'Adductors', 'Machine', I, 3, 15),
  lift('Standing Calf Raise', 'Lower Legs', 'Calves', 'Body Weight', I, 4, 20, { legacyProviderId: 'bJYHBIN' }),
  lift('Seated Calf Raise', 'Lower Legs', 'Calves', 'Machine', I, 4, 15),
  lift('Leg Press Calf Raise', 'Lower Legs', 'Calves', 'Machine', I, 4, 15, { aliases: ['Calf Press'] }),
  drill('Tibialis Raises', 'Lower Legs', 'Tibialis Anterior', 3, 15),
];

const CORE: ExercisePrescription[] = [
  lift('Hanging Leg Raise', 'Waist', 'Abs', 'Body Weight', I, 3, 12, { legacyProviderId: 'vkPYgJv' }),
  lift('Cable Crunch', 'Waist', 'Abs', 'Cable', I, 3, 15, { legacyProviderId: 'op9VxQd' }),
  bodyweight('Ab Wheel Rollout', 'Waist', 'Abs', I, 3, 10, { equipment: 'Ab Wheel', legacyProviderId: 'wL3HnPq' }),
  hold('Plank', 'Waist', 'Abs', 3, 45, { legacyProviderId: 'nB8KdRm' }),
  bodyweight('Crunch', 'Waist', 'Abs', I, 3, 20),
  bodyweight('Reverse Crunch', 'Waist', 'Abs', I, 3, 15),
  bodyweight('Decline Sit-Up', 'Waist', 'Abs', I, 3, 15),
  lift('Machine Crunch', 'Waist', 'Abs', 'Machine', I, 3, 15),
  bodyweight('Hanging Knee Raise', 'Waist', 'Abs', I, 3, 12),
  bodyweight('Lying Leg Raise', 'Waist', 'Abs', I, 3, 15),
  bodyweight('Toes-to-Bar', 'Waist', 'Abs', I, 3, 10),
  bodyweight('V-Up', 'Waist', 'Abs', I, 3, 12),
  bodyweight('Flutter Kicks', 'Waist', 'Abs', I, 3, 30),
  bodyweight('Bicycle Crunch', 'Waist', 'Obliques', I, 3, 20),
  lift('Russian Twist', 'Waist', 'Obliques', 'Plate', I, 3, 20),
  lift('Dumbbell Side Bend', 'Waist', 'Obliques', 'Dumbbell', I, 3, 15, EACH),
  lift('Cable Woodchop', 'Waist', 'Obliques', 'Cable', I, 3, 12, EACH),
  exercise('Pallof Press', {
    bodyPart: 'Waist',
    target: 'Obliques',
    equipment: 'Cable',
    sets: 3,
    reps: 12,
    itemType: 'stability',
    trackingMode: 'weightAndReps',
    exerciseType: 'Stability',
    eachSide: true,
  }),
  hold('Side Plank', 'Waist', 'Obliques', 3, 30, EACH),
  hold('Hollow Hold', 'Waist', 'Abs', 3, 30),
  drill('Dead Bug', 'Waist', 'Abs', 3, 10, EACH),
  drill('Bird Dog', 'Waist', 'Lower Back', 3, 10, EACH),
];

const STABILITY: ExercisePrescription[] = [
  hold('Copenhagen Plank', 'Upper Legs', 'Adductors', 3, 30, { ...EACH, legacyProviderId: 'hCjGsRQ' }),
  hold('Wall Sit', 'Upper Legs', 'Quads', 3, 45),
];

const CARDIO: ExercisePrescription[] = [
  cardio('Zone 2 Bike', 'Stationary Bike', 30, 'distanceAndDuration', {
    // Original 1.0 row: no body part, 10 km placeholder distance.
    bodyPart: null,
    distanceMeters: 10000,
    intensityZone: 2,
    legacyProviderId: 'H1PESYI',
  }),
  cardio('Warm-up Walk', 'Treadmill', 10, 'distanceAndDuration', {
    // Original 1.0 row: no body part, Full Body target, 1 km placeholder distance.
    bodyPart: null,
    target: 'Full Body',
    distanceMeters: 1000,
    legacyProviderId: 'rjiM4L3',
  }),
  cardio('Treadmill Run', 'Treadmill', 20, 'distanceAndDuration'),
  cardio('Incline Walk', 'Treadmill', 20, 'duration'),
  cardio('Run', 'None', 30, 'distanceAndDuration'),
  cardio('Cycling', 'Bicycle', 45, 'distanceAndDuration'),
  cardio('Stationary Bike', 'Stationary Bike', 20, 'distanceAndDuration'),
  cardio('Air Bike', 'Air Bike', 10, 'duration', { aliases: ['Fan Bike'] }),
  cardio('Rowing Machine', 'Rowing Machine', 15, 'distanceAndDuration', { aliases: ['Rower'] }),
  cardio('Ski Machine', 'Ski Machine', 10, 'distanceAndDuration'),
  cardio('Stair Climber', 'Stair Machine', 15, 'duration', { aliases: ['Stepper'] }),
  cardio('Elliptical', 'Elliptical', 20, 'duration'),
  cardio('Jump Rope', 'Jump Rope', 10, 'duration'),
  // Reps must show in the log, so Burpee is strength, not cardio. Sorted into Cardio by body part.
  bodyweight('Burpee', 'Cardio', 'Cardiovascular', C, 3, 10),
];

const MOBILITY: ExercisePrescription[] = [
  mobility('Shoulder CARs', 'Shoulders', 'Shoulders', 2, 5),
  mobility('Hip CARs', 'Upper Legs', 'Hip Flexors', 2, 5, EACH),
  mobility("World's Greatest Stretch", 'Upper Legs', 'Hip Flexors', 2, 5, EACH),
  mobility('90/90 Hip Switch', 'Upper Legs', 'Glutes', 2, 8),
  mobility('Leg Swings', 'Upper Legs', 'Hip Flexors', 2, 10, EACH),
  mobility('Ankle Rocks', 'Lower Legs', 'Calves', 2, 10, EACH),
  mobility('Cat-Cow', 'Back', 'Lower Back', 2, 10),
  mobility('Thoracic Open Book', 'Back', 'Upper Back', 2, 8, EACH),
  mobility('Arm Circles', 'Shoulders', 'Delts', 2, 10),
  mobility('Band Dislocates', 'Shoulders', 'Delts', 2, 10, { equipment: 'Resistance Band' }),
];

const STRETCH: ExercisePrescription[] = [
  stretch('Couch Stretch', 'Upper Legs', 'Hip Flexors', 60, EACH),
  stretch('Half-Kneeling Hip Flexor Stretch', 'Upper Legs', 'Hip Flexors', 45, {
    ...EACH,
    aliases: ['Hip Flexor Stretch'],
  }),
  stretch('Hamstring Stretch', 'Upper Legs', 'Hamstrings', 45, EACH),
  stretch('Standing Quad Stretch', 'Upper Legs', 'Quads', 45, EACH),
  stretch('Pigeon Stretch', 'Upper Legs', 'Glutes', 60, EACH),
  stretch('Butterfly Stretch', 'Upper Legs', 'Adductors', 45),
  stretch('Deep Squat Hold', 'Upper Legs', 'Adductors', 60),
  stretch('Calf Stretch', 'Lower Legs', 'Calves', 45, EACH),
  stretch('Doorway Chest Stretch', 'Chest', 'Pectorals', 45),
  stretch('Lat Stretch', 'Back', 'Lats', 45, EACH),
  stretch("Child's Pose", 'Back', 'Lower Back', 60),
  stretch('Cross-Body Shoulder Stretch', 'Shoulders', 'Rear Delts', 30, EACH),
];

const TIMERS: ExercisePrescription[] = [
  // Original 1.0 row keeps its shape: one set, 8 rounds recorded in `rounds`.
  { ...timer('Interval Timer', 8, 30, 15), sets: 1 },
  timer('20/10 Intervals', 8, 20, 10),
  timer('EMOM Timer', 10, 60, 0),
];

export const BUNDLED_CATALOG_SECTIONS = {
  chest: CHEST,
  back: BACK,
  shoulders: SHOULDERS,
  arms: ARMS,
  legs: LEGS,
  core: CORE,
  stability: STABILITY,
  cardio: CARDIO,
  mobility: MOBILITY,
  stretch: STRETCH,
  timers: TIMERS,
} as const;

export const BUNDLED_EXERCISES: ExercisePrescription[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...ARMS,
  ...LEGS,
  ...CORE,
  ...STABILITY,
  ...CARDIO,
  ...MOBILITY,
  ...STRETCH,
  ...TIMERS,
];

/** Bundled rows by stable id (`bundled-<slug>`). Clone before putting one in a plan. */
export const BUNDLED_BY_ID: ReadonlyMap<string, ExercisePrescription> = new Map(
  BUNDLED_EXERCISES.map((item) => [item.id, item]),
);

export function bundledExerciseById(id: string): ExercisePrescription | undefined {
  return BUNDLED_BY_ID.get(id);
}

/** Catalog-only search aliases for a bundled row (e.g. "RDL"). Empty for everything else. */
export function bundledSearchAliases(id: string | null | undefined): readonly string[] {
  return (id && aliasesById.get(id)) || [];
}
