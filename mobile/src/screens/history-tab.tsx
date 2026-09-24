import { Link, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PaperEmpty, PaperScreen } from '@/components/paper';
import { PrCrownCount } from '@/components/pr-crown';
import { useTheme } from '@/theme/theme-context';
import {
  formatHistoryMonth,
  formatHistoryMonthCount,
  formatHistorySessionMeta,
  personalBestCount,
} from '@/domain/helpers';
import { formatPrCount } from '@/domain/set-lines';
import type { LoggedWorkout } from '@/domain/types';
import { confirmDeleteWorkout } from '@/screens/history-session';
import { useWorkoutStore } from '@/store/workout-store';

function groupByMonth(workouts: LoggedWorkout[]) {
  const groups: { key: string; label: string; workouts: LoggedWorkout[] }[] = [];

  for (const workout of workouts) {
    const date = new Date(workout.completedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = groups[groups.length - 1];
    if (current?.key === key) {
      current.workouts.push(workout);
    } else {
      groups.push({ key, label: formatHistoryMonth(workout.completedAt), workouts: [workout] });
    }
  }

  return groups;
}

/**
 * Tap opens the session. Long-press opens the native context menu (Delete) on iOS,
 * matching Plans; VoiceOver gets the same Delete as a rotor action (HI-1, G-6).
 */
function SessionRow({
  workout,
  prCount,
  showDivider,
  onDelete,
}: {
  workout: LoggedWorkout;
  prCount: number;
  showDivider: boolean;
  onDelete: () => void;
}) {
  const { colors, type } = useTheme();
  const meta = formatHistorySessionMeta(workout, undefined, { inMonth: true });
  const accessibility =
    prCount > 0
      ? `${workout.title}, ${meta}, ${formatPrCount(prCount)}`
      : `${workout.title}, ${meta}`;

  return (
    <Link href={`/history-session?id=${encodeURIComponent(workout.id)}`} asChild>
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibility}
          accessibilityActions={[{ name: 'delete', label: 'Delete workout' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') {
              onDelete();
            }
          }}
          // iOS long-press belongs to the native context menu; elsewhere it is the shortcut.
          onLongPress={Platform.OS === 'ios' ? undefined : onDelete}
          testID={`history-session-${workout.id}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          {/* Layout lives on an inner View: Link's Slot does not carry a style function on web. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: 14,
              paddingBottom: 14,
              gap: 12,
              backgroundColor: colors.systemBackground,
              borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
              borderBottomColor: colors.separator,
            }}>
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={type.row} numberOfLines={1}>
                {workout.title}
              </Text>
              <Text style={[type.kicker, { lineHeight: 18 }]} numberOfLines={2}>
                {meta}
              </Text>
            </View>
            {prCount > 0 ? <PrCrownCount count={prCount} /> : null}
          </View>
        </Pressable>
      </Link.Trigger>
      <Link.Menu>
        <Link.MenuAction title="Delete" icon="trash" destructive onPress={onDelete} />
      </Link.Menu>
    </Link>
  );
}

export function HistoryTab() {
  const { type } = useTheme();
  const { workoutHistory, deleteWorkout } = useWorkoutStore();
  const groups = useMemo(() => groupByMonth(workoutHistory), [workoutHistory]);

  return (
    <>
      <PaperScreen>
        <Text style={type.planTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          History
        </Text>
        {workoutHistory.length === 0 ? (
          <View style={{ flex: 1, paddingTop: 28 }}>
            <PaperEmpty
              testID="history-empty"
              subject="No workouts yet"
              caption="Finished workouts land here."
            />
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={{ paddingTop: 28 }}>
              <Text
                style={[type.kicker, { lineHeight: 20, marginBottom: 4 }]}
                accessibilityRole="header">
                {formatHistoryMonthCount(group.label, group.workouts.length)}
              </Text>
              {group.workouts.map((workout, index) => (
                <SessionRow
                  key={workout.id}
                  workout={workout}
                  prCount={personalBestCount(workout, workoutHistory)}
                  showDivider={index < group.workouts.length - 1}
                  onDelete={() => confirmDeleteWorkout(workout, () => deleteWorkout(workout.id))}
                />
              ))}
            </View>
          ))
        )}
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: 'History' }} />
    </>
  );
}
