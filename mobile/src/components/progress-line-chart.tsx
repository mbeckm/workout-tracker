import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { useTheme } from '@/theme/theme-context';
import type { ProgressPoint } from '@/domain/progress';

type Plotted = { x: number; y: number; value: number; date: string };

const SAMPLE_COUNT = 48;
/** Keep the stroke clear of the axis and the top clip. */
const Y_INSET = 14;
const MORPH_MS = 280;
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

function plotPoints(
  values: ProgressPoint[],
  width: number,
  height: number,
  padX: number,
  padTop: number,
  padBottom: number,
): Plotted[] {
  if (values.length === 0) {
    return [];
  }

  const chartH = height - padTop - padBottom;
  const plotH = Math.max(chartH - Y_INSET * 2, 1);

  if (values.length === 1) {
    return [
      {
        x: width - padX,
        y: padTop + Y_INSET + plotH / 2,
        value: values[0].value,
        date: values[0].date,
      },
    ];
  }

  const min = Math.min(...values.map((point) => point.value));
  const max = Math.max(...values.map((point) => point.value));
  const range = max - min || 1;
  const last = values.length - 1;

  return values.map((point, index) => ({
    x: padX + (index / last) * (width - padX * 2),
    y: padTop + Y_INSET + plotH - ((point.value - min) / range) * plotH,
    value: point.value,
    date: point.date,
  }));
}

/** Evenly sample the series so every window morphs with the same point count. */
function densify(values: ProgressPoint[], count: number): ProgressPoint[] {
  if (values.length === 0) {
    return [];
  }
  if (values.length === 1) {
    return Array.from({ length: count }, () => values[0]);
  }

  const last = values.length - 1;
  const out: ProgressPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const cursor = t * last;
    const i0 = Math.floor(cursor);
    const i1 = Math.min(i0 + 1, last);
    const local = cursor - i0;
    const a = values[i0];
    const b = values[i1];
    out.push({
      date: local < 0.5 ? a.date : b.date,
      value: a.value + (b.value - a.value) * local,
    });
  }
  return out;
}

