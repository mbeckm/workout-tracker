import type { WorkoutLiveActivitySync } from './types';

export async function syncWorkoutLiveActivity(_input: WorkoutLiveActivitySync): Promise<void> {}

export async function endWorkoutLiveActivity(): Promise<void> {}

export function peekWorkoutFocus(_planId: string, _dayId: string): string | undefined {
  return undefined;
}

export function rememberWorkoutFocus(_next: {
  planId: string;
  dayId: string;
  exerciseId: string;
}): void {}

export async function loadWorkoutFocus(_planId: string, _dayId: string): Promise<string | undefined> {
  return undefined;
}
