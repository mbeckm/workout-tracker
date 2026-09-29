export type WorkoutRestWindow = {
  startedAtMs: number;
  endsAtMs: number;
};

export type WorkoutLiveActivitySync = {
  planId: string;
  dayId: string;
  exerciseId: string;
  exerciseName: string;
  imageURL: string | null;
  rest: WorkoutRestWindow | null;
  /** The last rest ran out (or was skipped) and no new one has started. */
  restOver?: boolean;
};
