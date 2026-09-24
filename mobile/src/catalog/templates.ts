import { bundledExerciseById } from './bundled';
import { clonePrescription, emptyDay } from '../domain/helpers';
import { newId } from '../domain/id';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '../domain/types';

/**
 * Starter plans offered at the end of onboarding. Free: they are how a new user gets
 * to a startable Day 1, not a Pro feature.
 *
 * Rules:
 * - Bundled exercises only (works offline), referenced by stable id (`bundled-<slug>`).
 * - Sets × reps, never weights. Weight is entered while logging.
 * - `planFromStarterTemplate` clones catalog rows with fresh ids, so every plan made
 *   from a template is independent of the catalog and of other plans.
 */

export type StarterTemplateId =
  | 'full-body-2'
  | 'full-body-3'
  | 'push-pull-legs-3'
  | 'upper-lower-4'
  | 'upper-lower-ppl-5'
  | 'push-pull-legs-6';

type Prescribed = readonly [id: string, sets: number, reps: number];

type TemplateDay = {
  title: string;
  exercises: readonly Prescribed[];
};

export type StarterTemplate = {
  id: StarterTemplateId;
  name: string;
  daysPerWeek: number;
  days: readonly TemplateDay[];
};

export const STARTER_DAY_COUNTS = [2, 3, 4, 5, 6] as const;
export type StarterDayCount = (typeof STARTER_DAY_COUNTS)[number];

const SQUAT = 'bundled-barbell-back-squat';
const BENCH = 'bundled-flat-barbell-bench-press';
const INCLINE_BENCH = 'bundled-incline-bench-press-barbell';
const INCLINE_DB_PRESS = 'bundled-incline-dumbbell-press';
const DB_SHOULDER_PRESS = 'bundled-seated-dumbbell-shoulder-press';
const OHP = 'bundled-overhead-press';
const CABLE_FLY = 'bundled-cable-chest-fly';
const ROW = 'bundled-barbell-row';
const CABLE_ROW = 'bundled-seated-cable-row';
const PULLDOWN = 'bundled-lat-pulldown';
const PULL_UPS = 'bundled-pull-ups';
const DEADLIFT = 'bundled-deadlift';
const RDL = 'bundled-romanian-deadlift';
const LEG_PRESS = 'bundled-leg-press';
const SPLIT_SQUAT = 'bundled-bulgarian-split-squat';
const LEG_CURL = 'bundled-leg-curl';
const CALF_RAISE = 'bundled-standing-calf-raise';
const LATERALS = 'bundled-lateral-raises';
const FACE_PULLS = 'bundled-face-pulls';
const BARBELL_CURL = 'bundled-barbell-curl';
const HAMMER_CURL = 'bundled-hammer-curl';
const INCLINE_CURL = 'bundled-incline-bicep-curls';
const PUSHDOWN = 'bundled-tricep-pushdowns';
const OVERHEAD_EXTENSION = 'bundled-overhead-cable-tricep-extension';
const CABLE_CRUNCH = 'bundled-cable-crunch';
const LEG_RAISE = 'bundled-hanging-leg-raise';

const FULL_BODY_A: TemplateDay = {
  title: 'Full Body A',
  exercises: [
    [SQUAT, 4, 6],
    [BENCH, 4, 8],
    [ROW, 3, 10],
    [LATERALS, 3, 15],
    [CABLE_CRUNCH, 3, 15],
  ],
};

const FULL_BODY_B: TemplateDay = {
  title: 'Full Body B',
  exercises: [
    [RDL, 4, 8],
    [OHP, 4, 8],
    [PULLDOWN, 3, 12],
    [LEG_PRESS, 3, 12],
    [LEG_RAISE, 3, 12],
  ],
};

const FULL_BODY_C: TemplateDay = {
  title: 'Full Body C',
  exercises: [
    [SQUAT, 3, 8],
    [INCLINE_DB_PRESS, 3, 10],
    [CABLE_ROW, 3, 12],
    [LEG_CURL, 3, 12],
    [HAMMER_CURL, 3, 12],
    [PUSHDOWN, 3, 12],
  ],
};

