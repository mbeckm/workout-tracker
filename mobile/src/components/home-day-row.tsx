import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import type { PlanDayStatus } from '@/domain/plan-loop';
import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

export function HomeDayRow({
  day,
  index,
  status = 'upcoming',
  isFirst = false,
  onPress,
  onLongPress,
}: {
  day: WorkoutDay;
  index: number;
  status?: PlanDayStatus;
  isFirst?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, type } = useTheme();
  const count = day.exercises.length;
  const rest = count === 0;
  const meta = rest ? 'Off' : `${count} ${count === 1 ? 'exercise' : 'exercises'}`;
  const completed = status === 'completed';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Day ${index + 1}, ${day.title}, ${meta}${completed ? ', completed' : ''}`}
      testID={`home-day-row-${index}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: isFirst ? 0 : 14,
        paddingBottom: 14,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.row} numberOfLines={1}>
          {day.title}
        </Text>
        <Text style={type.kicker} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {completed ? (
        <SymbolView
          name="checkmark"
          tintColor={colors.systemGreen}
          size={15}
          weight="bold"
          style={{ flexShrink: 0 }}
        />
      ) : null}
    </Pressable>
  );
}
