import type { ExercisePrescription } from '@/domain/types';

import { durationIsMinutes, usesDuration, usesReps } from '@/domain/helpers';

export type ExerciseSize = 'large' | 'small';

/** Compound / large-muscle work. NSCA: 2–3 min between sets. */
export const REST_LARGE_SECONDS = 150;
/** Isolation / small-muscle work. NSCA: 1–2 min between sets. */
export const REST_SMALL_SECONDS = 60;
/** Unknown strength movement. */
export const REST_DEFAULT_SECONDS = 90;
/** Cardio, stretches, timers. */
export const REST_LIGHT_SECONDS = 30;
/** Mobility drills. */
export const REST_MOBILITY_SECONDS = 45;

type SizeHints = {
  name: string;
  bodyParts?: string[];
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  movementType?: string | null;
  itemType?: ExercisePrescription['itemType'] | null;
};

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function haystack(hints: SizeHints): string {
  return [
    hints.name,
    ...(hints.bodyParts ?? []),
    ...(hints.targetMuscles ?? []),
    ...(hints.secondaryMuscles ?? []),
  ]
    .map(normalized)
    .join(' · ');
}

const SMALL_NAME = [
  'curl',
  'fly',
  'flye',
  'raise',
  'pushdown',
  'kickback',
  'french press',
  'skull crusher',
  'skullcrusher',
  'leg extension',
  'calf',
  'shrug',
  'wrist',
  'preacher',
  'concentration',
  'face pull',
  'pec deck',
  'crossover',
  'upright row',
  'abduct',
  'adduct',
  'crunch',
  'sit up',
  'situp',
  'russian twist',
  'woodchop',
];

const LARGE_NAME = [
  'deadlift',
  'squat',
  'lunge',
  'split squat',
  'bulgarian',
  'hip thrust',
  'leg press',
  'bench',
  'chest press',
  'overhead press',
  'shoulder press',
  'military press',
  'push press',
  'pulldown',
  'pull down',
  'pull up',
  'pullup',
  'chin up',
  'chinup',
  'romanian',
  'good morning',
  'clean',
  'snatch',
  'thruster',
  'jerk',
  'farmer',
  'push up',
  'pushup',
];

const SMALL_MUSCLE = [
  'bicep',
  'tricep',
  'calf',
  'forearm',
  'abductor',
  'adductor',
  'tibialis',
  'oblique',
  'abs',
  'abdominal',
];

const LARGE_MUSCLE = [
  'quad',
  'glute',
  'hamstring',
  'pectoral',
  'chest',
  'lat',
  'upper back',
  'erector',
  'lower back',
  'full body',
];

const SMALL_BODY_PART = ['upper arms', 'lower arms', 'lower legs', 'waist'];
const LARGE_BODY_PART = ['chest', 'back', 'upper legs'];

function includesAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function movementSize(value: string | null | undefined): ExerciseSize | null {
  const text = normalized(value ?? '');
  if (!text) {
    return null;
  }
  if (text.includes('isolation') || text.includes('single joint')) {
    return 'small';
  }
  if (text.includes('compound') || text.includes('multi joint')) {
    return 'large';
  }
  return null;
}

export function classifyExerciseSize(hints: SizeHints): ExerciseSize | null {
  const fromMovement = movementSize(hints.movementType);
  if (fromMovement) {
    return fromMovement;
  }

  const name = normalized(hints.name);
  if (includesAny(name, SMALL_NAME)) {
    return 'small';
  }
  if (/\bpress\b/.test(name) && !name.includes('french')) {
    return 'large';
  }
  if (/\brow\b/.test(name) && !name.includes('upright')) {
    return 'large';
  }
  if (/\bdips?\b/.test(name)) {
    return 'large';
  }
  if (includesAny(name, LARGE_NAME)) {
    return 'large';
  }

  const muscles = haystack(hints);
  if (includesAny(muscles, SMALL_MUSCLE) && !includesAny(muscles, LARGE_MUSCLE)) {
    return 'small';
  }
  if (includesAny(muscles, LARGE_MUSCLE)) {
    return 'large';
  }

  const parts = (hints.bodyParts ?? []).map(normalized).join(' ');
  if (includesAny(parts, SMALL_BODY_PART) && !includesAny(parts, LARGE_BODY_PART)) {
    return 'small';
  }
  if (includesAny(parts, LARGE_BODY_PART)) {
    return 'large';
  }

  return null;
}

export function restSecondsForExercise(exercise: ExercisePrescription): number {
  if (exercise.restSeconds != null && exercise.restSeconds > 0) {
    return exercise.restSeconds;
  }

  if (
    exercise.itemType === 'cardio' ||
    exercise.itemType === 'stretch' ||
    exercise.itemType === 'timer' ||
    durationIsMinutes(exercise) ||
    (usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode))
  ) {
    return REST_LIGHT_SECONDS;
  }

  if (exercise.itemType === 'mobility') {
    return REST_MOBILITY_SECONDS;
  }

  const size = classifyExerciseSize({
    name: exercise.name,
    bodyParts: exercise.bodyParts,
    targetMuscles: exercise.targetMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    movementType: exercise.movementType,
    itemType: exercise.itemType,
  });

  if (size === 'large') {
    return REST_LARGE_SECONDS;
  }
  if (size === 'small') {
    return REST_SMALL_SECONDS;
  }
  return REST_DEFAULT_SECONDS;
}
