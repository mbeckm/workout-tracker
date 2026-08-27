import { catalogKey } from './prescription';
import type { ExercisePrescription } from '@/domain/types';

/** Gym-facing body-part sections for plan exercise browse. */
export const EXERCISE_SECTION_ORDER = [
  'Recent',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Other',
] as const;

/** Body-part chips under search (jump-to-section). Excludes Recent / Other. */
export const EXERCISE_JUMP_CHIP_ORDER = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
] as const satisfies ReadonlyArray<(typeof EXERCISE_SECTION_ORDER)[number]>;

export type ExerciseSectionTitle = (typeof EXERCISE_SECTION_ORDER)[number];
export type ExerciseJumpChipTitle = (typeof EXERCISE_JUMP_CHIP_ORDER)[number];

export type ExerciseBrowseSection = {
  title: ExerciseSectionTitle;
  data: ExercisePrescription[];
};

const BODY_PART_SECTION: Record<string, Exclude<ExerciseSectionTitle, 'Recent' | 'Other'>> = {
  chest: 'Chest',
  back: 'Back',
  neck: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  'upper arms': 'Arms',
  'lower arms': 'Arms',
  legs: 'Legs',
  'upper legs': 'Legs',
  'lower legs': 'Legs',
  core: 'Core',
  waist: 'Core',
  cardio: 'Cardio',
};

const TARGET_SECTION: Record<string, Exclude<ExerciseSectionTitle, 'Recent' | 'Other'>> = {
  pectorals: 'Chest',
  lats: 'Back',
  'upper back': 'Back',
  traps: 'Back',
  delts: 'Shoulders',
  shoulders: 'Shoulders',
  biceps: 'Arms',
  triceps: 'Arms',
  forearms: 'Arms',
  quads: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
  adductors: 'Legs',
  abductors: 'Legs',
  'hip flexors': 'Legs',
  'tibialis anterior': 'Legs',
  abs: 'Core',
  obliques: 'Core',
  cardiovascular: 'Cardio',
};

function normalizedToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
}

function isCardioExercise(exercise: ExercisePrescription): boolean {
  if (exercise.itemType === 'cardio') {
    return true;
  }
  const type = normalizedToken(exercise.exerciseType ?? '');
  return type.includes('cardio') || type.includes('endurance');
}

/** Maps a catalog exercise to one browse section (never Recent). */
export function exerciseBrowseSection(
  exercise: ExercisePrescription,
): Exclude<ExerciseSectionTitle, 'Recent'> {
  if (isCardioExercise(exercise)) {
    return 'Cardio';
  }

  for (const part of exercise.bodyParts) {
    const mapped = BODY_PART_SECTION[normalizedToken(part)];
    if (mapped) {
      return mapped;
    }
  }

  for (const muscle of [...exercise.targetMuscles, ...exercise.secondaryMuscles]) {
    const token = normalizedToken(muscle);
    const fromTarget = TARGET_SECTION[token];
    if (fromTarget) {
      return fromTarget;
    }
    const fromBodyPartName = BODY_PART_SECTION[token];
    if (fromBodyPartName) {
      return fromBodyPartName;
    }
  }

  return 'Other';
}

function uniqueByCatalogKey(exercises: ExercisePrescription[]): ExercisePrescription[] {
  const seen = new Set<string>();
  const unique: ExercisePrescription[] = [];
  for (const exercise of exercises) {
    if (!exercise?.name) {
      continue;
    }
    const key = catalogKey(exercise);
    if (key === 'missing' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(exercise);
  }
  return unique;
}

/**
 * Groups the offline catalog into body-part sections.
 * Empty sections are omitted. `recent` becomes the first section when non-empty.
 */
export function groupExercisesForBrowse(input: {
  exercises: ExercisePrescription[];
  recent?: ExercisePrescription[];
}): ExerciseBrowseSection[] {
  const buckets = new Map<Exclude<ExerciseSectionTitle, 'Recent'>, ExercisePrescription[]>();
  for (const title of EXERCISE_SECTION_ORDER) {
    if (title === 'Recent') {
      continue;
    }
    buckets.set(title, []);
  }

  for (const exercise of uniqueByCatalogKey(input.exercises)) {
    const section = exerciseBrowseSection(exercise);
    buckets.get(section)?.push(exercise);
  }

  const sections: ExerciseBrowseSection[] = [];
  const recent = uniqueByCatalogKey(input.recent ?? []).slice(0, 4);
  if (recent.length > 0) {
    sections.push({ title: 'Recent', data: recent });
  }

  for (const title of EXERCISE_SECTION_ORDER) {
    if (title === 'Recent') {
      continue;
    }
    const data = buckets.get(title) ?? [];
    if (data.length === 0) {
      continue;
    }
    sections.push({ title, data });
  }

  return sections;
}

/** Equipment · section meta line for picker rows. */
export function exercisePickerMeta(exercise: ExercisePrescription): string {
  const equipment = exercise.equipments[0]?.trim() ?? '';
  const section = exerciseBrowseSection(exercise);
  if (equipment && section !== 'Other') {
    return `${equipment} · ${section}`;
  }
  if (equipment) {
    return equipment;
  }
  if (section !== 'Other') {
    return section;
  }
  return exercise.targetMuscles[0]?.trim() ?? '';
}
