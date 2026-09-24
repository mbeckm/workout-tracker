import { Pressable, Text, View } from 'react-native';

import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

/** One of the plan's other days on Home: title 17 + fact meta 15. Tap opens the preview. */
export function HomeDayRow({
  day,
  meta,
  showSeparator = false,
  onPress,
  testID,
}: {
  day: WorkoutDay;
  meta: string;
  showSeparator?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${day.title}, ${meta}`}
      accessibilityHint="Shows this day. Start it from there."
      testID={testID}
      style={({ pressed }) => ({
        width: '100%',
        paddingVertical: 14,
        borderBottomWidth: showSeparator ? 0.5 : 0,
        borderBottomColor: colors.separator,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ gap: 2 }}>
        <Text style={type.row} numberOfLines={1}>
          {day.title}
        </Text>
        <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}
