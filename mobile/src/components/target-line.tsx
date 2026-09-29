import { Pressable, Text, View } from 'react-native';

import { Fact } from '@/components/fact';
import { LastTimeLine } from '@/components/last-time-line';
import { PRESSED_OPACITY, space } from '@/constants/theme';
import { formatLoggedSetLine } from '@/domain/helpers';
import { lastTimeSetFor } from '@/domain/log-session';
import { spokenTargetLine, type SetTarget, type TargetUnits } from '@/domain/targets';
import type { LoggedSet } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

export type TargetLineProps = {
  /** Sets from the last session of this exercise. */
  previousSets: readonly LoggedSet[] | null | undefined;
  /** The set on the stage (0-based), or `'all'` once the exercise is done. */
  setIndex: number | 'all';
  minutes: boolean;
  units: TargetUnits;
  /** This set's target. Null when there is none (no history, cardio, …). */
  target: SetTarget | null;
  /** Pro: the target leads the line. */
  unlocked: boolean;
  /**
   * Free: a quiet trailing `Target ›` that opens the paywall. Pass it only when the
   * caller wants the offer shown (never during rest, never after a dismissal).
   */
  onUnlock?: () => void;
};

/**
 * The 15pt caption under `Set n of m`. Pro: the target glyph + `87.5 kg × 8` in label ink,
 * with the last-time glyph + `85 kg × 8` in the trailing lane: two numbers on one line, told
 * apart by their glyphs instead of two labels (trim-ui §7 Fact glyphs). Free: the last-time
 * fact, with a trailing `Target ›` when a target exists (a command, so it keeps its word).
 * Always one line, so the upper stage never jumps.
 */
export function TargetLine({
  previousSets,
  setIndex,
  minutes,
  units,
  target,
  unlocked,
  onUnlock,
}: TargetLineProps) {
  const { colors, type } = useTheme();
  const caption = [type.kicker, { fontVariant: ['tabular-nums' as const] }];
  const onStage = setIndex !== 'all' && target != null;

  if (unlocked && onStage) {
    const last = lastTimeSetFor(previousSets, setIndex);
    return (
      <View
        testID="log-target"
        accessible
        accessibilityLabel={spokenTargetLine(target, last, units)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.inline }}>
        <Fact kind="target" ink="label">
          {formatLoggedSetLine(target, { minutes, unit: units })}
        </Fact>
        {last ? (
          <Fact kind="lastTime">{formatLoggedSetLine(last, { minutes, unit: units })}</Fact>
        ) : null}
      </View>
    );
  }

  if (!unlocked && onStage && onUnlock) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.inline }}>
        <View style={{ flexShrink: 1 }}>
          <LastTimeLine previousSets={previousSets} setIndex={setIndex} minutes={minutes} units={units} />
        </View>
        <Pressable
          onPress={onUnlock}
          testID="log-target-offer"
          accessibilityRole="button"
          accessibilityLabel="Target"
          accessibilityHint="Trim Pro suggests the weight and reps for each set."
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
          <Text numberOfLines={1} style={[caption, { color: colors.secondaryLabel }]}>
            Target ›
          </Text>
        </Pressable>
      </View>
    );
  }

  return <LastTimeLine previousSets={previousSets} setIndex={setIndex} minutes={minutes} units={units} />;
}
