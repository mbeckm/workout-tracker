import { planFromMatch } from '@/catalog/plan-import-match';
import { emptyDay } from '@/domain/helpers';
import { planDisplayName } from '@/device/plans-model';
import type { WorkoutPlan } from '@/domain/types';
import { track } from '@/analytics/analytics';

import { clearImport, type ImportSession } from './session';

/**
 * The imported plan, built from what was read, the Fix screen's answers and the name the owner
 * left (an empty name becomes its days' names, decision 71). Ends the session.
 */
export function importedPlan(session: ImportSession, where: 'onboarding' | 'plans'): WorkoutPlan {
  if (!session.match) {
    throw new Error('importedPlan: nothing was read');
  }
  const built = planFromMatch(session.match, session.fixes, session.name.trim());
  // Every lift left out still leaves a plan to fill in the editor, never one without days.
  const plan: WorkoutPlan = built.days.length > 0 ? built : { ...built, daysPerWeek: 1, days: [emptyDay('Day 1')] };
  // A source without a name gets the one Trim would show anyway (its days', decision 71), so every
  // list that reads `plan.name` has one.
  plan.name = planDisplayName(plan);
  const answers = [...session.fixes.values()];
  track('plan_imported', {
    days: plan.days.length,
    lifts: plan.days.reduce((sum, day) => sum + day.exercises.length, 0),
    left_out: answers.filter((answer) => answer == null).length,
    custom: answers.filter((answer) => answer?.customExerciseID != null).length,
    where,
  });
  clearImport();
  return plan;
}
