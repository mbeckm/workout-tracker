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
  const next = exerciseIndex + 1;
  return next < drafts.length ? next : exerciseIndex;
}
