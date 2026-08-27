export type WorkoutActivityProps = {
  exerciseName: string;
  exerciseImageUri?: string;
  openUrl: string;
  isResting: boolean;
  restStartEpochMs: number;
  restEndEpochMs: number;
};
