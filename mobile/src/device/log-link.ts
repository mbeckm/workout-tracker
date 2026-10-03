import { peekWorkoutFocus, rememberWorkoutFocus } from '@/live-activity/controller';
import type { WorkoutLogLink } from '@/live-activity/url';

import type { DeviceCommand } from './device-state';

/**
 * The device command for a Live Activity link (`scratchworkout:///log?planId&dayId&exerciseId`).
 * Focus tracks the Live Activity card as the workout advances, so it wins over a possibly stale
 * ActivityKit start URL that still points at exercise 1.
 */
export function logCommandForLink(link: WorkoutLogLink & { start?: boolean }): DeviceCommand {
  const exerciseId = peekWorkoutFocus(link.planId, link.dayId) ?? link.exerciseId;
  if (exerciseId) {
    rememberWorkoutFocus({ planId: link.planId, dayId: link.dayId, exerciseId });
  }
  return {
    mode: 'log',
    planId: link.planId,
    dayId: link.dayId,
    ...(exerciseId ? { exerciseId } : {}),
    ...(link.start ? { start: true } : {}),
  };
}

/** True for a system path into the old `/log` route (any scheme, `/--/` prefix or none). */
export function isLogPath(path: string): boolean {
  const withoutQuery = path.split(/[?#]/)[0] ?? '';
  const withoutScheme = withoutQuery.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  return withoutScheme.split('/').includes('log');
}
