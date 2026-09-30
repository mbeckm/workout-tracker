import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatGoalValue, GoalBlock } from '@/components/goal-block';
import { PaperScreen } from '@/components/paper';
import { PrCrown } from '@/components/pr-crown';
import { ProgressDelta } from '@/components/progress-delta';
import { ProgressReadout } from '@/components/progress-readout';
import { StaggerValue } from '@/components/stagger-value';
import { useProgressWindow, WindowChips } from '@/components/window-chips';
import { fontScaleCap, iconSize, space } from '@/constants/theme';
import { formatDoneWhen } from '@/domain/day-facts';
import { goalForLift, goalProgress } from '@/domain/goals';
import { formatLoggedSetLine } from '@/domain/helpers';
import {
  filterPointsByWindow,
  formatProgressChartSummary,
  formatProgressOneRM,
  formatProgressShortDate,
  isInProgressWindow,
  isProgressWindowLocked,
  isSessionPR,
  liftSeriesFromHistory,
  PROGRESS_HERO_LOCALE,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/**
 * Lift detail v5 (trim-ui §13 Lift / body detail, §11; PRODUCT-DECISIONS 63): the lift, its
 * goal block, the range chips, then the readout and chart as one object, and the sessions the
 * line plots. Scrubbing rolls the hero and the delta.
 */
export function ProgressLiftDetailScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const exerciseName = decodeURIComponent(name ?? '');
  const { units, workoutHistory, isPro, goals } = useWorkoutStore();
  const [window, setWindow] = useProgressWindow(isPro);
  const [scrubbed, setScrubbed] = useState<ProgressPoint | null>(null);

  const isLocked = (candidate: ProgressWindow) => isProgressWindowLocked(candidate, isPro);
  const unlockWindow = async (candidate: ProgressWindow) => {
    if (await requirePro('progress_history')) {
      setWindow(candidate);
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
  const filtered = useMemo(() => filterPointsByWindow(chartPoints, window), [chartPoints, window]);
  const latestOneRM = series.length > 0 ? series[series.length - 1].oneRM : null;
  const goal = goalForLift(goals, exerciseName);

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
  // The change over the range, from its first session to the value shown (trim-ui §11 rule 2).
  const change = heroValue != null && filtered.length >= 2 ? heroValue - filtered[0].value : null;

  const chartLabel = formatProgressChartSummary('Estimated 1-rep max', filtered, (value) =>
    formatProgressOneRM(value, units),
  );
  const openGoal = (next = false) =>
    router.push({ pathname: '/goal', params: next ? { name: exerciseName, next: '1' } : { name: exerciseName } });

  return (
    <>
      <PaperScreen testID="progress-lift-detail">
        <Text
          // Wraps, never truncates: long lift names at large text sizes need every word.
          style={type.title}
          accessibilityRole="header">
          {exerciseName}
        </Text>

        <View style={{ paddingTop: space.inset }}>
          <GoalBlock
            goal={
              goal
                ? {
                    target: `${formatGoalValue(goal.target)} ${units}`,
                    toGo:
                      latestOneRM != null
                        ? `${Math.max(0, Math.round(goal.target - latestOneRM))} ${units} to go`
                        : null,
                    progress: goalProgress(goal, latestOneRM),
                    reachedAt: goal.reachedAt,
                  }
                : null
            }
            testID="lift-goal"
            onEdit={() => openGoal()}
            onNext={() => openGoal(true)}
          />
        </View>

        {/* The range scopes everything under it: the delta, the line and the sessions (trim-ui §11 rule 6). */}
        <View style={{ paddingTop: space.inset }}>
          <WindowChips
            value={window}
            onChange={setWindow}
            locked={isLocked}
            onLockedPress={(candidate) => void unlockWindow(candidate)}
          />
        </View>

        <View style={{ paddingTop: space.gutter }}>
          <ProgressReadout
            // The scrubbed date takes the caption's place (trim-ui §11 rule 3).
            caption={scrubbed ? formatProgressShortDate(scrubbed.date) : 'Estimated 1RM'}
            hero={
              <StaggerValue
                value={heroRounded}
                format={{ maximumFractionDigits: 0, useGrouping: false }}
                locales={PROGRESS_HERO_LOCALE}
                style={type.hero}
              />
            }
            unit={units}
            delta={change != null ? <ProgressDelta change={change} unit={units} /> : null}
            points={filtered}
            emptyText="No sessions in this range"
            onScrub={setScrubbed}
            accessibilityLabel={chartLabel}
            goal={goal?.target ?? null}
            goalLabel={goal ? formatGoalValue(goal.target) : undefined}
            firstLabel={filtered.length > 1 ? String(Math.round(filtered[0].value)) : undefined}
          />
        </View>

        {recent.length > 0 ? (
          <Text style={[type.caption, { paddingTop: space.gutter, paddingBottom: space.related }]} accessibilityRole="header">
            Sessions
          </Text>
        ) : null}
        {recent.map((session, index) => {
          const pr = isSessionPR(exerciseName, session.oneRM, workoutHistory, session.workoutId);
          const when = formatDoneWhen(session.date);
          const best = formatLoggedSetLine(session.bestSet, { unit: units });
          return (
            <View
              key={session.workoutId}
              accessible
              accessibilityLabel={[when, best, formatProgressOneRM(session.oneRM, units), pr ? 'Personal best' : null]
                .filter(Boolean)
                .join(', ')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: space.related,
                gap: space.inline,
                borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: colors.separator,
              }}>
              <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
                <Text style={type.row}>{when}</Text>
                <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{best}</Text>
              </View>
              {pr ? <PrCrown size={iconSize.caption} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.tight }}>
                <Text style={[type.title, { fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={fontScaleCap.title}>
                  {String(Math.round(session.oneRM))}
                </Text>
                <Text style={type.caption} maxFontSizeMultiplier={fontScaleCap.title}>
                  {units}
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