function smoothPath(points: { x: number; y: number }[]): string {
  'worklet';
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function axisLabel(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('en-US', { month: 'short' });
}

function nearestIndex(plotted: Plotted[], x: number): number {
  'worklet';
  if (plotted.length === 0) {
    return 0;
  }
  let best = 0;
  let bestDist = Math.abs(plotted[0].x - x);
  for (let index = 1; index < plotted.length; index += 1) {
    const dist = Math.abs(plotted[index].x - x);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }
  return best;
}

function sampleYs(
  values: ProgressPoint[],
  width: number,
  height: number,
  padX: number,
  padTop: number,
  padBottom: number,
): { xs: number[]; ys: number[] } {
  const dense = densify(values, SAMPLE_COUNT);
  const plotted = plotPoints(dense, width, height, padX, padTop, padBottom);
  return {
    xs: plotted.map((point) => point.x),
    ys: plotted.map((point) => point.y),
  };
}

function lerpYs(from: number[], to: number[], t: number): number[] {
  'worklet';
  const out: number[] = [];
  const len = Math.min(from.length, to.length);
  for (let index = 0; index < len; index += 1) {
    out.push(from[index] + (to[index] - from[index]) * t);
  }
  return out;
}

export function ProgressLineChart({
  points,
  width,
  height = 180,
  onScrub,
}: {
  points: ProgressPoint[];
  width: number;
  height?: number;
  /** `null` when the finger lifts — restore the latest value. */
  onScrub?: (point: ProgressPoint | null) => void;
}) {
  const { colors, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const padX = 4;
  const padTop = 8;
  const padBottom = 28;
  const plotted = useMemo(
    () => plotPoints(points, width, height, padX, padTop, padBottom),
    [height, points, width],
  );
  const chartHeight = height - padBottom;
  const axisY = chartHeight - 0.5;

  const scrubX = useSharedValue(0);
  const scrubVisible = useSharedValue(0);
  const plottedShared = useSharedValue(plotted);
  const xs = useSharedValue<number[]>([]);
  const fromYs = useSharedValue<number[]>([]);
  const toYs = useSharedValue<number[]>([]);
  const progress = useSharedValue(1);
  const primed = useRef(false);
  const onScrubRef = useRef(onScrub);
  const pointsRef = useRef(points);
  onScrubRef.current = onScrub;
  pointsRef.current = points;

  useEffect(() => {
    plottedShared.set(plotted);
  }, [plotted, plottedShared]);

  useEffect(() => {
    if (points.length < 2 || width <= 0) {
      return;
    }

    const next = sampleYs(points, width, height, padX, padTop, padBottom);
    xs.set(next.xs);

    if (!primed.current || reduceMotion) {
      fromYs.set(next.ys);
      toYs.set(next.ys);
      progress.set(1);
      primed.current = true;
      return;
    }

    const current = lerpYs(fromYs.get(), toYs.get(), progress.get());
    fromYs.set(current.length === next.ys.length ? current : next.ys);
    toYs.set(next.ys);
    progress.set(0);
    progress.set(
      withTiming(1, {
        duration: MORPH_MS,
        easing: EASE_IN_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [
    fromYs,
    height,
    points,
    progress,
    reduceMotion,
    toYs,
    width,
    xs,
  ]);

  const pathProps = useAnimatedProps(() => {
    const xCoords = xs.get();
    const ys = lerpYs(fromYs.get(), toYs.get(), progress.get());
    if (xCoords.length < 2 || ys.length < 2) {
      return { d: '' };
    }
    const samples: { x: number; y: number }[] = [];
    const len = Math.min(xCoords.length, ys.length);
    for (let index = 0; index < len; index += 1) {
      samples.push({ x: xCoords[index], y: ys[index] });
    }
    return { d: smoothPath(samples) };
  });

  const reportScrub = (index: number | null) => {
    const callback = onScrubRef.current;
    if (!callback) {
      return;
    }
    const series = pointsRef.current;
    if (index == null || index < 0 || index >= series.length) {
      callback(null);
      return;
    }
    callback(series[index]);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-16, 16])
        .onBegin((event) => {
          const index = nearestIndex(plottedShared.get(), event.x);
          const point = plottedShared.get()[index];
          if (!point) {
            return;
          }
          scrubX.set(point.x);
          scrubVisible.set(withTiming(1, { duration: 120 }));
          runOnJS(reportScrub)(index);
        })
        .onUpdate((event) => {
          const index = nearestIndex(plottedShared.get(), event.x);
          const point = plottedShared.get()[index];
          if (!point) {
            return;
          }
          scrubX.set(point.x);
          runOnJS(reportScrub)(index);
        })
        .onFinalize(() => {
          scrubVisible.set(withTiming(0, { duration: 160 }));
          runOnJS(reportScrub)(null);
        }),
    [plottedShared, scrubVisible, scrubX],
  );

  const guideStyle = useAnimatedStyle(() => ({
    opacity: scrubVisible.get(),
    transform: [{ translateX: scrubX.get() }],
  }));

  if (plotted.length < 2) {
    return <View style={{ width, height }} />;
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height }}>
        <Svg width={width} height={chartHeight}>
          <Line
            x1={padX}
            y1={axisY}
            x2={width - padX}
            y2={axisY}
            stroke={colors.separator}
            strokeWidth={1}
            strokeOpacity={0.55}
          />
          <AnimatedPath
            animatedProps={pathProps}
            stroke={colors.label}
            strokeWidth={2.75}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: padTop,
              bottom: padBottom,
              width: 1.5,
              marginLeft: -0.75,
              backgroundColor: colors.label,
            },
            guideStyle,
          ]}
        />
        <Text
          style={[
            type.caption,
            {
              position: 'absolute',
              left: 0,
              bottom: 0,
              color: colors.tertiaryLabel,
              fontSize: 13,
              fontWeight: '400',
            },
          ]}>
          {axisLabel(points[0].date)}
        </Text>
        <Text
          style={[
            type.caption,
            {
              position: 'absolute',
              right: 0,
              bottom: 0,
              color: colors.tertiaryLabel,
              fontSize: 13,
              fontWeight: '400',
            },
          ]}>
          {axisLabel(points[points.length - 1].date)}
        </Text>
      </View>
    </GestureDetector>
  );
}
