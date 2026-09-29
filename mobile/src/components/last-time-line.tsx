import { Fact } from '@/components/fact';
import { lastTimeValue } from '@/domain/log-session';
import type { LoggedSet } from '@/domain/types';

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
 * The quiet fact under `Set n of m` on the log stage: the last-time glyph, then `72.5 kg × 8`.
 * The glyph stands in for the words `Last time` (trim-ui §7 Fact glyphs), so between sets the
 * eye lands on the number, not on the name of the line; VoiceOver still reads `Last time`.
 * The load carries the unit so the line reads on its own. Text comes from the pure
 * `lastTimeValue` in `domain/log-session.ts`.
 *
 * Next-session targets wrap this line in `TargetLine` (`target-line.tsx`), in the same
 * 15pt caption slot, so the stage keeps its height and never jumps.
 */
export function LastTimeLine({ previousSets, setIndex, minutes, units }: LastTimeLineProps) {
  const value = lastTimeValue(previousSets, setIndex, { minutes, unit: units });
  if (!value) {
    return null;
  }
  return (
    <Fact kind="lastTime" testID="log-last-time">
      {value}
    </Fact>
  );
}
