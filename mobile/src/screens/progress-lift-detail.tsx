import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { PaperBack, PaperScreen } from '@/components/paper';
import { PrCrown } from '@/components/pr-crown';
import { ProgressDelta } from '@/components/progress-delta';
import { ProgressLineChart } from '@/components/progress-line-chart';
import { StaggerValue } from '@/components/stagger-value';
import { WindowChips } from '@/components/window-chips';
import { formatLoggedSetLine } from '@/domain/helpers';
import {
  filterPointsByWindow,
  formatProgressOneRM,
  formatProgressShortDate,
  isInProgressWindow,
  isSessionPR,
  liftSeriesFromHistory,
  percentFromWindowStart,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

export function ProgressLiftDetailScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { name } = useLocalSearchParams<{ name: string }>();
  const exerciseName = decodeURIComponent(name ?? '');
  const { units, workoutHistory } = useWorkoutStore();
  const [window, setWindow] = useState<ProgressWindow>('6M');
  const [scrubbed, setScrubbed] = useState<ProgressPoint | null>(null);

  const series = useMemo(
    () => liftSeriesFromHistory(exerciseName, workoutHistory),
    [exerciseName, workoutHistory],
  );

  const chartPoints = useMemo(
    () => series.map((point) => ({ date: point.date, value: point.oneRM })),
    [series],
  );

  const filtered = useMemo(
    () => filterPointsByWindow(chartPoints, window),
    [chartPoints, window],
  );

  const latestOneRM = series.length > 0 ? series[series.length - 1].oneRM : null;
  const scrubbing = scrubbed != null;

  // The list follows the chart: the same window, newest first.
  const recent = useMemo(
    () =>
      [...series]
        .reverse()
        .filter((point) => isInProgressWindow(point.date, window))
        .slice(0, 6),
    [series, window],
  );

  const heroValue = scrubbed?.value ?? latestOneRM;
  const heroRounded = heroValue != null ? Math.round(heroValue) : null;
  const delta =
    heroValue != null ? percentFromWindowStart(filtered, heroValue) : null;
  const deltaRounded = delta == null ? null : Math.round(delta);
  // Lifting more is completed work (green); flat or down stays in ink, never alarm red.
  const deltaColor =
    deltaRounded != null && deltaRounded > 0 ? colors.systemGreen : colors.label;

  const heroType = {
    fontSize: 52,
    fontWeight: '700' as const,
    letterSpacing: -0.03 * 52,
    color: colors.label,
  };

  const chartLabel =
    filtered.length >= 2
      ? `Estimated 1-rep max, ${formatProgressOneRM(filtered[0].value, units)} on ${formatProgressShortDate(filtered[0].date)} to ${formatProgressOneRM(filtered[filtered.length - 1].value, units)} on ${formatProgressShortDate(filtered[filtered.length - 1].date)}`
      : undefined;

  return (
    <>
      <PaperScreen testID="progress-lift-detail">
        <PaperBack onPress={() => router.back()} label="Progress" />
        <Text
          style={[type.title, { marginBottom: 16 }]}
          numberOfLines={1}
          accessibilityRole="header">
          {exerciseName}
        </Text>

        <WindowChips value={window} onChange={setWindow} />

        <View style={{ paddingTop: 28, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
            <StaggerValue value={heroRounded} suffix={` ${units}`} style={heroType} />
            {deltaRounded != null ? (
              <ProgressDelta percent={deltaRounded} color={deltaColor} />
            ) : null}
          </View>
          <Text style={[type.caption, { color: colors.tertiaryLabel, fontWeight: '400' }]}>
            {scrubbing && scrubbed
              ? formatProgressShortDate(scrubbed.date)
              : 'Estimated 1-rep max'}
          </Text>
        </View>

        {filtered.length >= 2 ? (
          <ProgressLineChart
            points={filtered}
            width={width - 48}
            height={180}
            onScrub={setScrubbed}
            accessibilityLabel={chartLabel}
          />
        ) : (
          <Text style={[type.kicker, { color: colors.tertiaryLabel, paddingVertical: 12 }]}>
            {filtered.length === 0
              ? 'No sessions in this window.'
              : 'Log this lift again to draw a line.'}
          </Text>
        )}

        <View style={{ height: 28 }} />

        {recent.length === 0 ? (
          series.length === 0 ? (
            <Text style={[type.kicker, { paddingTop: 4 }]}>No logged sets for this lift yet.</Text>
          ) : null
        ) : (
          recent.map((session, index) => {
            const pr = isSessionPR(exerciseName, session.oneRM, workoutHistory, session.workoutId);
            return (
              <View key={session.workoutId}>
                {index > 0 ? (
                  <View style={{ height: 1, backgroundColor: colors.separator, opacity: 0.6 }} />
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    gap: 12,
                  }}>
                  <Text style={[type.subhead, { minWidth: 56, color: colors.label }]}>
                    {formatProgressShortDate(session.date)}
                  </Text>
                  <Text
                    style={[
                      type.subhead,
                      { flex: 1, color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] },
                    ]}>
                    {formatLoggedSetLine(session.bestSet)}
                  </Text>
                  <Text style={[type.row, { fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                    {formatProgressOneRM(session.oneRM, units)}
                  </Text>
                  <View style={{ width: 14, alignItems: 'center' }}>
                    {pr ? <PrCrown size={14} /> : null}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: exerciseName }} />
    </>
  );
}
