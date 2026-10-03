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

/* ----------------------------------------------------------------------------------------- *
 * D5 side map: movement figures and how-to steps (PLAN §3 D5)
 *
 * Catalog-only, like the search aliases: keyed by `bundledExerciseId(name)` and never copied
 * onto an `ExercisePrescription` (`clonePrescription` spreads rows into plans, so anything on
 * the row would be persisted). Custom exercises never get a figure.
 * ----------------------------------------------------------------------------------------- */

/** The movement patterns Trim draws its own figures for (`src/device/figures`). */
export type ExerciseFigure =
  | 'press'
  | 'squat'
  | 'hinge'
  | 'pull'
  | 'row'
  | 'fly'
  | 'curl'
  | 'extension'
  | 'raise'
  | 'carry';

export type BundledExerciseInfo = {
  figure?: ExerciseFigure;
  howTo?: readonly [string, string, string];
  /** `Barbell`, sentence case. Empty when the row has no equipment. */
  kit: string;
  /** Primary first, sentence case (`Chest`, `Front delts`). */
  muscles: readonly string[];
};

/** Fallback by target muscle, for strength rows the name table doesn't cover. */
const FIGURE_BY_TARGET: Readonly<Record<string, ExerciseFigure>> = {
  Pectorals: 'press',
  Lats: 'pull',
  'Upper Back': 'row',
  'Lower Back': 'hinge',
  Traps: 'carry',
  Delts: 'press',
  'Side Delts': 'raise',
  'Rear Delts': 'fly',
  Biceps: 'curl',
  Triceps: 'extension',
  Forearms: 'curl',
  Quads: 'squat',
  Hamstrings: 'hinge',
  Glutes: 'hinge',
  Adductors: 'squat',
};

/** By name, where the target fallback would draw the wrong movement (`null`: no figure). */
const FIGURE_BY_NAME: Readonly<Record<string, ExerciseFigure | null>> = {
  'Dumbbell Pullover': null,
  'Face Pulls': 'row',
  'Front Raise': 'raise',
  'Plate Front Raise': 'raise',
  'Close-Grip Bench Press': 'press',
  'Machine Dip': 'press',
  'Bench Dip': 'press',
  'Diamond Push-Up': 'press',
  'Leg Extension': null,
  'Leg Curl': null,
  'Seated Leg Curl': null,
  'Lying Leg Curl': null,
  'Nordic Hamstring Curl': null,
  'Cable Glute Kickback': null,
  'Hip Adduction': null,
  'Dumbbell Side Bend': 'carry',
  'Dead Hang': 'pull',
  'Wall Sit': 'squat',
};

type HowTo = { steps: readonly [string, string, string]; muscles: readonly string[] };

