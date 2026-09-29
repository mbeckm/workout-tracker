import { SymbolView } from 'expo-symbols';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { HeaderActions } from '@/components/button';
import { ProgressSparkline } from '@/components/progress-sparkline';
import { showToast } from '@/components/toast';
import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space, spacing, TOUCH_TARGET } from '@/constants/theme';
import { PROGRESS_INDEX_BODY_METRICS } from '@/domain/check-in';
import { goalForLift, goalProgress, pinnedGoals, type Goal } from '@/domain/goals';
import {
  bodyMetricSeries,
  collectTrackedLifts,
  PROGRESS_SPARKLINE_DAYS,
  sparklineSince,
} from '@/domain/progress';
import { normalizedStatsKey } from '@/domain/types';
import { progressDemoMode } from '@/store/progress-demo';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/** Single-line rows on fixed lanes (trim-ui §13 Progress): 52 tall. */
const ROW_HEIGHT = TOUCH_TARGET + space.related;
/** The sparkline lane (trim-ui §13 Progress: 64pt). */
const SPARKLINE_WIDTH = 64;
const SPARKLINE_HEIGHT = 18;
/** The value lane fits `102.5 kg`; it grows with the text. */
const VALUE_LANE = 88;
/** The goal track (trim-ui §13 Progress: 8pt, green: progress toward a goal is completeness). */
const TRACK = spacing.sm;

const LIFTS_COLLAPSED = 5;

type Units = 'kg' | 'lbs';

/** `82`, `82.1`: a value whose unit sits beside it in `caption`. */
function formatValue(value: number, decimals: 0 | 1): string {
  if (decimals === 0) {
    return String(Math.round(value));
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function SectionCaption({ title, trailing }: { title: string; trailing?: string }) {
  const { type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingBottom: space.related }}>
      <Text style={[type.caption, { flex: 1 }]} accessibilityRole="header">
        {title}
      </Text>
      {trailing ? <Text style={type.caption}>{trailing}</Text> : null}
    </View>
  );
}

