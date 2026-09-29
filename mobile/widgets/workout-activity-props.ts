export type WorkoutActivityProps = {
  exerciseName: string;
  exerciseImageUri?: string;
  openUrl: string;
  isResting: boolean;
  restStartEpochMs: number;
  restEndEpochMs: number;
  /** Rest ran out and the next set is up: `Go` where the clock was. */
  restOver: boolean;
};
