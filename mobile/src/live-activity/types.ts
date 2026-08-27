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
};
