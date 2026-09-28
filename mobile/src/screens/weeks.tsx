import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { meta, MetaRow } from '@/components/meta-row';
import { radius } from '@/constants/theme';
import { formatWeekLabel, recentWeeks, spokenWeek, type WeekTally } from '@/domain/weeks';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

const DOT = 10;
const DOT_GAP = 10;
const HEADER_MAX_SCALE = 1.3;

/**
 * Weeks (F6): Home's week amount, repeated back in time. Newest first, one row per Monday-based
 * week with the same dots as Home (a green dot per workout, up to the goal), so a week that met
 * the goal is a full green row. No streaks, no badges, no drill-down: it answers "how often
 * was I in the gym lately", nothing more.
 *
 * A native form sheet: one non-collapsable header plus one ScrollView (RNScreens formSheet).
 */
export function WeeksScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 20,
          paddingHorizontal: 12,
          paddingBottom: 4,
          backgroundColor: colors.secondarySystemBackground,
        }}>
        {/* Balances Done so the title sits centered. */}
        <View style={{ minWidth: 64 }} />
        {/* Header text stops growing like a native nav bar, so the title stays centered. */}
        <Text
          style={[type.body, { fontWeight: '600' }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={HEADER_MAX_SCALE}>
          Weeks
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={8}
          testID="weeks-done"
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 64,
            paddingHorizontal: 12,
            alignItems: 'flex-end',
            justifyContent: 'center',
            opacity: pressed ? 0.55 : 1,
          })}>
          <Text style={[type.body, { fontWeight: '600' }]} maxFontSizeMultiplier={HEADER_MAX_SCALE}>
            Done
          </Text>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        testID="weeks-sheet">
        <MetaRow
          style={{ paddingTop: 8, paddingBottom: 12 }}
          items={[meta.goal(goal), average != null ? meta.average(average) : null]}
          testID="weeks-summary"
        />
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
        gap: 16,
        minHeight: 52,
        paddingVertical: 14,
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <Text style={[type.body, { flex: 1 }]}>{formatWeekLabel(week, now)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: DOT_GAP, flexShrink: 0 }}>
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
