import type { ExercisePrescription } from '@/domain/types';

/**
 * The log's `Choose another exercise` hands the exercise picker a request id; the picker
 * answers it with the chosen exercise and pops back. The log keeps its drafts in local
 * state, so the answer goes to the handler the log registered, never through the store.
 * The log unregisters when it unmounts, so a stale id resolves to nothing.
 */
type ReplaceHandler = (exercise: ExercisePrescription) => void;

const handlers = new Map<string, ReplaceHandler>();
let nextRequest = 0;

/** Registers `handler` and returns the id to pass to `/exercises?replace=<id>`, plus cleanup. */
export function openExerciseReplace(handler: ReplaceHandler): { id: string; close: () => void } {
  nextRequest += 1;
  const id = `replace-${nextRequest}`;
  handlers.set(id, handler);
  return { id, close: () => handlers.delete(id) };
}

/** The picker's answer. Consumed once; false when the log that asked is gone. */
export function resolveExerciseReplace(id: string, exercise: ExercisePrescription): boolean {
  const handler = handlers.get(id);
  if (!handler) {
    return false;
  }
  handlers.delete(id);
  handler(exercise);
  return true;
}
