import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { gadgetRadius, lcd, progressGeometry as geo, progressType, sheetColors, signal } from '@/constants/theme';
import {
  defaultProgressWindow,
  isProgressWindowLocked,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import type { SparkTone } from '@/device/progress-model';
import { DEVICE, DURATION, EASE_IN_OUT, EASE_OUT_FN } from '@/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/* ----------------------------------------------------------------------------------------- *
 * Goal ring (prototype `.goal svg`): a 64 green ring that fills from 0 over 1 s (SPEC §7).
 * ----------------------------------------------------------------------------------------- */

const RING_C = 2 * Math.PI * geo.ringRadius;

export function GoalRing({ progress, label }: { progress: number; label: string }) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(reduceMotion ? progress : 0);

  useEffect(() => {
    fill.set(
      reduceMotion
        ? progress
        : withTiming(progress, { duration: DEVICE.GOAL_RING, easing: EASE_OUT_FN, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, progress, reduceMotion]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: RING_C * (1 - fill.get()) }));
  const centre = geo.ring / 2;
  return (
    <View style={styles.ring}>
      <Svg width={geo.ring} height={geo.ring}>
        <Circle
          cx={centre}
          cy={centre}
          r={geo.ringRadius}
          fill="none"
          stroke={sheetColors.track}
          strokeWidth={geo.ringStroke}
        />
        <AnimatedCircle
          cx={centre}
          cy={centre}
          r={geo.ringRadius}
          fill="none"
          stroke={signal.done}
          strokeWidth={geo.ringStroke}
          strokeLinecap="round"
          strokeDasharray={[RING_C, RING_C]}
          animatedProps={props}
          rotation={-90}
          originX={centre}
          originY={centre}
        />
      </Svg>
      <View style={styles.ringLabel} pointerEvents="none">
        <Text maxFontSizeMultiplier={1} style={[progressType.goalPercent, styles.tabular]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Sparkline (prototype `spark()`): 70 × 24, no dots; yellow for a record, muted when flat.
 * ----------------------------------------------------------------------------------------- */

const SPARK_COLOR: Record<SparkTone, string> = {
  record: signal.record,
  flat: sheetColors.sectionLabel,
  ink: sheetColors.ink,
};

export function Sparkline({ values, tone }: { values: number[]; tone: SparkTone }) {
  const color = SPARK_COLOR[tone];
  const span = geo.sparkW - geo.sparkInsetX * 2;
  const rise = geo.sparkBottom - geo.sparkTop;
  if (values.length === 0) {
    return <View style={styles.spark} />;
  }
  if (values.length === 1) {
    // One session: a dot, not a line (PLAN §7 Progress).
    return (
      <View style={styles.spark}>
        <Svg width={geo.sparkW} height={geo.sparkH}>
          <Circle cx={geo.sparkW - geo.sparkInsetX - geo.sparkDot} cy={geo.sparkH / 2} r={geo.sparkDot} fill={color} />
        </Svg>
      </View>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = geo.sparkInsetX + (index * span) / (values.length - 1);
      const y = geo.sparkBottom - ((value - min) / range) * rise;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <View style={styles.spark}>
      <Svg width={geo.sparkW} height={geo.sparkH}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={geo.sparkStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * The range (PRODUCT-DECISIONS 63): carried over between lifts and body for the session.
 * ----------------------------------------------------------------------------------------- */

let rememberedWindow: ProgressWindow | null = null;

/** The detail sheets' range. A picked range counts only while it's open to this user. */
export function useProgressWindow(isPro: boolean): [ProgressWindow, (window: ProgressWindow) => void] {
  const [picked, setPicked] = useState<ProgressWindow | null>(rememberedWindow);
  const window =
    picked != null && !isProgressWindowLocked(picked, isPro) ? picked : defaultProgressWindow(isPro);
  const pick = (next: ProgressWindow) => {
    rememberedWindow = next;
    setPicked(next);
  };
  return [window, pick];
}

/* ----------------------------------------------------------------------------------------- *
 * The lcd chart (prototype `chart()`, trim-ui §11)
 * ----------------------------------------------------------------------------------------- */

type Plotted = { x: number; y: number };

/** Prototype `chart()`: the y-range is the values (and the goal) ±1, never from zero. */
function plot(points: readonly ProgressPoint[], goal: number | null, width: number) {
  const values = points.map((point) => point.value);
  const all = goal != null ? [...values, goal] : values;
  const low = Math.min(...all) - 1;
  const high = Math.max(...all) + 1;
  const y = (value: number) => geo.chartPadTop + ((high - value) / (high - low)) * geo.chartPlot;
  const span = width - geo.chartPadX * 2;
  const plotted: Plotted[] = points.map((point, index) => ({
    x: points.length === 1 ? width - geo.chartPadX : geo.chartPadX + (index * span) / (points.length - 1),
    y: y(point.value),
  }));
  return { plotted, y };
}

/**
 * `count` vertices along `items`, each item at least once and in order. Two lines with the same
 * vertex count morph vertex by vertex (from the old `progress-line-chart`).
 */
function spread<T>(items: readonly T[], count: number): T[] {
  const n = items.length;
  return Array.from({ length: count }, (_, j) => items[Math.min(n - 1, Math.floor((j * n) / count))]);
}

function vertexFor(index: number, n: number, count: number): number {
  'worklet';
  return Math.min(count - 1, Math.ceil((index * count) / n));
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

/** Straight segments between sessions: no smoothing that invents values. */
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

function nearestIndex(plotted: readonly Plotted[], x: number): number {
  'worklet';
  let best = 0;
  let bestDist = Infinity;
  for (let index = 0; index < plotted.length; index += 1) {
    const dist = Math.abs(plotted[index].x - x);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }
  return best;
}

/** Cumulative length along a polyline at each vertex, and the total. */
function lengths(plotted: readonly Plotted[]): { at: number[]; total: number } {
  const at = [0];
  for (let index = 1; index < plotted.length; index += 1) {
    const dx = plotted[index].x - plotted[index - 1].x;
    const dy = plotted[index].y - plotted[index - 1].y;
    at.push(at[index - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return { at, total: at[at.length - 1] ?? 0 };
}

/** Longer than any line the chart can draw: the draw-in's dash. */
const DASH = 100_000;

/**
 * The lift chart on an lcd panel (SPEC §6 Lift detail, §7; trim-ui §11): an orange line with
 * dots, the last dot yellow for a record, three faint rules, the goal as a dashed green line
 * labelled `GOAL 100`. The line draws in over 1 s on open and morphs between ranges. Touching
 * it scrubs: a marker follows the nearest session, `onScrub` reports it, a selection tick
 * plays at each point, and lifting the finger returns to now.
 */
export function LcdChart({
  points,
  goal,
  record,
  emptyText,
  onScrub,
  accessibilityLabel,
}: {
  points: ProgressPoint[];
  goal: number | null;
  record: boolean;
  emptyText: string;
  onScrub: (point: ProgressPoint | null) => void;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const hasPoints = points.length > 0;
  return (
    <View
      onLayout={onLayout}
      style={styles.chart}
      accessible={accessibilityLabel != null}
      accessibilityRole={accessibilityLabel != null ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel ?? emptyText}>
      <Svg width="100%" height={geo.chartHeight} style={StyleSheet.absoluteFill}>
        {geo.chartRules.map((y) => (
          <Line key={y} x1={0} x2="100%" y1={y} y2={y} stroke={lcd.amberPress} strokeWidth={1} />
        ))}
      </Svg>
      {width > 0 && hasPoints ? (
        <ChartLine width={width} points={points} goal={goal} record={record} onScrub={onScrub} />
      ) : null}
      {!hasPoints ? (
        <View style={styles.chartEmpty} pointerEvents="none">
          <Text maxFontSizeMultiplier={1} style={[progressType.chartLabel, styles.dimLabel]}>
            {emptyText.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ChartLine({
  width,
  points,
  goal,
  record,
  onScrub,
}: {
  width: number;
  points: ProgressPoint[];
  goal: number | null;
  record: boolean;
  onScrub: (point: ProgressPoint | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const { plotted, y } = useMemo(() => plot(points, goal, width), [goal, points, width]);
  const goalY = goal != null ? y(goal) : null;

  // The drawn line: from → to, vertex by vertex, as `morph` runs 0 → 1 (range changes).
  const fromXs = useSharedValue<number[]>([]);
  const fromYs = useSharedValue<number[]>([]);
  const toXs = useSharedValue<number[]>([]);
  const toYs = useSharedValue<number[]>([]);
  const morph = useSharedValue(1);
  // The draw-in on open: the dash's visible share of the first line, 0 → 1 over 1 s.
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const drawLength = useSharedValue(0);
  const vertexCount = useRef(0);
  const primed = useRef(false);
  const [dotAt, setDotAt] = useState<number[]>([]);

  useEffect(() => {
    if (plotted.length < 2) {
      fromXs.set([]);
      fromYs.set([]);
      toXs.set([]);
      toYs.set([]);
      vertexCount.current = 0;
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
      morph.set(1);
      vertexCount.current = count;
      if (!primed.current) {
        primed.current = true;
        const measured = lengths(plotted);
        drawLength.set(measured.total);
        setDotAt(measured.at.map((at) => (measured.total > 0 ? at / measured.total : 1)));
        if (!reduceMotion) {
          draw.set(0);
          draw.set(withTiming(1, { duration: DEVICE.CHART, easing: EASE_OUT_FN, reduceMotion: ReduceMotion.System }));
        }
      }
      return;
    }

    // From wherever the line is now (mid-morph included), stretched to the new count.
    const t = morph.get();
    const nowXs = lerp(fromXs.get(), toXs.get(), t);
    const nowYs = lerp(fromYs.get(), toYs.get(), t);
    fromXs.set(nowXs.length === count ? nowXs : spread(nowXs, count));
    fromYs.set(nowYs.length === count ? nowYs : spread(nowYs, count));
    toXs.set(nextXs);
    toYs.set(nextYs);
    vertexCount.current = count;
    morph.set(0);
    morph.set(withTiming(1, { duration: DURATION.change, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System }));
  }, [draw, drawLength, fromXs, fromYs, morph, plotted, reduceMotion, toXs, toYs]);

  const lineProps = useAnimatedProps(() => {
    const t = morph.get();
    const shown = draw.get();
    return {
      d: linePath(lerp(fromXs.get(), toXs.get(), t), lerp(fromYs.get(), toYs.get(), t)),
      strokeDashoffset: shown >= 1 ? 0 : DASH - drawLength.get() * shown,
    };
  });

  // Scrubbing (ported from `progress-line-chart`): nearest session, a tick per point.
  const plottedShared = useSharedValue(plotted);
  useEffect(() => {
    plottedShared.set(plotted);
  }, [plotted, plottedShared]);
  const scrubX = useSharedValue(0);
  const scrubY = useSharedValue(0);
  const scrubIndex = useSharedValue(-1);
  const scrubVisible = useSharedValue(0);
  const report = useCallback(
    (index: number | null) => {
      if (index != null && process.env.EXPO_OS === 'ios') {
        void Haptics.selectionAsync();
      }
      onScrub(index == null ? null : (points[index] ?? null));
    },
    [onScrub, points],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-16, 16])
        .onBegin((event) => {
          const list = plottedShared.get();
          if (list.length === 0) {
            return;
          }
          const index = nearestIndex(list, event.x);
          scrubX.set(list[index].x);
          scrubY.set(list[index].y);
          scrubIndex.set(index);
          scrubVisible.set(withTiming(1, { duration: DURATION.press }));
          scheduleOnRN(report, index);
        })
        .onUpdate((event) => {
          const list = plottedShared.get();
          if (list.length === 0) {
            return;
          }
          const index = nearestIndex(list, event.x);
          if (index === scrubIndex.get()) {
            return;
          }
          scrubX.set(list[index].x);
          scrubY.set(list[index].y);
          scrubIndex.set(index);
          scheduleOnRN(report, index);
        })
        .onFinalize(() => {
          if (scrubIndex.get() < 0) {
            return;
          }
          scrubIndex.set(-1);
          scrubVisible.set(withTiming(0, { duration: DURATION.exit }));
          scheduleOnRN(report, null);
        }),
    [plottedShared, report, scrubIndex, scrubVisible, scrubX, scrubY],
  );

  const guideStyle = useAnimatedStyle(() => ({
    opacity: scrubVisible.get(),
    transform: [{ translateX: scrubX.get() - geo.scrubGuide / 2 }],
  }));
  const scrubDotStyle = useAnimatedStyle(() => ({
    opacity: scrubVisible.get(),
    transform: [
      { translateX: scrubX.get() - geo.scrubDot / 2 },
      { translateY: scrubY.get() - geo.scrubDot / 2 },
    ],
  }));

  const last = plotted.length - 1;
  const dotIndexes =
    plotted.length <= geo.chartDotsMax ? plotted.map((_, index) => index) : [last];

  return (
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={geo.chartHeight}>
          {goalY != null ? (
            <Line
              x1={0}
              x2={width}
              y1={goalY}
              y2={goalY}
              stroke={signal.done}
              strokeWidth={geo.goalLineStroke}
              strokeDasharray={geo.goalLineDash}
            />
          ) : null}
          {plotted.length > 1 ? (
            <AnimatedPath
              animatedProps={lineProps}
              stroke={signal.orange}
              strokeWidth={geo.chartLine}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[DASH, DASH]}
            />
          ) : null}
          {plotted.length === 1 ? (
            <Circle
              cx={plotted[0].x}
              cy={plotted[0].y}
              r={geo.chartLastDot}
              fill={record ? signal.record : signal.orange}
            />
          ) : (
            dotIndexes.map((index) => (
              <ChartDot
                key={`${index}-${plotted.length}`}
                index={index}
                pointCount={plotted.length}
                at={dotAt[index] ?? 0}
                draw={draw}
                fromXs={fromXs}
                fromYs={fromYs}
                toXs={toXs}
                toYs={toYs}
                morph={morph}
                radius={index === last ? geo.chartLastDot : geo.chartDot}
                color={index === last && record ? signal.record : signal.orange}
              />
            ))
          )}
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[styles.guide, { top: geo.chartPadTop, height: geo.chartPlot }, guideStyle]}
        />
        <Animated.View pointerEvents="none" style={[styles.scrubDot, scrubDotStyle]} />
        {goalY != null && goal != null ? (
          <Text
            maxFontSizeMultiplier={1}
            style={[
              progressType.chartLabel,
              styles.goalLabel,
              { top: goalY - geo.goalLabelGap - progressType.chartLabel.lineHeight },
            ]}>
            {`GOAL ${formatGoal(goal)}`}
          </Text>
        ) : null}
      </View>
    </GestureDetector>
  );
}

function formatGoal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A session's dot: rides its vertex through a range morph, and shows once the draw-in reaches it. */
function ChartDot({
  index,
  pointCount,
  at,
  draw,
  fromXs,
  fromYs,
  toXs,
  toYs,
  morph,
  radius,
  color,
}: {
  index: number;
  pointCount: number;
  /** Where along the first line this dot sits, 0…1. */
  at: number;
  draw: SharedValue<number>;
  fromXs: SharedValue<number[]>;
  fromYs: SharedValue<number[]>;
  toXs: SharedValue<number[]>;
  toYs: SharedValue<number[]>;
  morph: SharedValue<number>;
  radius: number;
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const t = morph.get();
    const count = toXs.get().length;
    const vertex = index >= pointCount - 1 ? count - 1 : vertexFor(index, pointCount, count);
    const x1 = toXs.get()[vertex];
    const y1 = toYs.get()[vertex];
    if (x1 == null || y1 == null) {
      return { cx: 0, cy: 0, opacity: 0 };
    }
    const x0 = fromXs.get()[vertex] ?? x1;
    const y0 = fromYs.get()[vertex] ?? y1;
    return {
      cx: x0 + (x1 - x0) * t,
      cy: y0 + (y1 - y0) * t,
      opacity: draw.get() >= at - 0.001 ? 1 : 0,
    };
  });
  return <AnimatedCircle animatedProps={props} r={radius} fill={color} />;
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  ring: { width: geo.ring, height: geo.ring },
  ringLabel: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  spark: { width: geo.sparkW, height: geo.sparkH, flexShrink: 0 },
  chart: {
    height: geo.chartHeight,
    marginTop: geo.chartTop,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    backgroundColor: lcd.lcd,
    boxShadow: `inset 0 3px 10px ${lcd.lcdShade}`,
    overflow: 'hidden',
  },
  chartEmpty: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  dimLabel: { color: lcd.amberDim },
  guide: { position: 'absolute', left: 0, width: geo.scrubGuide, backgroundColor: lcd.amberDim },
  scrubDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: geo.scrubDot,
    height: geo.scrubDot,
    borderRadius: geo.scrubDot / 2,
    backgroundColor: lcd.amber,
  },
  goalLabel: { position: 'absolute', right: geo.goalLabelRight, color: signal.done },
});
