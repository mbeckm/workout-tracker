import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import type { WorkoutDay, WorkoutPlan } from '@/domain/types';
import { workoutLogHref } from '@/live-activity/url';
import { useWorkoutStore, type ActiveSession } from '@/store/workout-store';

export function sessionIsFor(
  session: ActiveSession | null | undefined,
  planId: string,
  dayId: string,
): boolean {
  return session != null && session.planId === planId && session.dayId === dayId;
}

/** `/log` for a fresh start: focus the first exercise. */
export function startDayHref(planId: string, day: WorkoutDay) {
  return workoutLogHref({ planId, dayId: day.id, exerciseId: day.exercises[0]?.id });
}

/** `/log` for the session in progress: no exercise, so the log restores its own focus. */
export function resumeHref(session: ActiveSession) {
  return workoutLogHref({ planId: session.planId, dayId: session.dayId });
}

/**
 * The one way Home and the day preview open the log. Resumes the session in progress when it
 * is for this day; asks first when another day is in progress.
 */
export function useStartDay() {
  const router = useRouter();
  const { activeSession, plans, clearLogSession } = useWorkoutStore();

  return useCallback(
    (plan: WorkoutPlan, day: WorkoutDay, options: { replace?: boolean } = {}) => {
      const go = (href: ReturnType<typeof workoutLogHref>) => {
        if (options.replace) {
          router.replace(href);
        } else {
          router.push(href);
        }
      };

      if (activeSession && sessionIsFor(activeSession, plan.id, day.id)) {
        go(resumeHref(activeSession));
        return;
      }
      if (day.exercises.length === 0) {
        return;
      }

      const sessionDay = activeSession
        ? plans
            .find((item) => item.id === activeSession.planId)
            ?.days.find((item) => item.id === activeSession.dayId)
        : undefined;
      if (activeSession && sessionDay) {
        const logged = activeSession.loggedSetCount;
        Alert.alert(
          `${sessionDay.title} is in progress`,
          logged > 0
            ? `${logged} ${logged === 1 ? 'set is' : 'sets are'} logged. Resume it, or start ${day.title} instead.`
            : `Resume it, or start ${day.title} instead.`,
          [
            { text: `Resume ${sessionDay.title}`, onPress: () => go(resumeHref(activeSession)) },
            {
              text: `Start ${day.title}`,
              style: 'destructive',
              // The user chose to drop the other session here, so the log must not ask again.
              onPress: () => {
                clearLogSession({ planId: activeSession.planId, dayId: activeSession.dayId });
                go(startDayHref(plan.id, day));
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }

      go(startDayHref(plan.id, day));
    },
    [activeSession, clearLogSession, plans, router],
  );
}
