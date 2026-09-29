import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, TOUCH_TARGET } from '@/constants/theme';
import {
  formatWeekLabel,
  formatWeeklyAverage,
  recentWeeks,
  spokenWeek,
  type WeekTally,
} from '@/domain/weeks';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

const DOT = 10;

/** `Goal 5 a week, average 3.1`: the two facts joined in words (trim-ui → Copy). */
function formatWeeksSummary(goal: number, average: number | null): string {
  const goalText = `Goal ${goal} a week`;
  return average != null ? `${goalText}, average ${formatWeeklyAverage(average)}` : goalText;
}

/**
 * Weeks (F6): Home's week amount, repeated back in time. Newest first, one row per Monday-based
 * week with the same dots as Home (a green dot per workout, up to the goal), so a week that met
 * the goal is a full green row (a streak week, PRODUCT-DECISIONS 51). No badges, no drill-down:
 * it answers "how often was I in the gym lately", nothing more.
 *
 * A native form sheet (trim-ui → Components → Sheets): grabber, `title`, content. It closes by
 * drag, so there's no Done. One non-collapsable header plus one ScrollView (RNScreens formSheet).
 */
export function WeeksScreen() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { activePlan, workoutHistory } = useWorkoutStore();
  const now = useMemo(() => new Date(), []);
  const { goal, weeks, average } = useMemo(
    () => recentWeeks(activePlan, workoutHistory, now),
    [activePlan, workoutHistory, now],
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Weeks' }} />
      <View
        collapsable={false}
        style={{
          gap: space.tight,
          paddingTop: space.gutter,
          paddingHorizontal: space.gutter,
          paddingBottom: space.related,
          backgroundColor: colors.secondarySystemBackground,
        }}>
        <Text style={type.title} accessibilityRole="header">
          Weeks
        </Text>
        <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]} testID="weeks-summary">
          {formatWeeksSummary(goal, average)}
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.gutter,
        }}
        testID="weeks-sheet">
        {weeks.map((week, index) => (
          <WeekRow
            key={week.start.toISOString()}
            week={week}
            goal={goal}
            now={now}
            showSeparator={index < weeks.length - 1}
          />
        ))}
      </ScrollView>
    </>
  );
}

function WeekRow({
  week,
  goal,
  now,
  showSeparator,
}: {
  week: WeekTally;
  goal: number;
  now: Date;
  showSeparator: boolean;
}) {
  const { colors, type } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={spokenWeek(week, goal, now)}
      testID={week.isCurrent ? 'weeks-row-current' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inset,
        minHeight: TOUCH_TARGET,
        paddingVertical: space.inset,
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <Text style={[type.row, { flex: 1 }]}>{formatWeekLabel(week, now)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.related, flexShrink: 0 }}>
        {Array.from({ length: goal }, (_, index) => (
          <View
            key={index}
            style={{
              width: DOT,
              height: DOT,
              borderRadius: radius.full,
              // Home's dots on the grouped sheet: gray4 keeps the same contrast gray5 has on white.
              backgroundColor: index < week.count ? colors.systemGreen : colors.systemGray4,
            }}
          />
        ))}
      </View>
    </View>
  );
}
