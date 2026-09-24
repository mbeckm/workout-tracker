import { Text } from 'react-native';

import { lastTimeText } from '@/domain/log-session';
import type { LoggedSet } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

export type LastTimeLineProps = {
  /** Sets from the last session of this exercise (`previousLogForExercise(name)?.sets`). */
  previousSets: readonly LoggedSet[] | null | undefined;
  /**
   * The set on the stage (0-based): the line shows last session's set at the same
   * position. `'all'` summarizes the whole last session (exercise done).
   */
  setIndex: number | 'all';
  /** Cardio: duration reads in minutes. */
  minutes: boolean;
};

/**
 * The quiet fact under `Set n of m` on the log stage: `Last time 72.5 × 8`.
 * Units never ride along (the well label carries them). Text comes from the pure
 * `lastTimeText` in `domain/log-session.ts`.
 *
 * Seam for next-session targets: a `TargetLine` (suggested weight × reps) takes the
 * same props plus its suggestion and renders beside or instead of this line, in the
 * same 15pt caption slot, so the stage keeps its height and never jumps.
 */
export function LastTimeLine({ previousSets, setIndex, minutes }: LastTimeLineProps) {
  const { colors, type } = useTheme();
  const text = lastTimeText(previousSets, setIndex, { minutes });
  if (!text) {
    return null;
  }
  return (
    <Text
      numberOfLines={1}
      testID="log-last-time"
      style={[
        type.kicker,
        { fontWeight: '400', color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] },
      ]}>
      {text}
    </Text>
  );
}
