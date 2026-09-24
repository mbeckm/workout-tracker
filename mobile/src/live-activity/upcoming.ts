import { nextIncompleteIndex } from '@/domain/log-session';

/**
 * The exercise the Live Activity shows: the current one while it has sets left,
 * else the next one with work left (wrapping), else the current one.
 */
export function upcomingExerciseIndex(
  drafts: readonly { sets: readonly { done: boolean }[] }[],
  exerciseIndex: number,
): number {
  const current = drafts[exerciseIndex];
  if (!current) {
    return 0;
  }
  if (current.sets.some((set) => !set.done)) {
    return exerciseIndex;
  }
  const next = nextIncompleteIndex(drafts, exerciseIndex);
  return next >= 0 ? next : exerciseIndex;
}
