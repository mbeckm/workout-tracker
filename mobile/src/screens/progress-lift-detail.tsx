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
  isSessionPR,
  liftSeriesFromHistory,
  percentFromWindowStart,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

  const recent = useMemo(() => [...series].reverse().slice(0, 6), [series]);

  const heroValue = scrubbed?.value ?? latestOneRM;
  const heroRounded = heroValue != null ? Math.round(heroValue) : null;
  const delta =
    heroValue != null ? percentFromWindowStart(filtered, heroValue) : null;
  const deltaRounded = delta == null ? null : Math.round(delta);
  const deltaColor =
    deltaRounded != null && deltaRounded < 0 ? colors.systemRed : colors.systemGreen;

  const heroType = {
    fontSize: 52,
    fontWeight: '700' as const,
    letterSpacing: -0.03 * 52,
    color: colors.label,
  };

  return (
    <>
      <PaperScreen testID="progress-lift-detail">
        <PaperBack onPress={() => router.back()} label="Progress" />
        <Text style={[type.largeTitle, { marginBottom: 12 }]}>{exerciseName}</Text>

        <WindowChips value={window} onChange={setWindow} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 16,
            paddingTop: 28,
            paddingBottom: 20,
          }}>
          <StaggerValue value={heroRounded} suffix={` ${units}`} style={heroType} />
          {deltaRounded != null ? <ProgressDelta percent={deltaRounded} color={deltaColor} /> : null}
          <Text
            style={{
              fontSize: 13,
              fontWeight: '400',
              lineHeight: 18,
              color: colors.tertiaryLabel,
              // Match NumberFlow glyph line (plain Text sits on the slot-box bottom).
              transform: [{ translateY: -2 }],
            }}>
            {scrubbing && scrubbed ? formatProgressShortDate(scrubbed.date) : 'e1RM'}
          </Text>
        </View>

        <ProgressLineChart
          points={filtered}
          width={width - 48}
          height={180}
          onScrub={setScrubbed}
        />

        <View style={{ height: 28 }} />

        {recent.length === 0 ? (
          <Text style={[type.kicker, { paddingTop: 4 }]}>No logged sets for this lift yet.</Text>
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
                  <Text style={[type.subhead, { width: 56, color: colors.label }]}>
                    {formatShortDate(session.date)}
                  </Text>
                  <Text style={[type.subhead, { flex: 1, color: colors.tertiaryLabel }]}>
                    {formatLoggedSetLine(session.bestSet)}
                  </Text>
                  <Text style={[type.row, { fontWeight: '600' }]}>
                    {formatProgressOneRM(session.oneRM, units)}
                  </Text>
                  {pr ? <PrCrown size={14} /> : <View style={{ width: 14 }} />}
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