const UPPER_A: TemplateDay = {
  title: 'Upper A',
  exercises: [
    [BENCH, 4, 6],
    [ROW, 4, 8],
    [OHP, 3, 8],
    [PULLDOWN, 3, 10],
    [BARBELL_CURL, 3, 12],
    [PUSHDOWN, 3, 12],
  ],
};

const LOWER_A: TemplateDay = {
  title: 'Lower A',
  exercises: [
    [SQUAT, 4, 6],
    [RDL, 3, 8],
    [LEG_CURL, 3, 12],
    [CALF_RAISE, 4, 12],
    [LEG_RAISE, 3, 12],
  ],
};

const UPPER_B: TemplateDay = {
  title: 'Upper B',
  exercises: [
    [INCLINE_BENCH, 4, 8],
    [PULL_UPS, 4, 8],
    [CABLE_ROW, 3, 10],
    [LATERALS, 3, 15],
    [FACE_PULLS, 3, 15],
    [HAMMER_CURL, 3, 12],
  ],
};

const LOWER_B: TemplateDay = {
  title: 'Lower B',
  exercises: [
    [LEG_PRESS, 4, 10],
    [RDL, 4, 8],
    [LEG_CURL, 3, 12],
    [CALF_RAISE, 4, 15],
    [CABLE_CRUNCH, 3, 15],
  ],
};

const PUSH_A: TemplateDay = {
  title: 'Push',
  exercises: [
    [BENCH, 4, 6],
    [OHP, 3, 8],
    [INCLINE_DB_PRESS, 3, 10],
    [CABLE_FLY, 3, 12],
    [LATERALS, 3, 15],
    [PUSHDOWN, 3, 12],
  ],
};

const PULL_A: TemplateDay = {
  title: 'Pull',
  exercises: [
    [PULL_UPS, 4, 8],
    [ROW, 4, 8],
    [CABLE_ROW, 3, 10],
    [FACE_PULLS, 3, 15],
    [BARBELL_CURL, 3, 10],
    [HAMMER_CURL, 3, 12],
  ],
};

const LEGS_A: TemplateDay = {
  title: 'Legs',
  exercises: [
    [SQUAT, 4, 6],
    [RDL, 3, 8],
    [LEG_PRESS, 3, 12],
    [LEG_CURL, 3, 12],
    [CALF_RAISE, 4, 12],
    [LEG_RAISE, 3, 12],
  ],
};

const PUSH_B: TemplateDay = {
  title: 'Push',
  exercises: [
    [INCLINE_BENCH, 4, 8],
    [DB_SHOULDER_PRESS, 3, 10],
    [CABLE_FLY, 3, 15],
    [LATERALS, 4, 15],
    [OVERHEAD_EXTENSION, 3, 12],
    [PUSHDOWN, 3, 15],
  ],
};

const PULL_B: TemplateDay = {
  title: 'Pull',
  exercises: [
    [DEADLIFT, 3, 5],
    [PULLDOWN, 4, 10],
    [CABLE_ROW, 3, 10],
    [FACE_PULLS, 3, 15],
    [INCLINE_CURL, 3, 12],
    [HAMMER_CURL, 3, 12],
  ],
};

const LEGS_B: TemplateDay = {
  title: 'Legs',
  exercises: [
    [RDL, 4, 8],
    [LEG_PRESS, 4, 12],
    [SPLIT_SQUAT, 3, 10],
    [LEG_CURL, 3, 12],
    [CALF_RAISE, 4, 15],
    [CABLE_CRUNCH, 3, 15],
  ],
};

function titled(day: TemplateDay, title: string): TemplateDay {
  return { ...day, title };
}

