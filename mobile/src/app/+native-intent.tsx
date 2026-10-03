import { isLogPath } from '@/device/log-link';

/**
 * Live Activity taps open `scratchworkout:///log?planId&dayId&exerciseId` (the URL can't change).
 * The router lands on the device instead of stacking a `/log` screen; the root layout's link
 * listener reads the same URL and puts the device in log mode.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return isLogPath(path) ? '/' : path;
  } catch {
    return '/';
  }
}
