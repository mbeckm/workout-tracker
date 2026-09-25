import { Pressable, Text, View } from 'react-native';

import { LastTimeLine } from '@/components/last-time-line';
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
 * The 15pt caption under `Set n of m`. Pro: `Target 87.5 × 8 · Last time 85 × 8` on one
 * line, the target a notch stronger. Free: `Last time 85 × 8`, with a trailing
 * `Target ›` when a target exists. Always one line, so the upper stage never jumps.
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
  const caption = [type.kicker, { fontWeight: '400' as const, fontVariant: ['tabular-nums' as const] }];
  const onStage = setIndex !== 'all' && target != null;

  if (unlocked && onStage) {
    const last = lastTimeSetFor(previousSets, setIndex);
    return (
      <Text
        numberOfLines={1}
        testID="log-target"
        accessible
        accessibilityLabel={spokenTargetLine(target, last, units)}
        style={[caption, { color: colors.tertiaryLabel }]}>
        <Text style={{ color: colors.secondaryLabel, fontWeight: '600' }}>
          {`Target ${formatLoggedSetLine(target, { minutes })}`}
        </Text>
        {last ? ` · Last time ${formatLoggedSetLine(last, { minutes })}` : null}
      </Text>
    );
  }

  if (!unlocked && onStage && onUnlock) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <LastTimeLine previousSets={previousSets} setIndex={setIndex} minutes={minutes} />
        </View>
        <Pressable
          onPress={onUnlock}
          testID="log-target-offer"
          accessibilityRole="button"
          accessibilityLabel="Target"
          accessibilityHint="Trim Pro suggests the weight and reps for each set."
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Text numberOfLines={1} style={[caption, { color: colors.secondaryLabel }]}>
            Target ›
          </Text>
        </Pressable>
      </View>
    );
  }

  return <LastTimeLine previousSets={previousSets} setIndex={setIndex} minutes={minutes} />;
}
