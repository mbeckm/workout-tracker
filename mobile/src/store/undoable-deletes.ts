import { showToast } from '@/components/toast';
import { withDay } from '@/domain/helpers';
import type { WorkoutPlan } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';

/**
 * Recoverable deletes: they happen at once, and an Undo toast offers them back for ~5s
 * (trim-ui §10 Forgiveness). A delete that drops the running workout puts it back on Undo too.
 */
export function useUndoableDeletes() {
  const { plans, activePlanId, logSession, deletePlan, editPlan, restorePlan, restoreSession } =
    useWorkoutStore();

  const restoreDroppedSession = (planId: string, dayId?: string) => {
    if (logSession && logSession.planId === planId && (dayId == null || logSession.dayId === dayId)) {
      restoreSession(logSession);
    }
  };

  const removePlan = (plan: WorkoutPlan) => {
    const removed = {
      plan,
      index: Math.max(0, plans.findIndex((item) => item.id === plan.id)),
      wasActive: activePlanId === plan.id,
    };
    deletePlan(plan);
    showToast({
      title: 'Plan deleted',
      onUndo: () => {
        restorePlan(removed);
        restoreDroppedSession(plan.id);
      },
    });
  };

  const removeDay = (plan: WorkoutPlan, dayId: string) => {
    const index = plan.days.findIndex((item) => item.id === dayId);
    const day = plan.days[index];
    if (!day || plan.days.length <= 1) {
      return;
    }
    editPlan(plan.id, (current) => {
      const days = current.days.filter((item) => item.id !== dayId);
      return { ...current, days, daysPerWeek: days.length };
    });
    showToast({
      title: 'Day deleted',
      onUndo: () => {
        editPlan(plan.id, (current) => {
          if (current.days.some((item) => item.id === dayId)) {
            return current;
          }
          const at = Math.min(index, current.days.length);
          const days = [...current.days.slice(0, at), day, ...current.days.slice(at)];
          return { ...current, days, daysPerWeek: days.length };
        });
        restoreDroppedSession(plan.id, dayId);
      },
    });
  };

  const removeExercise = (plan: WorkoutPlan, dayId: string, exerciseId: string) => {
    const day = plan.days.find((item) => item.id === dayId);
    const index = day?.exercises.findIndex((item) => item.id === exerciseId) ?? -1;
    const exercise = day?.exercises[index];
    if (!exercise) {
      return;
    }
    editPlan(plan.id, (current) =>
      withDay(current, dayId, (target) => ({
        ...target,
        exercises: target.exercises.filter((item) => item.id !== exerciseId),
      })),
    );
    showToast({
      title: 'Exercise removed',
      onUndo: () =>
        editPlan(plan.id, (current) =>
          withDay(current, dayId, (target) => {
            if (target.exercises.some((item) => item.id === exerciseId)) {
              return target;
            }
            const at = Math.min(index, target.exercises.length);
            return {
              ...target,
              exercises: [...target.exercises.slice(0, at), exercise, ...target.exercises.slice(at)],
            };
          }),
        ),
    });
  };

  return { removePlan, removeDay, removeExercise };
}
