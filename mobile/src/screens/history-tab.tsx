import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PaperScreen } from '@/components/paper';
import { PrCrownCount } from '@/components/pr-crown';
import { useTheme } from '@/theme/theme-context';
import {
  formatHistoryMonth,
  formatHistoryMonthCount,
  formatHistorySessionMeta,
  personalBestCount,
} from '@/domain/helpers';
import type { LoggedWorkout } from '@/domain/types';
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

function SessionRow({
  workout,
  prCount,
  showDivider,
  onPress,
  onLongPress,
}: {
  workout: LoggedWorkout;
  prCount: number;
  showDivider: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, type } = useTheme();
  const meta = formatHistorySessionMeta(workout, undefined, { inMonth: true });
  const accessibility =
    prCount > 0
      ? `${workout.title}, ${meta}, ${prCount} ${prCount === 1 ? 'PR' : 'PRs'}`
      : `${workout.title}, ${meta}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibility}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={`history-session-${workout.id}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingTop: 14,
        paddingBottom: 14,
        gap: 12,
        borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={type.row} numberOfLines={1}>
          {workout.title}
        </Text>
        <Text style={[type.kicker, { lineHeight: 18 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {prCount > 0 ? <PrCrownCount count={prCount} /> : null}
    </Pressable>
  );
}

export function HistoryTab() {
  const { type } = useTheme();
  const router = useRouter();
  const { workoutHistory, deleteWorkout } = useWorkoutStore();
  const groups = useMemo(() => groupByMonth(workoutHistory), [workoutHistory]);

  return (
    <>
      <PaperScreen>
        <Text style={type.planTitle}>History</Text>
        {workoutHistory.length === 0 ? (
          <Text style={[type.kicker, { paddingTop: 28 }]}>No completed workouts yet.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={{ paddingTop: 28 }}>
              <Text style={[type.kicker, { lineHeight: 20, marginBottom: 4 }]}>
                {formatHistoryMonthCount(group.label, group.workouts.length)}
              </Text>
              {group.workouts.map((workout, index) => (
                <SessionRow
                  key={workout.id}
                  workout={workout}
                  prCount={personalBestCount(workout, workoutHistory)}
                  showDivider={index < group.workouts.length - 1}
                  onPress={() =>
                    router.push(`/history-session?id=${encodeURIComponent(workout.id)}`)
                  }
                  onLongPress={() =>
                    Alert.alert('Delete workout?', workout.title, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => deleteWorkout(workout.id),
                      },
                    ])
                  }
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
