import type { ExercisePrescription } from '../domain/types';

function bundledId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `bundled-${slug}`;
}

function gifUrl(exerciseId: string): string {
  return `https://static.exercisedb.dev/media/${exerciseId}.gif`;
}

function withGif(
  exercise: ExercisePrescription,
  exerciseId: string,
  extras: Partial<Pick<ExercisePrescription, 'bodyParts' | 'targetMuscles' | 'secondaryMuscles' | 'equipments'>> = {},
): ExercisePrescription {
  const url = gifUrl(exerciseId);
  return {
    ...exercise,
    ...extras,
    providerExerciseId: exerciseId,
    thumbnailURL: url,
    imageURL: url,
  };
}

function strengthExercise(
  name: string,
  sets: number,
  reps: number,
): ExercisePrescription {
  const id = bundledId(name);

  return {
    id,
    name,
    sets,
    reps,
    bodyParts: [],
    targetMuscles: [],
    secondaryMuscles: [],
    equipments: [],
    imageURLs: {},
    itemType: 'strength',
    trackingMode: 'weightAndReps',
  };
}

export const BUNDLED_EXERCISES: ExercisePrescription[] = [
  withGif(strengthExercise('Flat Barbell Bench Press', 4, 8), 'EIeI8Vf', {
    bodyParts: ['Chest'],
    targetMuscles: ['Pectorals'],
    equipments: ['Barbell'],
  }),
  withGif(strengthExercise('Incline Dumbbell Press', 3, 12), '8eqjhOl', {
    bodyParts: ['Chest'],
    targetMuscles: ['Pectorals'],
    equipments: ['Dumbbell'],
  }),
  // Search alias of Incline Dumbbell Press (same ExerciseDB id / media).
  withGif(strengthExercise('Incline Bench Press (Dumbbells)', 3, 12), '8eqjhOl', {
    bodyParts: ['Chest'],
    targetMuscles: ['Pectorals'],
    equipments: ['Dumbbell'],
  }),
  withGif(strengthExercise('Incline Bicep Curls', 3, 12), 'ae9UoXQ', {
    bodyParts: ['Upper Arms'],
    targetMuscles: ['Biceps'],
    equipments: ['Dumbbell'],
  }),
  withGif(strengthExercise('Incline Bench Press (Barbell)', 4, 8), '3TZduzM', {
    bodyParts: ['Chest'],
    targetMuscles: ['Pectorals'],
    equipments: ['Barbell'],
  }),
  withGif(strengthExercise('Overhead Press', 4, 10), 'Kyd9Rz5', {
    bodyParts: ['Shoulders'],
    targetMuscles: ['Delts'],
    equipments: ['Barbell'],
  }),
  withGif(strengthExercise('Lateral Raises', 3, 15), 'DsgkuIt', {
    bodyParts: ['Shoulders'],
    targetMuscles: ['Delts'],
    equipments: ['Dumbbell'],
  }),
  withGif(strengthExercise('Tricep Pushdowns', 3, 15), '3ZflifB', {
    bodyParts: ['Upper Arms'],
    targetMuscles: ['Triceps'],
    equipments: ['Cable'],
  }),
  withGif(strengthExercise('Cable Chest Fly', 3, 15), 'FVmZVhk', {
    bodyParts: ['Chest'],
    targetMuscles: ['Pectorals'],
    equipments: ['Cable'],
  }),
  withGif(strengthExercise('Pull-Ups', 4, 8), '0V2YQjW', {
    bodyParts: ['Back'],
    targetMuscles: ['Lats'],
    equipments: ['Body Weight'],
  }),
  withGif(strengthExercise('Lat Pulldown', 3, 12), '0MlxeMn', {
    bodyParts: ['Back'],
    targetMuscles: ['Lats'],
    equipments: ['Cable'],
  }),
  withGif(strengthExercise('Barbell Row', 4, 10), 'eZyBC3j', {
    bodyParts: ['Back'],
    targetMuscles: ['Upper Back'],
    equipments: ['Barbell'],
  }),
  withGif(strengthExercise('Seated Cable Row', 3, 12), 'fUBheHs', {
    bodyParts: ['Back'],
    targetMuscles: ['Upper Back'],
    equipments: ['Cable'],
  }),
  withGif(strengthExercise('Face Pulls', 3, 15), 'CuaWCmC', {
    bodyParts: ['Shoulders'],
    targetMuscles: ['Delts'],
    equipments: ['Cable'],
  }),
  withGif(strengthExercise('Barbell Curl', 3, 12), '25GPyDY', {
    bodyParts: ['Upper Arms'],
    targetMuscles: ['Biceps'],
    equipments: ['Barbell'],
  }),
  withGif(strengthExercise('Hammer Curl', 3, 12), '2NpxjC1', {
    bodyParts: ['Upper Arms'],
    targetMuscles: ['Biceps'],
    equipments: ['Dumbbell'],
  }),
  withGif(strengthExercise('Barbell Back Squat', 5, 5), 'iYzB0Cz', {
    bodyParts: ['Upper Legs'],
    targetMuscles: ['Quads'],
    equipments: ['Barbell'],
  }),
  withGif(strengthExercise('Romanian Deadlift', 4, 10), 'wQ2c4XD', {
    bodyParts: ['Upper Legs'],
    targetMuscles: ['Hamstrings'],
    equipments: ['Barbell'],
  }),
  withGif(strengthExercise('Leg Press', 3, 15), 'WWD6FzI', {
    bodyParts: ['Upper Legs'],
    targetMuscles: ['Quads'],
    equipments: ['Sled Machine'],
  }),
  withGif(strengthExercise('Leg Curl', 3, 12), '17lJ1kr', {
    bodyParts: ['Upper Legs'],
    targetMuscles: ['Hamstrings'],
    equipments: ['Leverage Machine'],
  }),
  withGif(strengthExercise('Standing Calf Raise', 4, 20), 'bJYHBIN', {
    bodyParts: ['Lower Legs'],
    targetMuscles: ['Calves'],
    equipments: ['Body Weight'],
  }),
  withGif(strengthExercise('Hanging Leg Raise', 3, 12), 'vkPYgJv', {
    bodyParts: ['Waist'],
    targetMuscles: ['Abs'],
    equipments: ['Body Weight'],
  }),
  withGif(strengthExercise('Cable Crunch', 3, 15), 'op9VxQd', {
    bodyParts: ['Waist'],
    targetMuscles: ['Abs'],
    equipments: ['Cable'],
  }),
  withGif(
    {
      id: bundledId('Plank'),
      name: 'Plank',
      sets: 3,
      reps: 0,
      exerciseType: 'Stability',
      bodyParts: ['Waist'],
      targetMuscles: ['Abs'],
      secondaryMuscles: [],
      equipments: ['Body Weight'],
      imageURLs: {},
      itemType: 'stability',
      trackingMode: 'duration',
      durationSeconds: 45,
    },
    'nB8KdRm',
  ),
  withGif(
    {
      id: bundledId('Ab Wheel Rollout'),
      name: 'Ab Wheel Rollout',
      sets: 3,
      reps: 10,
      bodyParts: ['Waist'],
      targetMuscles: ['Abs'],
      secondaryMuscles: [],
      equipments: ['Wheel Roller'],
      imageURLs: {},
      itemType: 'strength',
      trackingMode: 'reps',
    },
    'wL3HnPq',
  ),
  withGif(
    {
      id: bundledId('Zone 2 Bike'),
      name: 'Zone 2 Bike',
      sets: 1,
      reps: 0,
      exerciseType: 'Cardio',
      bodyParts: [],
      targetMuscles: ['Cardiovascular'],
      secondaryMuscles: [],
      equipments: ['Stationary Bike'],
      imageURLs: {},
      itemType: 'cardio',
      trackingMode: 'distanceAndDuration',
      durationSeconds: 1800,
      distanceMeters: 10000,
      intensityZone: 2,
    },
    'H1PESYI',
  ),
  withGif(
    {
      id: bundledId('Copenhagen Plank'),
      name: 'Copenhagen Plank',
      sets: 3,
      reps: 0,
      exerciseType: 'Stability',
      bodyParts: [],
      targetMuscles: ['Adductors'],
      secondaryMuscles: [],
      equipments: ['Bodyweight'],
      imageURLs: {},
      itemType: 'stability',
      trackingMode: 'duration',
      durationSeconds: 30,
      side: 'Each side',
    },
    'hCjGsRQ',
  ),
  {
    id: bundledId('Tibialis Raises'),
    name: 'Tibialis Raises',
    sets: 3,
    reps: 15,
    exerciseType: 'Stability',
    bodyParts: [],
    targetMuscles: ['Tibialis Anterior'],
    secondaryMuscles: [],
    equipments: ['Bodyweight'],
    imageURLs: {},
    itemType: 'stability',
    trackingMode: 'reps',
  },
  {
    id: bundledId('Couch Stretch'),
    name: 'Couch Stretch',
    sets: 1,
    reps: 0,
    exerciseType: 'Stretch',
    bodyParts: [],
    targetMuscles: ['Hip Flexors'],
    secondaryMuscles: [],
    equipments: ['Bodyweight'],
    imageURLs: {},
    itemType: 'stretch',
    trackingMode: 'duration',
    durationSeconds: 60,
    side: 'Each side',
  },
  withGif(
    {
      id: bundledId('Warm-up Walk'),
      name: 'Warm-up Walk',
      sets: 1,
      reps: 0,
      exerciseType: 'Cardio',
      bodyParts: [],
      targetMuscles: ['Full Body'],
      secondaryMuscles: [],
      equipments: ['Treadmill'],
      imageURLs: {},
      itemType: 'cardio',
      trackingMode: 'distanceAndDuration',
      durationSeconds: 600,
      distanceMeters: 1000,
    },
    'rjiM4L3',
  ),
  {
    id: bundledId('Shoulder CARs'),
    name: 'Shoulder CARs',
    sets: 2,
    reps: 5,
    exerciseType: 'Mobility',
    bodyParts: [],
    targetMuscles: ['Shoulders'],
    secondaryMuscles: [],
    equipments: ['Bodyweight'],
    imageURLs: {},
    itemType: 'mobility',
    trackingMode: 'reps',
  },
  {
    id: bundledId('Interval Timer'),
    name: 'Interval Timer',
    sets: 1,
    reps: 0,
    exerciseType: 'Timer',
    bodyParts: [],
    targetMuscles: ['Full Body'],
    secondaryMuscles: [],
    equipments: ['None'],
    imageURLs: {},
    itemType: 'timer',
    trackingMode: 'duration',
    durationSeconds: 30,
    restSeconds: 15,
    rounds: 8,
  },
];
