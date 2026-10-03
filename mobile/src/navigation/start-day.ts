import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import type { WorkoutDay, WorkoutPlan } from '@/domain/types';
import { useDevice } from '@/device/device-context';
import type { DeviceCommand } from '@/device/device-state';
import { track } from '@/analytics/analytics';
import { useWorkoutStore, type ActiveSession } from '@/store/workout-store';

export function sessionIsFor(
  session: ActiveSession | null | undefined,
  planId: string,
  dayId: string,
): boolean {
  return session != null && session.planId === planId && session.dayId === dayId;
}

/** A fresh start: focus the first exercise, and play the start moment. */
export function startDayCommand(planId: string, day: WorkoutDay): DeviceCommand {
  const exerciseId = day.exercises[0]?.id;
  return { mode: 'log', planId, dayId: day.id, ...(exerciseId ? { exerciseId } : {}), start: true };
}

/** The session in progress: no exercise, so the log restores its own focus. */
export function resumeCommand(session: ActiveSession): DeviceCommand {
  return { mode: 'log', planId: session.planId, dayId: session.dayId };
}

/**
 * The one way Home (and the old day preview) opens the log: puts the device in log mode.
 * Resumes the session in progress when it is for this day; asks first when another day is in
 * progress. `replace` also closes the route it was called from (the old day preview).
 */
export function useStartDay() {
  const router = useRouter();
  const { open } = useDevice();
  const { activeSession, plans, clearLogSession } = useWorkoutStore();

  return useCallback(
    (plan: WorkoutPlan, day: WorkoutDay, options: { replace?: boolean } = {}) => {
      const go = (command: DeviceCommand) => {
        open(command);
        if (options.replace && router.canDismiss()) {
          router.dismissTo('/');
        }
      };

      if (activeSession && sessionIsFor(activeSession, plan.id, day.id)) {
        track('workout_started', { exercises: day.exercises.length, resumed: true });
        go(resumeCommand(activeSession));
        return;
      }
      if (day.exercises.length === 0) {
        return;
      }
      track('workout_started', { exercises: day.exercises.length, resumed: false });

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
            { text: `Resume ${sessionDay.title}`, onPress: () => go(resumeCommand(activeSession)) },
            {
              text: `Start ${day.title}`,
              style: 'destructive',
              // The user chose to drop the other session here, so the log must not ask again.
              onPress: () => {
                clearLogSession({ planId: activeSession.planId, dayId: activeSession.dayId });
                go(startDayCommand(plan.id, day));
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }

      go(startDayCommand(plan.id, day));
    },
    [activeSession, clearLogSession, open, plans, router],
  );
}
