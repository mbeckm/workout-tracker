import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { iconSize, PRESSED_OPACITY, radius, space, spacing, TOUCH_TARGET } from '@/constants/theme';
import { formatProgressShortDate } from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';

/** The goal track (trim-ui §13 Goals: 8pt, green). */
const TRACK = spacing.sm;

/** `100`, `102.5`. */
export function formatGoalValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function Track({ progress }: { progress: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: TRACK, borderRadius: radius.full, backgroundColor: colors.systemGray5, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.round(progress * 1000) / 10}%`,
          height: TRACK,
          borderRadius: radius.full,
          backgroundColor: colors.systemGreen,
        }}
      />
    </View>
  );
}

export type GoalBlockGoal = {
  /** `100 kg`, `80 cm`. */
  target: string;
  /** `18 kg to go`, or null before there's a value. */
  toGo: string | null;
  /** 0 to 1. */
  progress: number;
  reachedAt: string | null;
};

/**
 * The goal block on top of lift and body detail (trim-ui §13 Lift / body detail, PRODUCT-DECISIONS
 * 63, 65): `scope` + `Goal 100 kg` with `18 kg to go` and a chevron (→ the goal sheet), an 8pt
 * green track under it. Reached: 🎯 `Goal 100 kg reached` with its date, a full track and a gray
 * `+ Set next goal` pill. No goal: a quiet `Set a goal` row in its place.
 */
export function GoalBlock({
  goal,
  testID,
  onEdit,
  onNext,
}: {
  goal: GoalBlockGoal | null;
  /** `lift-goal`, `body-goal`: the block's states add `-set`, `-reached` and `-next`. */
  testID: string;
  onEdit: () => void;
  onNext: () => void;
}) {
  const { colors, type } = useTheme();
  const rowStyle = ({ pressed }: { pressed: boolean }) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.related,
    minHeight: TOUCH_TARGET,
    opacity: pressed ? PRESSED_OPACITY : 1,
  });

  if (!goal) {
    return (
      <Pressable accessibilityRole="button" onPress={onEdit} testID={`${testID}-set`} style={rowStyle}>
        <SymbolView name="scope" size={iconSize.row} weight="medium" tintColor={colors.tertiaryLabel} />
        <Text style={[type.row, { flex: 1, color: colors.tertiaryLabel }]}>Set a goal</Text>
        <SymbolView name="chevron.right" size={iconSize.caption} weight="semibold" tintColor={colors.tertiaryLabel} />
      </Pressable>
    );
  }

  if (goal.reachedAt) {
    return (
      <View style={{ gap: space.related }} testID={`${testID}-reached`}>
        <View
          accessible
          accessibilityLabel={`Goal ${goal.target} reached, ${formatProgressShortDate(goal.reachedAt)}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.related, minHeight: TOUCH_TARGET }}>
          <SymbolView name="scope" size={iconSize.row} weight="medium" tintColor={colors.systemGreen} />
          <Text style={[type.row, { flex: 1 }]} numberOfLines={2}>
            {`Goal ${goal.target} reached`}
          </Text>
          <Text style={type.caption}>{formatProgressShortDate(goal.reachedAt)}</Text>
        </View>
        <Track progress={1} />
        <View style={{ flexDirection: 'row', paddingTop: space.related }}>
          <Pressable
            accessibilityRole="button"
            onPress={onNext}
            testID={`${testID}-next`}
            hitSlop={{ top: space.tight, bottom: space.tight }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.tight,
              paddingVertical: space.related,
              paddingHorizontal: space.inset,
              borderRadius: radius.full,
              borderCurve: 'continuous',
              backgroundColor: colors.secondarySystemBackground,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            <SymbolView name="plus" size={iconSize.caption} weight="semibold" tintColor={colors.label} />
            <Text style={type.row}>Set next goal</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Goal ${goal.target}${goal.toGo != null ? `, ${goal.toGo}` : ''}`}
      onPress={onEdit}
      testID={testID}
      style={({ pressed }) => ({ gap: space.related, opacity: pressed ? PRESSED_OPACITY : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.related, minHeight: TOUCH_TARGET }}>
        <SymbolView name="scope" size={iconSize.row} weight="medium" tintColor={colors.label} />
        <Text style={[type.row, { flex: 1 }]} numberOfLines={2}>
          {`Goal ${goal.target}`}
        </Text>
        {goal.toGo != null ? <Text style={type.caption}>{goal.toGo}</Text> : null}
        <SymbolView name="chevron.right" size={iconSize.caption} weight="semibold" tintColor={colors.tertiaryLabel} />
      </View>
      <Track progress={goal.progress} />
    </Pressable>
  );
}
