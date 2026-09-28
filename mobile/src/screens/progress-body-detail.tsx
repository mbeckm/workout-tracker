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
  defaultProgressWindow,
  filterPointsByWindow,
  formatProgressShortDate,
  isInProgressWindow,
  isProgressWindowLocked,
  percentFromWindowStart,
  PROGRESS_HERO_LOCALE,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { requirePro } from '@/purchases/pro-gate';
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
    return { minimumFractionDigits: 0, maximumFractionDigits: 1, useGrouping: false };
  }
  return { maximumFractionDigits: 0, useGrouping: false };
}

export function ProgressBodyDetailScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { metric } = useLocalSearchParams<{ metric: BodyMetricKey }>();
  const metricKey = (metric ?? 'waistCm') as BodyMetricKey;
  const metricMeta = BODY_METRICS.find((item) => item.key === metricKey) ?? BODY_METRICS[1];
  const { bodyCheckIns, units, isPro } = useWorkoutStore();
  // Body works exactly like lifts: free gets the 3M chart; longer windows are Pro, behind the
  // same gate and paywall placement as lift detail.
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
    () => bodyMetricSeries(bodyCheckIns, metricKey, units),
    [bodyCheckIns, metricKey, units],
  );

  const filtered = useMemo(() => filterPointsByWindow(series, window), [series, window]);
  const latest = series.length > 0 ? series[series.length - 1].value : null;
  const scrubbing = scrubbed != null;

  const heroValue = scrubbed?.value ?? latest;
  const heroNumber = heroValue != null ? bodyHeroValue(heroValue, metricKey) : null;
  const delta = heroValue != null ? percentFromWindowStart(filtered, heroValue) : null;
  const deltaRounded = delta == null ? null : Math.round(delta);

  const heroType = {
    fontSize: 52,
    fontWeight: '700' as const,
    letterSpacing: -0.03 * 52,
    color: colors.label,
  };

  // The list follows the window, newest first, like lift detail.
  const recent = useMemo(
    () =>
      [...series]
        .reverse()
        .filter((point) => isInProgressWindow(point.date, window))
        .slice(0, 6),
    [series, window],
  );

  const chartLabel =
    filtered.length >= 2
      ? `${metricMeta.label}, ${formatBodyValue(filtered[0].value, metricKey, units)} on ${formatProgressShortDate(filtered[0].date)} to ${formatBodyValue(filtered[filtered.length - 1].value, metricKey, units)} on ${formatProgressShortDate(filtered[filtered.length - 1].date)}`
      : undefined;

  return (
    <>
      <PaperScreen testID="progress-body-detail">
        <PaperBack onPress={() => router.back()} label="Progress" />
        <Text
          // Wraps, never truncates: long lift names at large text sizes need every word.
          style={[type.title, { marginBottom: 16 }]}
          accessibilityRole="header">
          {metricMeta.label}
        </Text>

        <WindowChips
          value={window}
          onChange={setPicked}
          locked={isLocked}
          onLockedPress={(candidate) => void unlockWindow(candidate)}
        />

        <View style={{ paddingTop: 28, paddingBottom: 20 }}>
          {/* Wraps so the delta drops under the value when both don't fit (large Dynamic Type). */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              columnGap: 16,
              rowGap: 4,
            }}>
            <StaggerValue
              value={heroNumber}
              suffix={bodyHeroSuffix(metricKey, units)}
              format={bodyHeroFormat(metricKey)}
              locales={PROGRESS_HERO_LOCALE}
              style={heroType}
            />
            {deltaRounded != null ? (
              // Down is often the goal for weight and waist: body deltas are never judged
              // by color. ▲/▼ carries direction; the grey stays neutral.
              <ProgressDelta percent={deltaRounded} color={colors.tertiaryLabel} />
            ) : null}
          </View>
          {/* Always one line, like lift detail's `Estimated 1-rep max`, so the chart doesn't jump
              when scrubbing starts. At rest it holds the place; the title already names the metric. */}
          <Text
            style={[
              type.caption,
              { color: colors.tertiaryLabel, fontWeight: '400', opacity: scrubbing ? 1 : 0 },
            ]}
            accessibilityElementsHidden={!scrubbing}
            importantForAccessibility={scrubbing ? 'auto' : 'no-hide-descendants'}>
            {scrubbing && scrubbed ? formatProgressShortDate(scrubbed.date) : ' '}
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
        ) : series.length === 0 ? null : (
          // Never recorded: the line below says how to start; no window message above it.
          <Text style={[type.kicker, { color: colors.tertiaryLabel, paddingVertical: 12 }]}>
            {filtered.length === 0
              ? 'No check-ins in this window.'
              : 'Check in again to draw a line.'}
          </Text>
        )}

        <View style={{ height: 28 }} />

        {recent.length === 0 ? (
          series.length === 0 ? (
            <Text style={[type.kicker, { paddingTop: 4 }]}>Log a check-in to start tracking.</Text>
          ) : null
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
                <Text style={[type.subhead, { color: colors.tertiaryLabel }]}>
                  {formatProgressShortDate(point.date)}
                </Text>
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
