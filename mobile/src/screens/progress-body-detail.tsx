import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { PaperBack, PaperScreen } from '@/components/paper';
import { ProgressDelta } from '@/components/progress-delta';
import { ProgressLineChart } from '@/components/progress-line-chart';
import { StaggerValue } from '@/components/stagger-value';
import { WindowChips } from '@/components/window-chips';
import { BODY_METRICS, type BodyMetricKey } from '@/domain/check-in';
import {
  bodyMetricSeries,
  filterPointsByWindow,
  formatProgressShortDate,
  percentFromWindowStart,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

/** Series values are already in the user's units (`bodyMetricSeries(…, units)`). */
function formatBodyValue(value: number, key: BodyMetricKey, units: 'kg' | 'lbs'): string {
  if (key === 'bodyweightKg') {
    const rounded = Math.round(value * 10) / 10;
    const text = Number.isInteger(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1);
    return `${text} ${units}`;
  }
  return `${value} cm`;
}

function bodyHeroValue(value: number, key: BodyMetricKey): number {
  if (key === 'bodyweightKg') {
    return Math.round(value * 10) / 10;
  }
  return value;
}

function bodyHeroSuffix(key: BodyMetricKey, units: 'kg' | 'lbs'): string {
  return key === 'bodyweightKg' ? ` ${units}` : ' cm';
}

function bodyHeroFormat(key: BodyMetricKey): Intl.NumberFormatOptions | undefined {
  if (key === 'bodyweightKg') {
    return { minimumFractionDigits: 0, maximumFractionDigits: 1 };
  }
  return { maximumFractionDigits: 0 };
}

export function ProgressBodyDetailScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { metric } = useLocalSearchParams<{ metric: BodyMetricKey }>();
  const metricKey = (metric ?? 'waistCm') as BodyMetricKey;
  const metricMeta = BODY_METRICS.find((item) => item.key === metricKey) ?? BODY_METRICS[1];
  const { bodyCheckIns, units } = useWorkoutStore();
  const [window, setWindow] = useState<ProgressWindow>('6M');
  const [scrubbed, setScrubbed] = useState<ProgressPoint | null>(null);

  const series = useMemo(
    () => bodyMetricSeries(bodyCheckIns, metricKey, units),
    [bodyCheckIns, metricKey, units],
  );

  const filtered = useMemo(() => filterPointsByWindow(series, window), [series, window]);
  const latest = series.length > 0 ? series[series.length - 1].value : null;
  const scrubbing = scrubbed != null;

  const heroValue = scrubbed?.value ?? latest;
  const heroNumber = heroValue != null ? bodyHeroValue(heroValue, metricKey) : null;
  const delta =
    heroValue != null ? percentFromWindowStart(filtered, heroValue) : null;
  const deltaRounded = delta == null ? null : Math.round(delta);

  const heroType = {
    fontSize: 52,
    fontWeight: '700' as const,
    letterSpacing: -0.03 * 52,
    color: colors.label,
  };

  const recent = useMemo(() => [...series].reverse().slice(0, 6), [series]);

  const chartLabel =
    filtered.length >= 2
      ? `${metricMeta.label}, ${formatBodyValue(filtered[0].value, metricKey, units)} on ${formatProgressShortDate(filtered[0].date)} to ${formatBodyValue(filtered[filtered.length - 1].value, metricKey, units)} on ${formatProgressShortDate(filtered[filtered.length - 1].date)}`
      : undefined;

  return (
    <>
      <PaperScreen testID="progress-body-detail">
        <PaperBack onPress={() => router.back()} label="Progress" />
        <Text
          style={[type.title, { marginBottom: 16 }]}
          numberOfLines={1}
          accessibilityRole="header">
          {metricMeta.label}
        </Text>

        <WindowChips value={window} onChange={setWindow} />

        <View style={{ paddingTop: 28, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
            <StaggerValue
              value={heroNumber}
              suffix={bodyHeroSuffix(metricKey, units)}
              format={bodyHeroFormat(metricKey)}
              style={heroType}
            />
            {deltaRounded != null ? (
              // Down is often the goal for weight and waist: body deltas are never judged
              // by color. ▲/▼ carries direction; ink stays neutral.
              <ProgressDelta percent={deltaRounded} color={colors.label} />
            ) : null}
          </View>
          {scrubbing && scrubbed ? (
            <Text style={[type.caption, { color: colors.tertiaryLabel, fontWeight: '400' }]}>
              {formatProgressShortDate(scrubbed.date)}
            </Text>
          ) : null}
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
              ? 'No check-ins in this window.'
              : 'Check in again to draw a line.'}
          </Text>
        )}

        <View style={{ height: 28 }} />

        {recent.length === 0 ? (
          <Text style={[type.kicker, { paddingTop: 4 }]}>Log a check-in to start tracking.</Text>
        ) : (
          recent.map((point, index) => (
            <View key={point.date}>
              {index > 0 ? (
                <View style={{ height: 1, backgroundColor: colors.separator, opacity: 0.6 }} />
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                }}>
                <Text style={type.subhead}>{formatProgressShortDate(point.date)}</Text>
                <Text style={[type.row, { fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
                  {formatBodyValue(point.value, metricKey, units)}
                </Text>
              </View>
            </View>
          ))
        )}
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: metricMeta.label }} />
    </>
  );
}
