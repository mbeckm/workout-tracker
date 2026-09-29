import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaperScreen } from '@/components/paper';
import { PrCrown } from '@/components/pr-crown';
import { ProgressDelta } from '@/components/progress-delta';
import { ProgressReadout } from '@/components/progress-readout';
import { StaggerValue } from '@/components/stagger-value';
import { useProgressWindow, WindowChips } from '@/components/window-chips';
import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space, spacing, TOUCH_TARGET } from '@/constants/theme';
import { formatDoneWhen } from '@/domain/day-facts';
import { goalForLift, goalProgress, type Goal } from '@/domain/goals';
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

/** The goal track (trim-ui §13 Goals: 8pt, green). */
const TRACK = spacing.sm;

/** `100`, `102.5`. */
function formatValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function Track({ progress }: { progress: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: TRACK, borderRadius: radius.full, backgroundColor: colors.systemGray5, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.round(progress * 1000) / 10}%`,
          height: TRACK,
          borderRadius: radius.full,
          backgroundColor: colors.systemGreen,
        }}
      />
    </View>
  );
}

/**
 * The goal block on top of lift detail (trim-ui §13 Lift / body detail, PRODUCT-DECISIONS 63):
 * `scope` + `Goal 100 kg` with `18 kg to go` and a chevron (→ the goal sheet), an 8pt green
 * track under it. Reached: 🎯 `Goal 100 kg reached` with its date, a full track and a gray
 * `+ Set next goal` pill. No goal: a quiet `Set a goal` row in its place.
 */
function GoalBlock({
  goal,
  current,
  units,
  onEdit,
  onNext,
}: {
  goal: Goal | null;
  current: number | null;
  units: 'kg' | 'lbs';
  onEdit: () => void;
  onNext: () => void;
}) {
  const { colors, type } = useTheme();
  const rowStyle = ({ pressed }: { pressed: boolean }) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.related,
    minHeight: TOUCH_TARGET,
    opacity: pressed ? PRESSED_OPACITY : 1,
  });

  if (!goal) {
    return (
      <Pressable accessibilityRole="button" onPress={onEdit} testID="lift-goal-set" style={rowStyle}>
        <SymbolView name="scope" size={iconSize.row} weight="medium" tintColor={colors.tertiaryLabel} />
        <Text style={[type.row, { flex: 1, color: colors.tertiaryLabel }]}>Set a goal</Text>
        <SymbolView name="chevron.right" size={iconSize.caption} weight="semibold" tintColor={colors.tertiaryLabel} />
      </Pressable>
    );
  }

  const target = `${formatValue(goal.target)} ${units}`;
  if (goal.reachedAt) {
    return (
      <View style={{ gap: space.related }} testID="lift-goal-reached">
        <View
          accessible
          accessibilityLabel={`Goal ${target} reached, ${formatProgressShortDate(goal.reachedAt)}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.related, minHeight: TOUCH_TARGET }}>
          <SymbolView name="scope" size={iconSize.row} weight="medium" tintColor={colors.systemGreen} />
          <Text style={[type.row, { flex: 1 }]} numberOfLines={2}>
            {`Goal ${target} reached`}
          </Text>
          <Text style={type.caption}>{formatProgressShortDate(goal.reachedAt)}</Text>
        </View>
        <Track progress={1} />
        <View style={{ flexDirection: 'row', paddingTop: space.related }}>
          <Pressable
            accessibilityRole="button"
            onPress={onNext}
            testID="lift-goal-next"
            hitSlop={{ top: space.tight, bottom: space.tight }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.tight,
              paddingVertical: space.related,
              paddingHorizontal: space.inset,
              borderRadius: radius.full,
              borderCurve: 'continuous',
              backgroundColor: colors.secondarySystemBackground,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            <SymbolView name="plus" size={iconSize.caption} weight="semibold" tintColor={colors.label} />
            <Text style={type.row}>Set next goal</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const toGo = current != null ? Math.max(0, Math.round(goal.target - current)) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Goal ${target}${toGo != null ? `, ${toGo} ${units} to go` : ''}`}
      onPress={onEdit}
      testID="lift-goal"
      style={({ pressed }) => ({ gap: space.related, opacity: pressed ? PRESSED_OPACITY : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.related, minHeight: TOUCH_TARGET }}>
        <SymbolView name="scope" size={iconSize.row} weight="medium" tintColor={colors.label} />
        <Text style={[type.row, { flex: 1 }]} numberOfLines={2}>
          {`Goal ${target}`}
        </Text>
        {toGo != null ? <Text style={type.caption}>{`${toGo} ${units} to go`}</Text> : null}
        <SymbolView name="chevron.right" size={iconSize.caption} weight="semibold" tintColor={colors.tertiaryLabel} />
      </View>
      <Track progress={goalProgress(goal, current)} />
    </Pressable>
  );
}

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
            goal={goal}
            current={latestOneRM}
            units={units}
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
            goalLabel={goal ? formatValue(goal.target) : undefined}
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
