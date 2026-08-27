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
    () => bodyMetricSeries(bodyCheckIns, metricKey),
    [bodyCheckIns, metricKey],
  );

  const filtered = useMemo(() => filterPointsByWindow(series, window), [series, window]);
  const latest = series.length > 0 ? series[series.length - 1].value : null;
  const scrubbing = scrubbed != null;

  const heroValue = scrubbed?.value ?? latest;
  const heroNumber = heroValue != null ? bodyHeroValue(heroValue, metricKey) : null;
  const delta =
    heroValue != null ? percentFromWindowStart(filtered, heroValue) : null;
  const deltaRounded = delta == null ? null : Math.round(delta);
  const deltaColor =
    deltaRounded != null && deltaRounded < 0 ? colors.systemRed : colors.systemGreen;

  const heroType = {
    fontSize: 52,
    fontWeight: '700' as const,
    letterSpacing: -0.03 * 52,
    color: colors.label,
  };

  const recent = useMemo(() => [...series].reverse().slice(0, 6), [series]);

  return (
    <>
      <PaperScreen testID="progress-body-detail">
        <PaperBack onPress={() => router.back()} label="Progress" />
        <Text style={[type.largeTitle, { marginBottom: 12 }]}>{metricMeta.label}</Text>

        <WindowChips value={window} onChange={setWindow} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 16,
            paddingTop: 28,
            paddingBottom: 20,
          }}>
          <StaggerValue
            value={heroNumber}
            suffix={bodyHeroSuffix(metricKey, units)}
            format={bodyHeroFormat(metricKey)}
            style={heroType}
          />
          {deltaRounded != null ? <ProgressDelta percent={deltaRounded} color={deltaColor} /> : null}
          {scrubbing && scrubbed ? (
            <Text
              style={{
                fontSize: 13,
                fontWeight: '400',
                lineHeight: 18,
                color: colors.tertiaryLabel,
                transform: [{ translateY: -2 }],
              }}>
              {formatProgressShortDate(scrubbed.date)}
            </Text>
          ) : null}
        </View>

        <ProgressLineChart
          points={filtered}
          width={width - 48}
          height={180}
          onScrub={setScrubbed}
        />

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
                <Text style={type.subhead}>
                  {new Date(point.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={[type.row, { fontWeight: '600' }]}>
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
