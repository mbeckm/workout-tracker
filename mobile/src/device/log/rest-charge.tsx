import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { bodyFinish, device, gadgetType, lcd, logGeometry } from '@/constants/theme';
import { LcdText, useScreenStyles } from '@/device/parts/lcd-text';
import { DEVICE, EASE_BREATHE_FN, EASE_OUT_FN } from '@/motion';

import { restCharge } from './log-model';

/**
 * Rest's middle (decision 96): `SET 2 IN` over the clock, and under them the battery that charges
 * toward the next set. The cells light left to right as rest runs out, the one charging next
 * slowly brightening and fading; at GO the battery is full, one soft light sweeps across it, and
 * the line reads `SET 2` over a blinking `GO`. Reduce Motion: no breathing and no sweep, the
 * cells just fill. Shared by the log's rest and the tour's practice rest.
 */
export function RestCharge({
  up,
  clock,
  fraction,
  go,
  room,
  style,
}: {
  /** The set that's up next: `SET 2`, `EXTRA SET` (`restUpText`). */
  up: string;
  /** `1:30`. */
  clock: string;
  /** Rest left, 1 → 0, against the longest this rest has been. */
  fraction: number;
  /** 0:00 reached: the battery is full and GO blinks. */
  go: boolean;
  /** The height it's centred in; below `REST_CHARGE_HEIGHT` it tightens (iPhone SE's tour). */
  room?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useScreenStyles(baseStyles);
  const { lit, charging } = restCharge(fraction, go, logGeometry.restCells);
  const compact = room != null && room > 0 && room < REST_CHARGE_HEIGHT;
  return (
    <View style={[styles.column, style]} pointerEvents="none">
      <LcdText numberOfLines={1} style={gadgetType.lcdSmall}>
        {go ? up : `${up} IN`}
      </LcdText>
      <View style={[styles.clock, compact && styles.clockCompact]}>
        {go ? (
          <Blink>
            <LcdText style={gadgetType.lcdBig}>GO</LcdText>
          </Blink>
        ) : (
          <LcdText style={[gadgetType.lcdBig, styles.tabular]}>{clock}</LcdText>
        )}
      </View>
      <View style={[styles.batteryRow, compact && styles.batteryRowCompact]}>
        <View style={[styles.battery, compact && styles.batteryCompact, go && styles.batteryFull]}>
          {Array.from({ length: logGeometry.restCells }, (_, index) => (
            <Cell key={index} lit={index < lit} charging={index === charging} />
          ))}
          {go ? <Sweep /> : null}
        </View>
        <View style={styles.nub} />
      </View>
    </View>
  );
}

/** The full layout's height: the line, the clock and the battery with their gaps. */
export const REST_CHARGE_HEIGHT =
  gadgetType.lcdSmall.lineHeight +
  logGeometry.restLabelGap +
  gadgetType.lcdBig.lineHeight +
  logGeometry.restBatteryGap +
  logGeometry.restBatteryHeight;

/** One cell: off, lit (fades in over DEVICE.DISPLAY), or charging (breathes from off to dim). */
function Cell({ lit, charging }: { lit: boolean; charging: boolean }) {
  const styles = useScreenStyles(baseStyles);
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(lit ? 1 : 0);
  const breath = useSharedValue(0);

  useEffect(() => {
    on.set(reduceMotion ? (lit ? 1 : 0) : withTiming(lit ? 1 : 0, { duration: DEVICE.DISPLAY, easing: EASE_OUT_FN }));
  }, [lit, on, reduceMotion]);

  useEffect(() => {
    if (!charging || reduceMotion) {
      cancelAnimation(breath);
      breath.set(0);
      return;
    }
    const half = DEVICE.REST_BREATHE / 2;
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: half, easing: EASE_BREATHE_FN }),
          withTiming(0, { duration: half, easing: EASE_BREATHE_FN }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(breath);
  }, [breath, charging, reduceMotion]);

  const onStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.get() }));
  return (
    <View style={styles.cell}>
      <Animated.View style={[styles.layer, styles.cellDim, breathStyle]} />
      <Animated.View style={[styles.layer, styles.cellLit, onStyle]} />
    </View>
  );
}

/** The full battery's one soft light sweep, left to right. */
function Sweep() {
  const styles = useScreenStyles(baseStyles);
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(-logGeometry.restSweepWidth);
  useEffect(() => {
    if (reduceMotion) return;
    x.set(withTiming(logGeometry.restBatteryWidth, { duration: DEVICE.REST_SWEEP, easing: EASE_OUT_FN }));
  }, [reduceMotion, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  if (reduceMotion) return null;
  return <Animated.View style={[styles.sweep, style]} />;
}

/** Blinking display text (`GO`): on for half the period, dim for the other half, as CSS steps(1). */
export function Blink({ children }: { children: ReactNode }) {
  const blink = useSharedValue(1);
  useEffect(() => {
    const half = DEVICE.BLINK / 2;
    blink.set(
      withRepeat(
        withSequence(
          withDelay(half, withTiming(device.blinkDimOpacity, { duration: DEVICE.SNAP })),
          withDelay(half, withTiming(1, { duration: DEVICE.SNAP })),
        ),
        -1,
      ),
    );
  }, [blink]);
  const style = useAnimatedStyle(() => ({ opacity: blink.get() }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const baseStyles = StyleSheet.create({
  column: { alignItems: 'center', justifyContent: 'center' },
  clock: { marginTop: logGeometry.restLabelGap },
  clockCompact: { marginTop: logGeometry.restLabelGapCompact },
  tabular: { fontVariant: ['tabular-nums'] },
  batteryRow: { flexDirection: 'row', alignItems: 'center', marginTop: logGeometry.restBatteryGap },
  batteryRowCompact: { marginTop: logGeometry.restBatteryGapCompact },
  battery: {
    width: logGeometry.restBatteryWidth,
    height: logGeometry.restBatteryHeight,
    flexDirection: 'row',
    gap: logGeometry.restCellGap,
    padding: logGeometry.restBatteryPad,
    borderWidth: logGeometry.restBatteryStroke,
    borderColor: lcd.amber,
    borderRadius: logGeometry.restBatteryRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  batteryCompact: { height: logGeometry.restBatteryHeightCompact },
  batteryFull: { boxShadow: `0 0 14px ${lcd.amberGlow}` },
  cell: {
    flex: 1,
    borderRadius: logGeometry.restCellRadius,
    backgroundColor: lcd.amberOff,
  },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: logGeometry.restCellRadius },
  cellDim: { backgroundColor: lcd.amberDim },
  cellLit: { backgroundColor: lcd.amber, boxShadow: `0 0 6px ${lcd.amber}` },
  nub: {
    width: logGeometry.restNubWidth,
    height: logGeometry.restNubHeight,
    backgroundColor: lcd.amber,
    borderTopRightRadius: logGeometry.restNubRadius,
    borderBottomRightRadius: logGeometry.restNubRadius,
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: logGeometry.restSweepWidth,
    experimental_backgroundImage: `linear-gradient(90deg, ${bodyFinish.restSweepClear}, ${bodyFinish.restSweep}, ${bodyFinish.restSweepClear})`,
  },
});
