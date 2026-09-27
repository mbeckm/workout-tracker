import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

/** `Bench Press · Incline Press · Fly`: what the day is, so two "Push" days read apart. */
export function dayExerciseNames(day: Pick<WorkoutDay, 'exercises'>, limit = 3): string {
  const names = day.exercises.slice(0, limit).map((exercise) => exercise.name.trim());
  const more = day.exercises.length - names.length;
  return more > 0 ? `${names.join(' · ')} · +${more}` : names.join(' · ');
}

/**
 * One of the plan's other days on Home: title 17 + its exercises 15. A green check marks a
 * day already done this week. Tap opens the preview, where it can be started.
 */
export function HomeDayRow({
  day,
  doneThisWeek,
  doneLabel,
  showSeparator = false,
  onPress,
  testID,
}: {
  day: WorkoutDay;
  doneThisWeek: boolean;
  /** Spoken only: `Done today`. */
  doneLabel?: string | null;
  showSeparator?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const names = dayExerciseNames(day);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[day.title, names, doneThisWeek ? doneLabel ?? 'Done this week' : null]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Shows this day. Start it from there."
      testID={testID}
      style={({ pressed }) => ({
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: showSeparator ? 0.5 : 0,
        borderBottomColor: colors.separator,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={type.row} numberOfLines={1}>
          {day.title}
        </Text>
        <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={1}>
          {names}
        </Text>
      </View>
      {doneThisWeek ? (
        <SymbolView name="checkmark" tintColor={colors.systemGreen} size={16} weight="semibold" />
      ) : null}
    </Pressable>
  );
}