/** `118` `title` + `of 140 kg` / `kg` `caption` on one baseline. */
function Value({ value, suffix }: { value: string; suffix: string }) {
  const { type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: space.tight }}>
      <Text style={[type.title, { fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={fontScaleCap.title}>
        {value}
      </Text>
      <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={fontScaleCap.title}>
        {suffix}
      </Text>
    </View>
  );
}

/**
 * A lift or body row: `row` name, a 64pt sparkline of the window, the value in `title` + unit.
 * Three fixed lanes, hairlines, no chevron (trim-ui §13 Progress).
 */
function MetricRow({
  title,
  value,
  unit,
  spokenValue,
  sparkline,
  showDivider,
}: {
  title: string;
  value: string | null;
  unit: string;
  spokenValue?: string;
  sparkline: number[];
  showDivider: boolean;
}) {
  const { colors, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <View
      accessible
      accessibilityLabel={[title, spokenValue].filter(Boolean).join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inline,
        minHeight: ROW_HEIGHT,
        paddingVertical: space.related,
        borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <Text style={[type.row, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
        {title}
      </Text>
      <ProgressSparkline values={sparkline} width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} />
      <View style={{ minWidth: VALUE_LANE * Math.min(fontScale, fontScaleCap.title) }}>
        {value != null ? <Value value={value} suffix={unit} /> : <Value value="—" suffix="" />}
      </View>
    </View>
  );
}

/**
 * A pinned goal: `row` name with the current 1RM in `title` + `of 100 kg` on one line, and an
 * 8pt green track under it. Reached: a green ✓ after the name, `100 kg reached`, a full track.
 */
function GoalRow({
  goal,
  current,
  units,
  showDivider,
}: {
  goal: Goal;
  current: number | null;
  units: Units;
  showDivider: boolean;
}) {
  const { colors, type } = useTheme();
  const reached = goal.reachedAt != null;
  const progress = goalProgress(goal, current);
  const target = formatValue(goal.target, 1);
  return (
    <View
      accessible
      accessibilityLabel={
        reached
          ? `${goal.exerciseName} goal, ${target} ${units} reached`
          : `${goal.exerciseName} goal, ${current != null ? formatValue(current, 0) : 'no sets yet'} of ${target} ${units}`
      }
      style={{
        gap: space.related,
        paddingVertical: space.inset,
        borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.inline }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
          <Text style={[type.row, { flexShrink: 1 }]} numberOfLines={1}>
            {goal.exerciseName}
          </Text>
          {reached ? (
            <SymbolView name="checkmark" size={iconSize.caption} weight="bold" tintColor={colors.systemGreen} />
          ) : null}
        </View>
        {reached ? (
          <Value value={target} suffix={`${units} reached`} />
        ) : (
          <Value value={current != null ? formatValue(current, 0) : '—'} suffix={`of ${target} ${units}`} />
        )}
      </View>
      <View
        style={{
          height: TRACK,
          borderRadius: radius.full,
          backgroundColor: colors.systemGray5,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${Math.round(progress * 1000) / 10}%`,
            height: TRACK,
            borderRadius: radius.full,
            backgroundColor: colors.systemGreen,
          }}
        />
      </View>
    </View>
  );
}

/** Truncation peer row (house rule 11): same lanes as the rows it reveals. */
function MoreRow({
  title,
  expanded,
  onPress,
}: {
  title: string;
  expanded: boolean;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      testID="progress-lifts-more"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inline,
        minHeight: ROW_HEIGHT,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.separator,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <Text style={[type.row, { flex: 1, color: colors.tertiaryLabel }]}>{title}</Text>
      <SymbolView
        name={expanded ? 'chevron.up' : 'chevron.down'}
        tintColor={colors.tertiaryLabel}
        size={iconSize.caption}
        weight="semibold"
      />
    </Pressable>
  );
}

/** A row that opens its detail on tap and a native context menu on long-press. */
function MenuRow({
  href,
  testID,
  menu,
  children,
}: {
  href: { pathname: '/progress-lift' | '/progress-body'; params: Record<string, string> };
  testID?: string;
  menu?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <Pressable testID={testID} style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
          {children}
        </Pressable>
      </Link.Trigger>
      {menu}
    </Link>
  );
}

/**
 * Progress v3 (trim-ui §13 Progress, PRODUCT-DECISIONS 62 and 63): goals first, then lifts and
 * body, calm. Pinned goals lead with their track; a lift with a pinned goal lives only there.
 * Lifts and Body are single-line rows with a 30-day sparkline and the value. Long-press a lift
 * to set a goal; long-press a goal to edit, unpin or remove it (immediate, with Undo).
 */
export function ProgressTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { activePlan, bodyCheckIns, units, workoutHistory, goals, removeGoal, restoreGoal, setGoalPinned } =
    useWorkoutStore();
  const openCheckIn = () => router.push('/check-in');
  const openGoal = (exerciseName: string) =>
    router.push({ pathname: '/goal', params: { name: exerciseName } });
  const [liftsExpanded, setLiftsExpanded] = useState(false);

  useEffect(() => {
    const mode = progressDemoMode();
    if (mode === 'checkin' || mode === 'dark-checkin') {
      router.push('/check-in');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- demo deep link, once on mount
  }, []);

  const since = sparklineSince();
  const lifts = useMemo(
    () => collectTrackedLifts(workoutHistory, activePlan, units, null, since),
    [activePlan, since, units, workoutHistory],
  );
  const pinned = useMemo(() => pinnedGoals(goals), [goals]);
  const pinnedKeys = new Set(pinned.map((goal) => normalizedStatsKey(goal.exerciseName)));
  const oneRMs = new Map(lifts.map((lift) => [normalizedStatsKey(lift.name), lift.latestOneRM]));
  // A lift with a pinned goal appears once: under Goals.
  const listed = lifts.filter((lift) => !pinnedKeys.has(normalizedStatsKey(lift.name)));

  const bodyRows = useMemo(
    () =>
      PROGRESS_INDEX_BODY_METRICS.map((metric) => {
        const series = bodyMetricSeries(bodyCheckIns, metric.key, units);
        const latestPoint = series.length > 0 ? series[series.length - 1] : null;
        const unit = metric.key === 'bodyweightKg' ? units : 'cm';
        return {
          ...metric,
          unit,
          value: latestPoint ? formatValue(latestPoint.value, 1) : null,
          spokenValue: latestPoint ? `${formatValue(latestPoint.value, 1)} ${unit}` : undefined,
          sparkline: series
            .filter((point) => new Date(point.date).getTime() >= since)
            .slice(-8)
            .map((point) => point.value),
        };
      }),
    [bodyCheckIns, since, units],
  );

  const remove = (goal: Goal) => {
    const removed = removeGoal(goal.id);
    if (removed) {
      showToast({ title: 'Goal removed', onUndo: () => restoreGoal(removed) });
    }
  };

  // Plan order already puts the lifts you train first; the tail waits behind a peer row.
  const hiddenLiftCount = Math.max(0, listed.length - LIFTS_COLLAPSED);
  const visibleLifts = liftsExpanded ? listed : listed.slice(0, LIFTS_COLLAPSED);

  return (
    <>
      <ScrollView
        testID="progress-tab"
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentInsetAdjustmentBehavior="automatic"
        // Content shares the title's leading edge (trim-ui → Layout → Under a large title).
        contentContainerStyle={{
          paddingTop: space.section,
          paddingHorizontal: space.margin,
          paddingBottom: space.section,
        }}>
        {pinned.length > 0 ? (
          <View style={{ paddingBottom: space.section }} testID="progress-goals">
            <SectionCaption title="Goals" />
            {pinned.map((goal, index) => (
              <MenuRow
                key={goal.id}
                href={{ pathname: '/progress-lift', params: { name: goal.exerciseName } }}
                testID={`progress-goal-row-${index}`}
                menu={
                  <Link.Menu>
                    <Link.MenuAction title="Edit goal" icon="pencil" onPress={() => openGoal(goal.exerciseName)} />
                    <Link.MenuAction
                      title="Unpin from Progress"
                      icon="pin.slash"
                      onPress={() => setGoalPinned(goal.id, false)}
                    />
                    <Link.MenuAction title="Remove goal" icon="trash" destructive onPress={() => remove(goal)} />
                  </Link.Menu>
                }>
                <GoalRow
                  goal={goal}
                  current={oneRMs.get(normalizedStatsKey(goal.exerciseName)) ?? null}
                  units={units}
                  showDivider={index < pinned.length - 1}
                />
              </MenuRow>
            ))}
          </View>
        ) : null}

        <SectionCaption title="Lifts" trailing={`${PROGRESS_SPARKLINE_DAYS} days`} />
        {listed.length === 0 ? (
          <Text style={[type.row, { color: colors.tertiaryLabel, paddingVertical: space.inset }]}>
            No lifts yet
          </Text>
        ) : (
          <>
            {visibleLifts.map((lift, index) => {
              const goal = goalForLift(goals, lift.name);
              const added = lift.latestOneRM == null ? lift.indexValue.split(' ') : null;
              return (
                <MenuRow
                  key={lift.name}
                  href={{ pathname: '/progress-lift', params: { name: lift.name } }}
                  testID={`progress-lift-row-${lift.name.replace(/\s+/g, '-').toLowerCase()}`}
                  menu={
                    <Link.Menu>
                      <Link.MenuAction
                        title={goal ? 'Edit goal' : 'Set a goal'}
                        icon={goal ? 'pencil' : 'scope'}
                        onPress={() => openGoal(lift.name)}
                      />
                    </Link.Menu>
                  }>
                  <MetricRow
                    title={lift.name}
                    value={
                      lift.latestOneRM != null
                        ? formatValue(lift.latestOneRM, 0)
                        : added && added[0] !== '—'
                          ? added[0]
                          : null
                    }
                    unit={units}
                    spokenValue={lift.spokenValue}
                    sparkline={lift.sparkline}
                    showDivider={index < visibleLifts.length - 1}
                  />
                </MenuRow>
              );
            })}
            {hiddenLiftCount > 0 ? (
              <MoreRow
                title={
                  liftsExpanded
                    ? 'Show less'
                    : `${hiddenLiftCount} more ${hiddenLiftCount === 1 ? 'lift' : 'lifts'}`
                }
                expanded={liftsExpanded}
                onPress={() => setLiftsExpanded((current) => !current)}
              />
            ) : null}
          </>
        )}

        <View style={{ height: space.section }} />
        <SectionCaption title="Body" />
        {bodyCheckIns.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No check-ins yet. Log check-in"
            testID="progress-body-empty"
            onPress={openCheckIn}
            style={({ pressed }) => ({
              minHeight: TOUCH_TARGET,
              paddingVertical: space.inset,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            {/* The header carries the visible action; this row is a larger target for it. */}
            <Text style={[type.row, { color: colors.tertiaryLabel }]}>No check-ins yet</Text>
          </Pressable>
        ) : (
          bodyRows.map((row, index) => (
            <MenuRow
              key={row.key}
              href={{ pathname: '/progress-body', params: { metric: row.key } }}
              testID={`progress-body-row-${row.key}`}>
              <MetricRow
                title={row.label}
                value={row.value}
                unit={row.unit}
                spokenValue={row.spokenValue}
                sparkline={row.sparkline}
                showDivider={index < bodyRows.length - 1}
              />
            </MenuRow>
          ))
        )}
      </ScrollView>

      <HeaderActions right={{ title: 'Log check-in', variant: 'plain', onPress: openCheckIn }} />
    </>
  );
}
