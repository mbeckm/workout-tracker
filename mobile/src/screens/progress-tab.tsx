import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderActions } from '@/components/button';
import { ProgressSparkline } from '@/components/progress-sparkline';
import { iconSize, PRESSED_OPACITY, space, TOUCH_TARGET } from '@/constants/theme';
import { PROGRESS_INDEX_BODY_METRICS } from '@/domain/check-in';
import {
  bodyMetricSeries,
  collectTrackedLifts,
  filterPointsByWindow,
  FREE_PROGRESS_WINDOWS,
  formatProgressShortDate,
  formatProgressWeight,
  latestCheckIn,
} from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';
import { progressDemoMode } from '@/store/progress-demo';
import { useWorkoutStore } from '@/store/workout-store';

function SectionCaption({ title }: { title: string }) {
  const { type } = useTheme();
  return (
    <Text style={[type.caption, { paddingBottom: space.related }]} accessibilityRole="header">
      {title}
    </Text>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />;
}

/** `row` name over `caption` latest; sparkline and chevron in the trailing lane. Rows grow and wrap. */
function MetricRow({
  title,
  caption,
  spokenValue,
  sparkline,
  onPress,
  showDivider,
  testID,
}: {
  title: string;
  caption?: string;
  spokenValue?: string;
  sparkline: number[];
  onPress: () => void;
  showDivider?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, caption, spokenValue].filter(Boolean).join(', ')}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.inline,
          paddingVertical: space.inset,
          opacity: pressed ? PRESSED_OPACITY : 1,
        })}>
        <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
          <Text style={type.row} numberOfLines={2}>
            {title}
          </Text>
          {caption ? (
            <Text style={type.caption} numberOfLines={2}>
              {caption}
            </Text>
          ) : null}
        </View>
        <ProgressSparkline values={sparkline} />
        <SymbolView
          name="chevron.right"
          tintColor={colors.tertiaryLabel}
          size={iconSize.caption}
          weight="semibold"
        />
      </Pressable>
      {showDivider ? <Divider /> : null}
    </>
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
    <>
      <Divider />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID="progress-lifts-more"
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.inline,
          minHeight: TOUCH_TARGET,
          paddingVertical: space.inset,
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
    </>
  );
}

const LIFTS_COLLAPSED = 5;

export function ProgressTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { activePlan, bodyCheckIns, isPro, units, workoutHistory } = useWorkoutStore();
  const openCheckIn = () => router.push('/check-in');
  const [liftsExpanded, setLiftsExpanded] = useState(false);

  useEffect(() => {
    const mode = progressDemoMode();
    if (mode === 'checkin' || mode === 'dark-checkin') {
      router.push('/check-in');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- demo deep link, once on mount
  }, []);

  // Free: each sparkline, lift or body, stays inside the window detail opens (3M). Latest
  // values stay, as on the log screen's last time.
  const sparklineWindow = isPro ? null : FREE_PROGRESS_WINDOWS[0];
  const lifts = useMemo(
    () => collectTrackedLifts(workoutHistory, activePlan, units, sparklineWindow),
    [activePlan, sparklineWindow, units, workoutHistory],
  );
  const latest = useMemo(() => latestCheckIn(bodyCheckIns), [bodyCheckIns]);

  const bodyRows = useMemo(
    () =>
      PROGRESS_INDEX_BODY_METRICS.map((metric) => {
        const series = bodyMetricSeries(bodyCheckIns, metric.key, units);
        const latestPoint = series.length > 0 ? series[series.length - 1] : null;
        const spokenValue =
          latestPoint == null
            ? undefined
            : metric.key === 'bodyweightKg'
              ? formatProgressWeight(latestPoint.value, units)
              : `${latestPoint.value} cm`;
        return {
          ...metric,
          sparkline: (sparklineWindow == null
            ? series
            : filterPointsByWindow(series, sparklineWindow)
          )
            .slice(-8)
            .map((point) => point.value),
          spokenValue,
          caption: latestPoint
            ? `Last ${formatProgressShortDate(latestPoint.date)}`
            : undefined,
        };
      }),
    [bodyCheckIns, sparklineWindow, units],
  );

  // Plan order already puts the lifts you train first; the tail waits behind a peer row.
  const hiddenLiftCount = Math.max(0, lifts.length - LIFTS_COLLAPSED);
  const visibleLifts = liftsExpanded ? lifts : lifts.slice(0, LIFTS_COLLAPSED);

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
        <SectionCaption title="Lifts" />
        {lifts.length === 0 ? (
          <Text style={[type.row, { color: colors.tertiaryLabel, paddingVertical: space.inset }]}>
            No lifts yet
          </Text>
        ) : (
          <>
            {visibleLifts.map((lift, index) => (
              <MetricRow
                key={lift.name}
                title={lift.name}
                caption={
                  lift.latestDate ? `Last ${formatProgressShortDate(lift.latestDate)}` : undefined
                }
                spokenValue={lift.spokenValue}
                sparkline={lift.sparkline}
                showDivider={index < visibleLifts.length - 1}
                testID={`progress-lift-row-${lift.name.replace(/\s+/g, '-').toLowerCase()}`}
                onPress={() =>
                  router.push({ pathname: '/progress-lift', params: { name: lift.name } })
                }
              />
            ))}
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
            <MetricRow
              key={row.key}
              title={row.label}
              caption={row.caption}
              spokenValue={row.spokenValue}
              sparkline={row.sparkline}
              showDivider={index < bodyRows.length - 1}
              testID={`progress-body-row-${row.key}`}
              onPress={() =>
                router.push({ pathname: '/progress-body', params: { metric: row.key } })
              }
            />
          ))
        )}
      </ScrollView>

      <HeaderActions right={{ title: 'Log check-in', variant: 'plain', onPress: openCheckIn }} />
    </>
  );
}
