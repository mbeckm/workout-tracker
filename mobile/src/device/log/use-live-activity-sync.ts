import { useEffect } from 'react';

import { exerciseStillMediaURL } from '@/catalog';
import type { DraftExercise, RestWindow } from '@/domain/log-session';
import { endWorkoutLiveActivity, syncWorkoutLiveActivity } from '@/live-activity/controller';
import { upcomingExerciseIndex } from '@/live-activity/upcoming';

/**
 * Keeps the Live Activity on the open workout, exactly as the old log did: it shows the
 * upcoming lift (the current one while it has sets left) and the rest window, and re-syncs on
 * every lift and rest change. Each sync also records the focus the Live Activity tap reopens.
 * Finish and discard end it explicitly; unmounting ends it too.
 */
export function useLiveActivitySync(input: {
  planId: string | null;
  dayId: string | null;
  drafts: readonly DraftExercise[];
  exerciseIndex: number;
  rest: RestWindow | null;
  restOver: boolean;
}) {
  const { planId, dayId, drafts, exerciseIndex, rest, restOver } = input;
  const nextIndex = upcomingExerciseIndex(drafts, exerciseIndex);
  const nextExercise = drafts[nextIndex];
  const nextExerciseId = nextExercise?.prescription.id;
  const nextExerciseName = nextExercise?.prescription.name;
  const nextImageURL = nextExercise ? exerciseStillMediaURL(nextExercise.prescription) : null;

  useEffect(() => {
    if (!planId || !dayId || !nextExerciseId || !nextExerciseName) {
      return;
    }
    void syncWorkoutLiveActivity({
      planId,
      dayId,
      exerciseId: nextExerciseId,
      exerciseName: nextExerciseName,
      imageURL: nextImageURL,
      rest,
      restOver,
    });
  }, [dayId, nextExerciseId, nextExerciseName, nextImageURL, planId, rest, restOver]);

  useEffect(() => {
    return () => {
      void endWorkoutLiveActivity();
    };
  }, []);
}
