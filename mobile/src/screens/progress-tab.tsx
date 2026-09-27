import { SymbolView } from 'expo-symbols';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PaperScreen } from '@/components/paper';
import { ProgressSparkline } from '@/components/progress-sparkline';
import { PROGRESS_INDEX_BODY_METRICS } from '@/domain/check-in';
import {
  bodyMetricSeries,
  collectTrackedLifts,
  FREE_PROGRESS_WINDOWS,
  formatProgressShortDate,
  formatProgressWeight,
  latestCheckIn,
} from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';
import { progressDemoMode } from '@/store/progress-demo';
import { useWorkoutStore } from '@/store/workout-store';

function SectionHeader({ title }: { title: string }) {
  const { type } = useTheme();
  return (
    <View style={{ paddingTop: 28, paddingBottom: 8 }}>
      <Text style={type.title}>{title}</Text>
    </View>
  );
}

function MetricRow({
  title,
  caption,
  value,
  spokenValue,
  sparkline,
  onPress,
  showDivider,
  testID,
}: {
  title: string;
  caption?: string;
  value: string;
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
        accessibilityLabel={[title, caption, spokenValue ?? value].filter(Boolean).join(', ')}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          opacity: pressed ? 0.7 : 1,
        })}>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text style={type.row} numberOfLines={1}>
            {title}
          </Text>
          {caption ? (
            <Text
              style={[type.kicker, { color: colors.tertiaryLabel, lineHeight: 18 }]}
              numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
        <Text style={[type.subhead, { color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] }]}>
          {value}
        </Text>
        <ProgressSparkline values={sparkline} />
        <SymbolView name="chevron.right" tintColor={colors.tertiaryLabel} size={12} />
      </Pressable>
      {showDivider ? (
        <View style={{ height: 1, backgroundColor: colors.separator, opacity: 0.6 }} />
      ) : null}
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
      <View style={{ height: 1, backgroundColor: colors.separator, opacity: 0.6 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID="progress-lifts-more"
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
          paddingVertical: 14,
          opacity: pressed ? 0.7 : 1,
        })}>
        <Text style={[type.row, { flex: 1, color: colors.tertiaryLabel }]}>{title}</Text>
        <SymbolView
          name={expanded ? 'chevron.up' : 'chevron.down'}
          tintColor={colors.tertiaryLabel}
          size={14}
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

  // Free: each lift's sparkline stays inside the window lift detail opens (3M). Latest values
  // stay, as on the log screen's last time.
  const lifts = useMemo(
    () =>
      collectTrackedLifts(workoutHistory, activePlan, units, isPro ? null : FREE_PROGRESS_WINDOWS[0]),
    [activePlan, isPro, units, workoutHistory],
  );
  const latest = useMemo(() => latestCheckIn(bodyCheckIns), [bodyCheckIns]);

  const bodyRows = useMemo(
    () =>
      PROGRESS_INDEX_BODY_METRICS.map((metric) => {
        const series = bodyMetricSeries(bodyCheckIns, metric.key, units);
        const latestPoint = series.length > 0 ? series[series.length - 1] : null;
        const value =
          latestPoint == null
            ? '—'
            : metric.key === 'bodyweightKg'
              ? formatProgressWeight(latestPoint.value, units)
              : `${latestPoint.value} cm`;
        return {
          ...metric,
          // Body trends are Trim Pro: free rows keep the latest value and date, no line.
          sparkline: isPro ? series.slice(-8).map((point) => point.value) : [],
          value,
          caption: latestPoint
            ? `Last ${formatProgressShortDate(latestPoint.date)}`
            : undefined,
        };
      }),
    [bodyCheckIns, isPro, units],
  );

  // Plan order already puts the lifts you train first; the tail waits behind a peer row.
  const hiddenLiftCount = Math.max(0, lifts.length - LIFTS_COLLAPSED);
  const visibleLifts = liftsExpanded ? lifts : lifts.slice(0, LIFTS_COLLAPSED);

  return (
    <>
      <PaperScreen testID="progress-tab">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}>
          <Text style={[type.planTitle, { flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
            Progress
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log check-in"
            testID="progress-log-check-in"
            onPress={openCheckIn}
            style={({ pressed }) => ({
              flexGrow: 0,
              flexShrink: 0,
              paddingTop: 6,
              opacity: pressed ? 0.55 : 1,
            })}>
            <Text style={[type.headline, { color: colors.label, fontWeight: '500' }]}>
              Log check-in
            </Text>
          </Pressable>
        </View>

        <SectionHeader title="Lifts" />
        {lifts.length === 0 ? (
          <Text style={[type.kicker, { paddingTop: 8 }]}>Log a workout to track lifts here.</Text>
        ) : (
          <>
            {visibleLifts.map((lift, index) => (
              <MetricRow
                key={lift.name}
                title={lift.name}
                value={lift.indexValue}
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

        <SectionHeader title="Body" />
        {bodyCheckIns.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No check-ins yet. Log check-in"
            testID="progress-body-empty"
            onPress={openCheckIn}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 44,
              paddingVertical: 14,
              opacity: pressed ? 0.7 : 1,
            })}>
            {/* The header carries the visible action; this row is a larger target for it. */}
            <Text style={[type.row, { flex: 1, color: colors.tertiaryLabel }]}>
              No check-ins yet
            </Text>
          </Pressable>
        ) : (
          bodyRows.map((row, index) => (
            <MetricRow
              key={row.key}
              title={row.label}
              caption={row.caption}
              value={row.value}
              sparkline={row.sparkline}
              showDivider={index < bodyRows.length - 1}
              testID={`progress-body-row-${row.key}`}
              onPress={() =>
                router.push({ pathname: '/progress-body', params: { metric: row.key } })
              }
            />
          ))
        )}
      </PaperScreen>

      <Stack.Screen options={{ headerShown: false, title: 'Progress' }} />
    </>
  );
}