// howTo: draft for Marvin's review. Plain English, one short sentence per step, the 40 most
// common bundled lifts (big lifts first). Muscles: primary first, as the chips show them.
const HOW_TO: Readonly<Record<string, HowTo>> = {
  'Flat Barbell Bench Press': {
    muscles: ['Chest', 'Front delts', 'Triceps'],
    steps: [
      'Eyes under the bar, feet flat, shoulder blades pinned back.',
      'Lower the bar to mid-chest with elbows about 45° from your body.',
      'Press up and slightly back until your arms are straight.',
    ],
  },
  'Barbell Back Squat': {
    muscles: ['Quads', 'Glutes', 'Adductors'],
    steps: [
      'Bar on the upper back, feet shoulder width, toes slightly out.',
      'Sit down between your heels with knees tracking over your toes.',
      'Drive up through the whole foot until you stand tall.',
    ],
  },
  Deadlift: {
    muscles: ['Glutes', 'Hamstrings', 'Lower back'],
    steps: [
      'Bar over mid-foot, shins close, grip just outside your legs.',
      'Brace, flatten your back and push the floor away.',
      'Stand tall with hips and knees locking out together.',
    ],
  },
  'Overhead Press': {
    muscles: ['Front delts', 'Triceps', 'Upper chest'],
    steps: [
      'Bar on the front of the shoulders, grip just outside them, glutes tight.',
      'Press straight up, moving your head back so the bar passes your face.',
      'Lock out with the bar over the middle of your feet.',
    ],
  },
  'Barbell Row': {
    muscles: ['Upper back', 'Lats', 'Biceps'],
    steps: [
      'Hinge forward to about 45° with the bar hanging at arm’s length.',
      'Pull the bar to your lower ribs, driving your elbows back.',
      'Lower it under control without standing up.',
    ],
  },
  'Pull-Ups': {
    muscles: ['Lats', 'Upper back', 'Biceps'],
    steps: [
      'Hang from the bar with hands just wider than your shoulders.',
      'Pull your chest toward the bar, leading with your elbows.',
      'Lower all the way until your arms are straight.',
    ],
  },
  'Romanian Deadlift': {
    muscles: ['Hamstrings', 'Glutes', 'Lower back'],
    steps: [
      'Stand tall with the bar at your hips, soft knees.',
      'Push your hips back and slide the bar down your thighs.',
      'Stop at a deep hamstring stretch and drive the hips forward.',
    ],
  },
  'Incline Bench Press (Barbell)': {
    muscles: ['Upper chest', 'Front delts', 'Triceps'],
    steps: [
      'Set the bench to about 30°, shoulder blades pinned back.',
      'Lower the bar to your upper chest with elbows under the bar.',
      'Press up until your arms are straight over your shoulders.',
    ],
  },
  'Incline Dumbbell Press': {
    muscles: ['Upper chest', 'Front delts', 'Triceps'],
    steps: [
      'Set the bench to about 30° and start with the dumbbells at your shoulders.',
      'Press up and slightly in until your arms are straight.',
      'Lower slowly until you feel a stretch across your chest.',
    ],
  },
  'Dumbbell Bench Press': {
    muscles: ['Chest', 'Front delts', 'Triceps'],
    steps: [
      'Lie back with the dumbbells at chest level, feet flat.',
      'Press up until your arms are straight and the dumbbells nearly touch.',
      'Lower under control to the sides of your chest.',
    ],
  },
  'Lat Pulldown': {
    muscles: ['Lats', 'Upper back', 'Biceps'],
    steps: [
      'Grip the bar just outside shoulder width, knees locked under the pad.',
      'Pull the bar to your upper chest, driving your elbows down.',
      'Let it rise slowly until your arms are straight.',
    ],
  },
  'Seated Cable Row': {
    muscles: ['Upper back', 'Lats', 'Biceps'],
    steps: [
      'Sit tall with soft knees and your arms straight.',
      'Pull the handle to your stomach and squeeze your shoulder blades together.',
      'Let your arms extend slowly without rounding forward.',
    ],
  },
  'One-Arm Dumbbell Row': {
    muscles: ['Lats', 'Upper back', 'Biceps'],
    steps: [
      'One knee and one hand on the bench, back flat.',
      'Pull the dumbbell to your hip, elbow close to your body.',
      'Lower it until your arm is straight.',
    ],
  },
  'Chin-Up': {
    muscles: ['Lats', 'Biceps', 'Upper back'],
    steps: [
      'Hang from the bar with palms facing you, hands shoulder width.',
      'Pull until your chin clears the bar.',
      'Lower all the way until your arms are straight.',
    ],
  },
  Dip: {
    muscles: ['Chest', 'Triceps', 'Front delts'],
    steps: [
      'Support yourself on the bars with your arms straight.',
      'Lower until your upper arms are about level with the floor.',
      'Press back up until your arms are straight.',
    ],
  },
  'Push-Up': {
    muscles: ['Chest', 'Front delts', 'Triceps'],
    steps: [
      'Hands just wider than your shoulders, body in one straight line.',
      'Lower your chest to just above the floor, elbows about 45° out.',
      'Push back up without letting your hips sag.',
    ],
  },
  'Cable Chest Fly': {
    muscles: ['Chest', 'Front delts'],
    steps: [
      'Set both pulleys at shoulder height and step forward into a split stance.',
      'Keep a slight bend in the elbows and sweep the handles together in front of your chest.',
      'Open back up slowly until you feel a stretch across the chest.',
    ],
  },
  'Dumbbell Fly': {
    muscles: ['Chest', 'Front delts'],
    steps: [
      'Lie back with the dumbbells over your chest, palms facing each other.',
      'Open your arms wide with a slight bend in the elbows.',
      'Bring them back together over your chest in the same arc.',
    ],
  },
  'Pec Deck': {
    muscles: ['Chest', 'Front delts'],
    steps: [
      'Set the seat so the handles sit at chest height.',
      'Bring the handles together in front of you with soft elbows.',
      'Open back up slowly until you feel a stretch across the chest.',
    ],
  },
  'Seated Dumbbell Shoulder Press': {
    muscles: ['Front delts', 'Side delts', 'Triceps'],
    steps: [
      'Sit tall with the dumbbells at shoulder height, palms forward.',
      'Press up until your arms are straight overhead.',
      'Lower slowly back to your shoulders.',
    ],
  },
  'Lateral Raises': {
    muscles: ['Side delts', 'Traps'],
    steps: [
      'Stand tall with the dumbbells at your sides.',
      'Raise them out to the side until your arms are level with your shoulders.',
      'Lower slowly without swinging.',
    ],
  },
  'Face Pulls': {
    muscles: ['Rear delts', 'Upper back'],
    steps: [
      'Set a rope at face height and step back with your arms straight.',
      'Pull the rope toward your face, hands splitting past your ears.',
      'Return slowly until your arms are straight.',
    ],
  },
  'Reverse Dumbbell Fly': {
    muscles: ['Rear delts', 'Upper back'],
    steps: [
      'Hinge forward with a flat back, dumbbells hanging under your chest.',
      'Raise them out to the side, leading with the backs of your hands.',
      'Lower slowly until they hang straight down.',
    ],
  },
  'Barbell Curl': {
    muscles: ['Biceps', 'Forearms'],
    steps: [
      'Stand tall with the bar at your thighs, palms forward.',
      'Curl it up, keeping your elbows at your sides.',
      'Lower slowly until your arms are straight.',
    ],
  },
  'Dumbbell Curl': {
    muscles: ['Biceps', 'Forearms'],
    steps: [
      'Stand tall with the dumbbells at your sides, palms forward.',
      'Curl them up without moving your elbows forward.',
      'Lower slowly until your arms are straight.',
    ],
  },
  'Hammer Curl': {
    muscles: ['Biceps', 'Forearms'],
    steps: [
      'Hold the dumbbells at your sides, palms facing in.',
      'Curl them up, keeping your palms facing each other.',
      'Lower slowly until your arms are straight.',
    ],
  },
  'Tricep Pushdowns': {
    muscles: ['Triceps'],
    steps: [
      'Grip the bar at chest height, elbows tucked at your sides.',
      'Push down until your arms are straight.',
      'Let it rise to chest height without moving your elbows.',
    ],
  },
  'Overhead Dumbbell Tricep Extension': {
    muscles: ['Triceps'],
    steps: [
      'Hold one dumbbell overhead with both hands, arms straight.',
      'Lower it behind your head, elbows pointing up.',
      'Extend back up until your arms are straight.',
    ],
  },
  'Skull Crusher': {
    muscles: ['Triceps'],
    steps: [
      'Lie back with the bar over your shoulders, arms straight.',
      'Bend at the elbows to lower the bar toward your forehead.',
      'Extend back up without moving your upper arms.',
    ],
  },
  'Leg Press': {
    muscles: ['Quads', 'Glutes'],
    steps: [
      'Feet shoulder width on the platform, back flat on the pad.',
      'Lower the platform until your knees come toward your chest.',
      'Press back up until your legs are almost straight.',
    ],
  },
  'Front Squat': {
    muscles: ['Quads', 'Glutes', 'Upper back'],
    steps: [
      'Rest the bar on the front of your shoulders, elbows high.',
      'Sit straight down, keeping your chest up.',
      'Drive up through the whole foot until you stand tall.',
    ],
  },
  'Goblet Squat': {
    muscles: ['Quads', 'Glutes'],
    steps: [
      'Hold one dumbbell at your chest, feet shoulder width.',
      'Sit down between your heels, elbows inside your knees.',
      'Stand back up, keeping your chest tall.',
    ],
  },
  'Hack Squat': {
    muscles: ['Quads', 'Glutes'],
    steps: [
      'Shoulders under the pads, feet shoulder width on the platform.',
      'Lower until your thighs are about level with the platform.',
      'Drive back up through your whole foot.',
    ],
  },
  'Bulgarian Split Squat': {
    muscles: ['Quads', 'Glutes'],
    steps: [
      'Rest your back foot on a bench, front foot a long step ahead.',
      'Lower straight down until your back knee nearly touches the floor.',
      'Drive up through your front foot.',
    ],
  },
  'Walking Lunge': {
    muscles: ['Quads', 'Glutes'],
    steps: [
      'Stand tall with the dumbbells at your sides.',
      'Step forward and lower until both knees bend to about 90°.',
      'Push through the front foot and step into the next lunge.',
    ],
  },
  'Leg Extension': {
    muscles: ['Quads'],
    steps: [
      'Sit back with the pad on your lower shins, knees in line with the pivot.',
      'Straighten your legs until they are level.',
      'Lower slowly to the start.',
    ],
  },
  'Leg Curl': {
    muscles: ['Hamstrings'],
    steps: [
      'Line your knees up with the machine pivot.',
      'Curl the pad toward you without lifting your hips.',
      'Lower under control to a full stretch.',
    ],
  },
  'Hip Thrust': {
    muscles: ['Glutes', 'Hamstrings'],
    steps: [
      'Upper back on a bench, bar across your hips, feet flat.',
      'Drive your hips up until your body is straight from shoulders to knees.',
      'Lower until your hips nearly touch the floor.',
    ],
  },
  'Standing Calf Raise': {
    muscles: ['Calves'],
    steps: [
      'Balls of your feet on a step, heels hanging off.',
      'Rise up as high as you can onto your toes.',
      'Lower slowly until your heels drop below the step.',
    ],
  },
  'Hanging Leg Raise': {
    muscles: ['Abs', 'Hip flexors'],
    steps: [
      'Hang from a bar with your arms straight.',
      'Raise your legs until they are level with your hips.',
      'Lower slowly without swinging.',
    ],
  },
};

