import { SymbolView } from 'expo-symbols';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CheckInSheet } from '@/components/check-in-sheet';
import { PaperScreen } from '@/components/paper';
import { ProgressSparkline } from '@/components/progress-sparkline';
import { PROGRESS_INDEX_BODY_METRICS } from '@/domain/check-in';
import {
  bodyMetricSeries,
  collectTrackedLifts,
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
  sparkline,
  onPress,
  showDivider,
  testID,
}: {
  title: string;
  caption?: string;
  value: string;
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
        accessibilityLabel={caption ? `${title}, ${caption}, ${value}` : `${title}, ${value}`}
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
        <Text style={[type.subhead, { color: colors.tertiaryLabel }]}>{value}</Text>
        <ProgressSparkline values={sparkline} />
        <SymbolView name="chevron.right" tintColor={colors.tertiaryLabel} size={12} />
      </Pressable>
      {showDivider ? (
        <View style={{ height: 1, backgroundColor: colors.separator, opacity: 0.6 }} />
      ) : null}
    </>
  );
}

export function ProgressTab() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { activePlan, bodyCheckIns, saveCheckIn, units, workoutHistory } = useWorkoutStore();
  const [checkInOpen, setCheckInOpen] = useState(false);

  useEffect(() => {
    const mode = progressDemoMode();
    if (mode === 'checkin' || mode === 'dark-checkin') {
      setCheckInOpen(true);
    }
  }, []);

  const lifts = useMemo(
    () => collectTrackedLifts(workoutHistory, activePlan, units),
    [activePlan, units, workoutHistory],
  );
  const latest = useMemo(() => latestCheckIn(bodyCheckIns), [bodyCheckIns]);

  const bodyRows = useMemo(
    () =>
      PROGRESS_INDEX_BODY_METRICS.map((metric) => {
        const series = bodyMetricSeries(bodyCheckIns, metric.key);
        const latestPoint = series.length > 0 ? series[series.length - 1] : null;
        const value =
          latestPoint == null
            ? '—'
            : metric.key === 'bodyweightKg'
              ? formatProgressWeight(latestPoint.value, units)
              : `${latestPoint.value} cm`;
        return {
          ...metric,
          sparkline: series.slice(-8).map((point) => point.value),
          value,
          caption: latestPoint
            ? `Last ${formatProgressShortDate(latestPoint.date)}`
            : undefined,
        };
      }),
    [bodyCheckIns, units],
  );

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
            onPress={() => setCheckInOpen(true)}
            style={({ pressed }) => ({
              flexGrow: 0,
              flexShrink: 0,
              paddingTop: 6,
              opacity: pressed ? 0.55 : 1,
            })}>
            <Text style={[type.headline, { color: colors.systemBlue, fontWeight: '500' }]}>
              Log check-in
            </Text>
          </Pressable>
        </View>

        <SectionHeader title="Lifts" />
        {lifts.length === 0 ? (
          <Text style={[type.kicker, { paddingTop: 8 }]}>Log a workout to track lifts here.</Text>
        ) : (
          lifts.map((lift, index) => (
            <MetricRow
              key={lift.name}
              title={lift.name}
              value={lift.indexValue}
              sparkline={lift.sparkline}
              showDivider={index < lifts.length - 1}
              testID={`progress-lift-row-${lift.name.replace(/\s+/g, '-').toLowerCase()}`}
              onPress={() =>
                router.push({ pathname: '/progress-lift', params: { name: lift.name } })
              }
            />
          ))
        )}

        <SectionHeader title="Body" />
        {bodyRows.map((row, index) => (
          <MetricRow
            key={row.key}
            title={row.label}
            caption={row.caption}
            value={row.value}
            sparkline={row.sparkline}
            showDivider={index < bodyRows.length - 1}
            testID={`progress-body-row-${row.key}`}
            onPress={() => router.push({ pathname: '/progress-body', params: { metric: row.key } })}
          />
        ))}
      </PaperScreen>

      <CheckInSheet
        visible={checkInOpen}
        latest={latest}
        onClose={() => setCheckInOpen(false)}
        onSave={saveCheckIn}
      />

      <Stack.Screen options={{ headerShown: false, title: 'Progress' }} />
    </>
  );
}
