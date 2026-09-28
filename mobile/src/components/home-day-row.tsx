import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { iconSize, PRESSED_OPACITY, space, TOUCH_TARGET } from '@/constants/theme';
import { formatExerciseNames } from '@/domain/day-facts';
import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

/**
 * One of the plan's other days on Home (trim-ui → Per screen → Home): the day's name in `row`
 * over its first exercises in words (`Bench Press, Incline Press and 2 more`), and a green
 * check in the trailing lane once it's done this week. Tap opens the preview, where it can be
 * started.
 */
export function HomeDayRow({
  day,
  doneThisWeek,
  showSeparator = false,
  onPress,
  testID,
}: {
  day: WorkoutDay;
  doneThisWeek: boolean;
  showSeparator?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const names = formatExerciseNames(day.exercises.map((exercise) => exercise.name));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[day.title, names, doneThisWeek ? 'done this week' : null]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Shows this day. Start it from there."
      testID={testID}
      style={({ pressed }) => ({
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inline,
        minHeight: TOUCH_TARGET,
        paddingVertical: space.inset,
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
        <Text style={type.row} numberOfLines={2}>
          {day.title}
        </Text>
        {names ? (
          <Text style={type.caption} numberOfLines={2}>
            {names}
          </Text>
        ) : null}
      </View>
      {doneThisWeek ? (
        <SymbolView
          name="checkmark"
          tintColor={colors.systemGreen}
          size={iconSize.row}
          weight="semibold"
          style={{ flexShrink: 0 }}
        />
      ) : null}
    </Pressable>
  );
}
