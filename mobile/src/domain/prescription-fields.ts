import { durationIsMinutes, setCount, usesDuration, usesReps } from '@/domain/helpers';
import type { ExercisePrescription } from '@/domain/types';

export type PrescriptionField = {
  key: 'sets' | 'reps' | 'seconds' | 'minutes';
  /** Short label above the well (`Sets`, `Reps`, `Sec`, `Min`). */
  label: string;
  /** Spoken name for VoiceOver. */
  a11yLabel: string;
  value: number;
  min: number;
  max: number;
  /** What to write to the prescription for a committed value. */
  patch: (value: number) => Partial<ExercisePrescription>;
};

function setsField(exercise: ExercisePrescription): PrescriptionField {
  return {
    key: 'sets',
    label: 'Sets',
    a11yLabel: 'sets',
    value: setCount(exercise),
    min: 1,
    max: 99,
    patch: (sets) => ({
      sets,
      repScheme: null,
      // Interval timers log one set per round; keep the two in step.
      ...(exercise.rounds != null ? { rounds: sets } : {}),
    }),
  };
}

/**
 * The fields the day editor shows for one prescription, matching `formatPlanMetric`:
 * - cardio / distance work (`30 min`): one Min field, no sets.
 * - holds, stretches, timers (`3 × 45s`): Sets + Sec.
 * - everything else (`4 × 8`): Sets + Reps.
 */
export function prescriptionFields(exercise: ExercisePrescription): PrescriptionField[] {
  if (durationIsMinutes(exercise)) {
    return [
      {
        key: 'minutes',
        label: 'Min',
        a11yLabel: 'minutes',
        value: Math.max(1, Math.round((exercise.durationSeconds ?? 0) / 60) || 20),
        min: 1,
        max: 240,
        patch: (minutes) => ({ durationSeconds: minutes * 60 }),
      },
    ];
  }
  if (usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode)) {
    return [
      setsField(exercise),
      {
        key: 'seconds',
        label: 'Sec',
        a11yLabel: 'seconds per set',
        value: exercise.durationSeconds ?? 30,
        min: 5,
        max: 600,
        patch: (seconds) => ({ durationSeconds: seconds }),
      },
    ];
  }
  return [
    setsField(exercise),
    {
      key: 'reps',
      label: 'Reps',
      a11yLabel: 'reps per set',
      value: Math.max(1, exercise.reps || 8),
      min: 1,
      max: 99,
      patch: (reps) => ({ reps, repScheme: null }),
    },
  ];
}
