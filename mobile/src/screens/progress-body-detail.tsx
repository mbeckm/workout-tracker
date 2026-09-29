import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaperScreen } from '@/components/paper';
import { space } from '@/constants/theme';
import { ProgressDelta } from '@/components/progress-delta';
import { ProgressReadout } from '@/components/progress-readout';
import { StaggerValue } from '@/components/stagger-value';
import { useProgressWindow, WindowChips } from '@/components/window-chips';
import { BODY_METRICS, type BodyMetricKey } from '@/domain/check-in';
import {
  bodyMetricSeries,
  filterPointsByWindow,
  formatProgressChartSummary,
  formatProgressShortDate,
  isInProgressWindow,
  isProgressWindowLocked,
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
  const { metric } = useLocalSearchParams<{ metric: BodyMetricKey }>();
  const metricKey = (metric ?? 'waistCm') as BodyMetricKey;
  const metricMeta = BODY_METRICS.find((item) => item.key === metricKey) ?? BODY_METRICS[1];
  const { bodyCheckIns, units, isPro } = useWorkoutStore();
  // Body works exactly like lifts: `1M` and `3M` free, longer ranges Pro, behind the same gate
  // and paywall placement as lift detail, and the range carries over between them.
  const [window, setPicked] = useProgressWindow(isPro);
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
  // The change over the range, in the metric's unit: body values have no good direction, and
  // change is ink anyway (trim-ui §11 rule 2).
  const change = heroValue != null && filtered.length >= 2 ? heroValue - filtered[0].value : null;

  // The list follows the window, newest first, like lift detail.
  const recent = useMemo(
    () =>
      [...series]
        .reverse()
        .filter((point) => isInProgressWindow(point.date, window))
        .slice(0, 6),
    [series, window],
  );

  const chartLabel = formatProgressChartSummary(metricMeta.label, filtered, (value) =>
    formatBodyValue(value, metricKey, units),
  );

  return (
    <>
      <PaperScreen testID="progress-body-detail">
        <Text
          // Wraps, never truncates.
          style={type.title}
          accessibilityRole="header">
          {metricMeta.label}
        </Text>

        {/* The range scopes everything under it: the delta, the line and the check-ins (trim-ui → Charts 6). */}
        <View style={{ paddingTop: space.inset }}>
          <WindowChips
            value={window}
            onChange={setPicked}
            locked={isLocked}
            onLockedPress={(candidate) => void unlockWindow(candidate)}
          />
        </View>

        <View style={{ paddingTop: space.gutter, paddingBottom: space.gutter }}>
          <ProgressReadout
            // The scrubbed date takes the caption's place, so nothing jumps (trim-ui §11 rule 3).
            caption={scrubbing && scrubbed ? formatProgressShortDate(scrubbed.date) : metricMeta.label}
            hero={
              <StaggerValue
                value={heroNumber}
                suffix={bodyHeroSuffix(metricKey, units)}
                format={bodyHeroFormat(metricKey)}
                locales={PROGRESS_HERO_LOCALE}
                style={type.hero}
              />
            }
            delta={
              change != null ? (
                <ProgressDelta change={change} unit={bodyHeroSuffix(metricKey, units).trim()} decimals={1} />
              ) : null
            }
            points={filtered}
            emptyText={series.length === 0 ? 'No check-ins yet' : 'No check-ins in this range'}
            onScrub={setScrubbed}
            accessibilityLabel={chartLabel}
            firstLabel={filtered.length > 1 ? formatBodyValue(filtered[0].value, metricKey, units).split(' ')[0] : undefined}
          />
        </View>

        {/* The check-ins are the line's points, so they follow it closely. */}
        <View style={{ height: space.inset }} />

        {recent.map((point, index) => (
          <View key={point.date}>
            {index > 0 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
            ) : null}
            {/* Two lanes: the date (tertiary) leading, the value (ink) trailing. */}
            <View
              accessible
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space.inline,
                paddingVertical: space.inset,
              }}>
              <Text style={[type.caption, { flexShrink: 1 }]}>
                {formatProgressShortDate(point.date)}
              </Text>
              <Text style={[type.row, { fontVariant: ['tabular-nums'] }]}>
                {formatBodyValue(point.value, metricKey, units)}
              </Text>
            </View>
          </View>
        ))}
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
          title: metricMeta.label,
        }}
      />
    </>
  );
}
