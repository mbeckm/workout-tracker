import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/theme-context';
import { fontScaleCap, radius } from '@/constants/theme';
import { formatProgressShortDate, type ProgressPoint } from '@/domain/progress';
import { DURATION, EASE_IN_OUT } from '@/motion';

type Plotted = { x: number; y: number; value: number; date: string };

/** The y-range fits the window's values with ~10% air above and below (trim-ui → Charts 5). */
const Y_PADDING = 0.1;
const MORPH_MS = DURATION.change;
/** Fewer points than this and every point gets a dot (trim-ui → Charts 4). */
const DOT_ALL_BELOW = 6;
const DOT_RADIUS = 4;
const SCRUB_DOT = 10;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

  const plotH = Math.max(height - padTop - padBottom, 1);

  if (values.length === 1) {
    return [{ x: width - padX, y: padTop + plotH / 2, value: values[0].value, date: values[0].date }];
  }

  const min = Math.min(...values.map((point) => point.value));
  const max = Math.max(...values.map((point) => point.value));
  const last = values.length - 1;
  // A flat series sits in the middle; otherwise the range never starts at zero.
  const pad = (max - min) * Y_PADDING;
  const low = min - pad;
  const span = max + pad - low;

  return values.map((point, index) => ({
    x: padX + (index / last) * (width - padX * 2),
    y: span > 0 ? padTop + plotH - ((point.value - low) / span) * plotH : padTop + plotH / 2,
    value: point.value,
    date: point.date,
  }));
}

/**
 * `count` vertices along `items`, each item at least once and in order (vertex j sits on item
 * floor(j·n/count)). Two lines with the same vertex count can morph vertex by vertex, and the
 * repeated vertices are zero-length segments, so the line stays straight between sessions.
 */
function spread<T>(items: readonly T[], count: number): T[] {
  const n = items.length;
  return Array.from({ length: count }, (_, j) => items[Math.min(n - 1, Math.floor((j * n) / count))]);
}

/** The first vertex that sits on item `index` of `n` in a `count`-vertex spread. */
function vertexFor(index: number, n: number, count: number): number {
  'worklet';
  return Math.min(count - 1, Math.ceil((index * count) / n));
}

/** Straight segments between sessions (trim-ui → Charts 1): no smoothing that invents values. */
function linePath(xs: readonly number[], ys: readonly number[]): string {
  'worklet';
  const len = Math.min(xs.length, ys.length);
  if (len === 0) {
    return '';
  }
  let path = `M ${xs[0]} ${ys[0]}`;
  for (let index = 1; index < len; index += 1) {
    path += ` L ${xs[index]} ${ys[index]}`;
  }
  return path;
}

function lerp(from: readonly number[], to: readonly number[], t: number): number[] {
  'worklet';
  const out: number[] = [];
  const len = Math.min(from.length, to.length);
  for (let index = 0; index < len; index += 1) {
    out.push(from[index] + (to[index] - from[index]) * t);
  }
  return out;
}

/** First and last date only (trim-ui → Charts 2); one date when every point is on one day. */
function axisLabels(firstIso: string, lastIso: string): [string, string] {
  const first = formatProgressShortDate(firstIso);
  const last = formatProgressShortDate(lastIso);
  return first === last ? ['', last] : [first, last];
}

/** Axis labels scale with Dynamic Type up to here; the chart makes room below for them. */
const AXIS_MAX_SCALE = fontScaleCap.title;
/** Default space under the axis: the label line plus 10pt air. */
const PAD_BOTTOM = 28;

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

