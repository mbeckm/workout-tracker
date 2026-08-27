import { Pressable, Text, View } from 'react-native';

import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

export function PlanDetailDayRow({
  day,
  index,
  isFirst = false,
  onPress,
  onLongPress,
}: {
  day: WorkoutDay;
  index: number;
  isFirst?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, type } = useTheme();
  const names = day.exercises.map((exercise) => exercise.name.trim()).filter(Boolean);
  const meta = names.length > 0 ? names.join(' · ') : 'Add exercises';
  const count = names.length;
  const exerciseWord = count === 1 ? 'exercise' : 'exercises';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        count > 0
          ? `Day ${index + 1}, ${day.title}, ${count} ${exerciseWord}`
          : `Day ${index + 1}, ${day.title}, add exercises`
      }
      accessibilityHint={onPress ? 'Opens this training day' : undefined}
      testID={`plan-detail-day-${index}`}
      style={({ pressed }) => ({
        width: '100%',
        paddingTop: isFirst ? 0 : 14,
        paddingBottom: 14,
        gap: 2,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={type.row} numberOfLines={1}>
        {day.title}
      </Text>
      <Text
        style={[type.kicker, { color: colors.tertiaryLabel }]}
        numberOfLines={2}>
        {meta}
      </Text>
    </Pressable>
  );
}
