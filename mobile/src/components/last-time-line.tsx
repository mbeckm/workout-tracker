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
  units: 'kg' | 'lbs';
};

/**
 * The quiet fact under `Set n of m` on the log stage: `Last time 72.5 kg × 8`.
 * The load carries the unit so the line reads on its own. Text comes from the pure
 * `lastTimeText` in `domain/log-session.ts`.
 *
 * Next-session targets wrap this line in `TargetLine` (`target-line.tsx`), in the same
 * 15pt caption slot, so the stage keeps its height and never jumps.
 */
export function LastTimeLine({ previousSets, setIndex, minutes, units }: LastTimeLineProps) {
  const { colors, type } = useTheme();
  const text = lastTimeText(previousSets, setIndex, { minutes, unit: units });
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