export function ProgressLineChart({
  points,
  width,
  height = 180,
  onScrub,
  accessibilityLabel,
}: {
  points: ProgressPoint[];
  width: number;
  height?: number;
  /** `null` when the finger lifts — restore the latest value. */
  onScrub?: (point: ProgressPoint | null) => void;
  /** Spoken summary of the trend; the drawn line is invisible to VoiceOver otherwise. */
  accessibilityLabel?: string;
}) {
  const { colors, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const padX = 4;
  const padTop = 8;
  // Large text grows the space under the axis by the labels' extra height, so the baseline
  // never runs through them; the plot keeps its size and the chart gets taller instead.
  const labelGrowth = Math.ceil(
    type.footnote.lineHeight * (Math.min(Math.max(fontScale, 1), AXIS_MAX_SCALE) - 1),
  );
  const padBottom = PAD_BOTTOM + labelGrowth;
  const totalHeight = height + labelGrowth;
  const plotted = useMemo(
    () => plotPoints(points, width, totalHeight, padX, padTop, padBottom),
    [padBottom, points, totalHeight, width],
  );
  const chartHeight = totalHeight - padBottom;
  const axisY = chartHeight - 0.5;

  const scrubX = useSharedValue(0);
  const scrubY = useSharedValue(0);
  const scrubIndex = useSharedValue(-1);
  const scrubVisible = useSharedValue(0);
  const plottedShared = useSharedValue(plotted);
  // The drawn line: from → to, vertex by vertex, as `progress` runs 0 → 1.
  const fromXs = useSharedValue<number[]>([]);
  const fromYs = useSharedValue<number[]>([]);
  const toXs = useSharedValue<number[]>([]);
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

  // Vertex count of the drawn line: at least one per session, and never fewer than the line
  // it morphs from, so both have the same count.
  const vertexCount = useRef(0);

  useEffect(() => {
    if (width <= 0) {
      return;
    }
    if (plotted.length < 2) {
      // One session is a lone dot: no line, and the next line draws in place, not from here.
      fromXs.set([]);
      fromYs.set([]);
      toXs.set([]);
      toYs.set([]);
      vertexCount.current = 0;
      primed.current = false;
      return;
    }

    const count = Math.max(plotted.length, primed.current && !reduceMotion ? vertexCount.current : 0);
    const target = spread(plotted, count);
    const nextXs = target.map((point) => point.x);
    const nextYs = target.map((point) => point.y);

    if (!primed.current || reduceMotion) {
      fromXs.set(nextXs);
      fromYs.set(nextYs);
      toXs.set(nextXs);
      toYs.set(nextYs);
      progress.set(1);
      vertexCount.current = count;
      primed.current = true;
      return;
    }

    // Start from where the line is now (mid-morph included), stretched to the new count.
    const t = progress.get();
    const nowXs = lerp(fromXs.get(), toXs.get(), t);
    const nowYs = lerp(fromYs.get(), toYs.get(), t);
    fromXs.set(nowXs.length === count ? nowXs : spread(nowXs, count));
    fromYs.set(nowYs.length === count ? nowYs : spread(nowYs, count));
    toXs.set(nextXs);
    toYs.set(nextYs);
    vertexCount.current = count;
    progress.set(0);
    progress.set(
      withTiming(1, {
        duration: MORPH_MS,
        easing: EASE_IN_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [fromXs, fromYs, plotted, progress, reduceMotion, toXs, toYs, width]);

  const pathProps = useAnimatedProps(() => {
    const t = progress.get();
    return { d: linePath(lerp(fromXs.get(), toXs.get(), t), lerp(fromYs.get(), toYs.get(), t)) };
  });

  const reportScrub = (index: number | null) => {
    if (index != null) {
      // A selection tick at each data point (trim-ui → Haptics).
      void Haptics.selectionAsync();
    }
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
          scrubY.set(point.y);
          scrubIndex.set(index);
          scrubVisible.set(withTiming(1, { duration: DURATION.press }));
          runOnJS(reportScrub)(index);
        })
        .onUpdate((event) => {
          const index = nearestIndex(plottedShared.get(), event.x);
          const point = plottedShared.get()[index];
          if (!point) {
            return;
          }
          if (index === scrubIndex.get()) {
            return;
          }
          scrubX.set(point.x);
          scrubY.set(point.y);
          scrubIndex.set(index);
          runOnJS(reportScrub)(index);
        })
        .onFinalize(() => {
          scrubIndex.set(-1);
          scrubVisible.set(withTiming(0, { duration: DURATION.exit }));
          runOnJS(reportScrub)(null);
        }),
    [plottedShared, scrubIndex, scrubVisible, scrubX, scrubY],
  );

  const guideStyle = useAnimatedStyle(() => ({
    opacity: scrubVisible.get(),
    // Centre the 1pt guide on the point.
    transform: [{ translateX: scrubX.get() - 0.5 }],
  }));
  const scrubDotStyle = useAnimatedStyle(() => ({
    opacity: scrubVisible.get(),
    transform: [
      { translateX: scrubX.get() - SCRUB_DOT / 2 },
      { translateY: scrubY.get() - SCRUB_DOT / 2 },
    ],
  }));

  if (plotted.length === 0) {
    return <View style={{ width, height: totalHeight }} />;
  }

  // The latest value always gets a dot; a short series gets one on every point, because a
  // line through three sessions implies data that isn't there. One session is a lone dot.
  // Dots ride their vertex, so they move with the line when the range changes.
  const dotIndexes =
    plotted.length < DOT_ALL_BELOW ? plotted.map((_, index) => index) : [plotted.length - 1];
  const [startLabel, endLabel] = axisLabels(points[0].date, points[points.length - 1].date);

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ width, height: totalHeight }}
        accessible={accessibilityLabel != null}
        accessibilityRole={accessibilityLabel != null ? 'image' : undefined}
        accessibilityLabel={accessibilityLabel}>
        <Svg width={width} height={chartHeight}>
          <AnimatedPath
            animatedProps={pathProps}
            stroke={colors.label}
            strokeWidth={2.75}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {plotted.length === 1 ? (
            <Circle cx={plotted[0].x} cy={plotted[0].y} r={DOT_RADIUS} fill={colors.label} />
          ) : (
            dotIndexes.map((index) => (
              <MorphDot
                key={`${index}-${plotted.length}`}
                index={index}
                pointCount={plotted.length}
                fromXs={fromXs}
                fromYs={fromYs}
                toXs={toXs}
                toYs={toYs}
                progress={progress}
                color={colors.label}
              />
            ))
          )}
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: padTop,
              bottom: padBottom,
              width: 1,
              backgroundColor: colors.label,
            },
            guideStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: SCRUB_DOT,
              height: SCRUB_DOT,
              borderRadius: radius.full,
              backgroundColor: colors.label,
            },
            scrubDotStyle,
          ]}
        />
        <Text
          style={[type.footnote, { position: 'absolute', left: 0, bottom: 0 }]}
          maxFontSizeMultiplier={AXIS_MAX_SCALE}>
          {startLabel}
        </Text>
        <Text
          style={[type.footnote, { position: 'absolute', right: 0, bottom: 0 }]}
          maxFontSizeMultiplier={AXIS_MAX_SCALE}>
          {endLabel}
        </Text>
      </View>
    </GestureDetector>
  );
}

function MorphDot({
  index,
  pointCount,
  fromXs,
  fromYs,
  toXs,
  toYs,
  progress,
  color,
}: {
  /** The session this dot marks, of `pointCount`; its vertex is found in the drawn line. */
  index: number;
  pointCount: number;
  fromXs: SharedValue<number[]>;
  fromYs: SharedValue<number[]>;
  toXs: SharedValue<number[]>;
  toYs: SharedValue<number[]>;
  progress: SharedValue<number>;
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const t = progress.get();
    const count = toXs.get().length;
    const vertex = index >= pointCount - 1 ? count - 1 : vertexFor(index, pointCount, count);
    const x0 = fromXs.get()[vertex];
    const x1 = toXs.get()[vertex];
    const y0 = fromYs.get()[vertex];
    const y1 = toYs.get()[vertex];
    if (x1 == null || y1 == null) {
      return { cx: 0, cy: 0, opacity: 0 };
    }
    return {
      cx: (x0 ?? x1) + (x1 - (x0 ?? x1)) * t,
      cy: (y0 ?? y1) + (y1 - (y0 ?? y1)) * t,
      opacity: 1,
    };
  });
  return <AnimatedCircle animatedProps={props} r={DOT_RADIUS} fill={color} />;
}