const howToById = new Map<string, HowTo>(
  Object.entries(HOW_TO).map(([name, entry]) => [bundledExerciseId(name), entry]),
);
const figureOverrideById = new Map<string, ExerciseFigure | null>(
  Object.entries(FIGURE_BY_NAME).map(([name, figure]) => [bundledExerciseId(name), figure]),
);

/** Catalog words in sentence case (`Body Weight` → `Body weight`); acronyms stay (`EZ Bar` → `EZ bar`). */
function sentenceCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word, index) => (index === 0 || /^[A-Z0-9-]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(' ');
}

/** A catalog target as a person names it (`Pectorals` → `Chest`); null for non-muscles. */
export function muscleLabel(target: string | null | undefined): string | null {
  const value = target?.trim();
  if (!value || value === 'Cardiovascular') return null;
  if (value === 'Pectorals') return 'Chest';
  return sentenceCase(value);
}

/** Equipment as the kit line shows it; empty for `None`. */
export function kitLabel(equipment: string | null | undefined): string {
  const value = equipment?.trim();
  return !value || value === 'None' ? '' : sentenceCase(value);
}

function figureFor(row: ExercisePrescription): ExerciseFigure | undefined {
  const override = figureOverrideById.get(row.id);
  if (override !== undefined) return override ?? undefined;
  if (row.itemType !== 'strength') return undefined;
  // Flys share their target with presses; the name tells them apart.
  if (/\bfly\b|pec deck|pull-apart/i.test(row.name)) return 'fly';
  const target = row.targetMuscles[0];
  return (target && FIGURE_BY_TARGET[target]) || undefined;
}

/**
 * The exercise sheet's catalog facts for a bundled lift (D5), keyed by
 * `bundledExerciseId(name)`: the movement figure and the how-to steps where Trim has them,
 * plus kit and muscles. Null when the name isn't a bundled row (custom exercises, renamed
 * rows): the sheet then shows no figure panel and no HOW TO.
 */
export function bundledExerciseInfo(name: string): BundledExerciseInfo | null {
  const row = BUNDLED_BY_ID.get(bundledExerciseId(name));
  if (!row) return null;
  const howTo = howToById.get(row.id);
  const primary = muscleLabel(row.targetMuscles[0]);
  const figure = figureFor(row);
  return {
    ...(figure ? { figure } : null),
    ...(howTo ? { howTo: howTo.steps } : null),
    kit: kitLabel(row.equipments[0]),
    muscles: howTo?.muscles ?? (primary ? [primary] : []),
  };
}