/** Ordered: the first template for a day count is the recommended one. */
export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: 'full-body-2',
    name: 'Full Body',
    daysPerWeek: 2,
    days: [FULL_BODY_A, FULL_BODY_B],
  },
  {
    id: 'full-body-3',
    name: 'Full Body',
    daysPerWeek: 3,
    days: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C],
  },
  {
    id: 'push-pull-legs-3',
    name: 'Push Pull Legs',
    daysPerWeek: 3,
    days: [PUSH_A, PULL_A, LEGS_A],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper Lower',
    daysPerWeek: 4,
    days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  },
  {
    id: 'upper-lower-ppl-5',
    name: 'Upper Lower + PPL',
    daysPerWeek: 5,
    days: [
      titled(UPPER_A, 'Upper'),
      titled(LOWER_A, 'Lower'),
      PUSH_B,
      PULL_B,
      LEGS_B,
    ],
  },
  {
    id: 'push-pull-legs-6',
    name: 'Push Pull Legs',
    daysPerWeek: 6,
    days: [
      titled(PUSH_A, 'Push A'),
      titled(PULL_A, 'Pull A'),
      titled(LEGS_A, 'Legs A'),
      titled(PUSH_B, 'Push B'),
      titled(PULL_B, 'Pull B'),
      titled(LEGS_B, 'Legs B'),
    ],
  },
];

export function isStarterDayCount(value: number): value is StarterDayCount {
  return (STARTER_DAY_COUNTS as readonly number[]).includes(value);
}

export function starterTemplatesForDays(daysPerWeek: number): StarterTemplate[] {
  return STARTER_TEMPLATES.filter((template) => template.daysPerWeek === daysPerWeek);
}

export function starterTemplateById(id: string | null | undefined): StarterTemplate | null {
  return STARTER_TEMPLATES.find((template) => template.id === id) ?? null;
}

function prescribe([id, sets, reps]: Prescribed): ExercisePrescription {
  const row = bundledExerciseById(id);
  if (!row) {
    throw new Error(`Starter template exercise "${id}" is not in the bundled catalog.`);
  }
  return { ...clonePrescription(row), sets, reps, repScheme: null };
}

/** A new, independent plan (fresh plan, day and exercise ids) built from a template. */
export function planFromStarterTemplate(template: StarterTemplate): WorkoutPlan {
  const days: WorkoutDay[] = template.days.map((day) => ({
    id: newId(),
    title: day.title,
    exercises: day.exercises.map(prescribe),
  }));
  return {
    id: newId(),
    name: template.name,
    daysPerWeek: days.length,
    createdAt: new Date().toISOString(),
    days,
  };
}

/**
 * The "Build my own" scaffold: an unnamed plan with one empty day per training day.
 * Unnamed on purpose: the plan editor focuses the name, and discards the draft if the
 * user backs out without naming it or adding an exercise (no orphan plans).
 */
export function emptyPlanWithDays(daysPerWeek: number): WorkoutPlan {
  const count = Math.max(1, Math.round(daysPerWeek));
  const days = Array.from({ length: count }, (_, index) => emptyDay(`Day ${index + 1}`));
  return {
    id: newId(),
    name: '',
    daysPerWeek: count,
    createdAt: new Date().toISOString(),
    days,
  };
}

/** Every template exercise id that does not resolve in the bundled catalog. Empty when valid. */
export function missingStarterExerciseIds(): string[] {
  const missing = new Set<string>();
  for (const template of STARTER_TEMPLATES) {
    for (const day of template.days) {
      for (const [id] of day.exercises) {
        if (!bundledExerciseById(id)) {
          missing.add(`${template.id} / ${day.title}: ${id}`);
        }
      }
    }
  }
  return [...missing];
}

declare const __DEV__: boolean | undefined;

// Fail loudly in development if a catalog rename ever orphans a template row.
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const missing = missingStarterExerciseIds();
  if (missing.length > 0) {
    throw new Error(`Starter templates reference missing exercises:\n${missing.join('\n')}`);
  }
}
