import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PaperScreen } from '@/components/paper';
import { iconSize, space } from '@/constants/theme';
import { PrCrown } from '@/components/pr-crown';
import { ProgressDelta } from '@/components/progress-delta';
import { ProgressLineChart } from '@/components/progress-line-chart';
import { StaggerValue } from '@/components/stagger-value';
import { WindowChips } from '@/components/window-chips';
import { formatLoggedSetLine } from '@/domain/helpers';
import {
  defaultProgressWindow,
  filterPointsByWindow,
  formatProgressChartSummary,
  formatProgressOneRM,
  formatProgressWindow,
  formatProgressShortDate,
  isInProgressWindow,
  isProgressWindowLocked,
  isSessionPR,
  liftSeriesFromHistory,
  percentFromWindowStart,
  PROGRESS_HERO_LOCALE,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { requirePro } from '@/purchases/pro-gate';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

const CHART_HEIGHT = 180;

export function ProgressLiftDetailScreen() {
  const { colors, type } = useTheme();
  const { width } = useWindowDimensions();
  const { name } = useLocalSearchParams<{ name: string }>();
  const exerciseName = decodeURIComponent(name ?? '');
  const { units, workoutHistory, isPro } = useWorkoutStore();
  // The picked window only counts while it is open to this user; otherwise the default for
  // the current entitlement. Buying Pro, or losing it, with the screen open just re-renders.
  const [picked, setPicked] = useState<ProgressWindow | null>(null);
  const window =
    picked != null && !isProgressWindowLocked(picked, isPro) ? picked : defaultProgressWindow(isPro);
  const [scrubbed, setScrubbed] = useState<ProgressPoint | null>(null);

  const isLocked = (candidate: ProgressWindow) => isProgressWindowLocked(candidate, isPro);
  const unlockWindow = async (candidate: ProgressWindow) => {
    if (await requirePro('progress_history')) {
      setPicked(candidate);
    }
  };

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

  const rangeLabel = `Estimated 1-rep max, ${formatProgressWindow(window).toLowerCase()}`;
  const chartLabel = formatProgressChartSummary('Estimated 1-rep max', filtered, (value) =>
    formatProgressOneRM(value, units),
  );
  const chartWidth = width - space.gutter * 2;

  return (
    <>
      <PaperScreen testID="progress-lift-detail">
        <Text
          // Wraps, never truncates: long lift names at large text sizes need every word.
          style={type.title}
          accessibilityRole="header">
          {exerciseName}
        </Text>

        {/* The range scopes everything under it: the delta, the line and the sessions (trim-ui → Charts 6). */}
        <View style={{ paddingTop: space.inset }}>
          <WindowChips
            value={window}
            onChange={setPicked}
            locked={isLocked}
            onLockedPress={(candidate) => void unlockWindow(candidate)}
          />
        </View>

        <View style={{ paddingTop: space.gutter, paddingBottom: space.gutter, gap: space.tight }}>
          {/* Wraps so the delta drops under the value when both don't fit (large Dynamic Type). */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              columnGap: space.inline,
              rowGap: space.tight,
            }}>
            <StaggerValue
              value={heroRounded}
              suffix={` ${units}`}
              format={{ maximumFractionDigits: 0, useGrouping: false }}
              locales={PROGRESS_HERO_LOCALE}
              style={type.hero}
            />
            {deltaRounded != null ? <ProgressDelta percent={deltaRounded} /> : null}
          </View>
          {/* The scrubbed date takes the range label's place (trim-ui → Charts 3). */}
          <Text style={type.caption}>
            {scrubbing && scrubbed ? formatProgressShortDate(scrubbed.date) : rangeLabel}
          </Text>
        </View>

        {filtered.length > 0 ? (
          <ProgressLineChart
            points={filtered}
            width={chartWidth}
            height={CHART_HEIGHT}
            onScrub={setScrubbed}
            accessibilityLabel={chartLabel}
          />
        ) : (
          // Same frame as the chart, so the sessions below never jump between ranges.
          <View style={{ height: CHART_HEIGHT }}>
            <Text style={type.caption}>No sessions in this range</Text>
          </View>
        )}

        {/* The sessions are the line's points, so they follow it closely. */}
        <View style={{ height: space.inset }} />

        {recent.map((session, index) => {
          const pr = isSessionPR(exerciseName, session.oneRM, workoutHistory, session.workoutId);
          return (
            <View key={session.workoutId}>
              {index > 0 ? (
                <View
                  style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }}
                />
              ) : null}
              {/* Two lanes: when and how (tertiary) leading, the e1RM (ink) trailing. */}
              <View
                accessible
                accessibilityLabel={[
                  formatProgressShortDate(session.date),
                  formatLoggedSetLine(session.bestSet, { unit: units }),
                  formatProgressOneRM(session.oneRM, units),
                  pr ? 'Personal best' : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: space.inset,
                  gap: space.inline,
                }}>
                <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
                  <Text style={type.caption}>{formatProgressShortDate(session.date)}</Text>
                  <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>
                    {formatLoggedSetLine(session.bestSet, { unit: units })}
                  </Text>
                </View>
                {pr ? <PrCrown size={iconSize.row} /> : null}
                <Text style={[type.row, { fontVariant: ['tabular-nums'] }]}>
                  {formatProgressOneRM(session.oneRM, units)}
                </Text>
              </View>
            </View>
          );
        })}
      </PaperScreen>
      <Stack.Screen
        options={{
          // The system bar: back button and scroll-edge glass; the name stays the `title` below.
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: colors.label,
          headerBackTitle: 'Progress',
          headerTitle: '',
          title: exerciseName,
        }}
      />
    </>
  );
}
