import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { device, gadgetRadius, gadgetType, lcd, logGeometry } from '@/constants/theme';
import { rollWindow, type RollRow } from '@/device/roll-call-model';
import { DEVICE, EASE_OUT_FN } from '@/motion';

import { useDisplayHeight } from './display';
import { LcdText, useScreenStyles } from './lcd-text';

const PITCH = logGeometry.rollRowHeight + logGeometry.rollRowGap;
/** The frame is a ring outside the row, clear of it by a gap of ground (Home's selected stamped row). */
const RING = device.rowRingGap + device.rowOutline;
const LIST_TOP = device.displayHeaderY + gadgetType.lcdSmall.lineHeight + logGeometry.rollHeaderGap;

/**
 * When the roll call shows: from a rocker press until ROLL_HOLD after the last one. `from` is
 * the lift the burst started on, so the frame steps from there. `dismiss` ends it at once (any
 * other key, a sheet).
 */
export function useRollCall() {
  const [from, setFrom] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => clear, [clear]);

  const show = useCallback(
    (index: number) => {
      clear();
      setFrom((current) => current ?? index);
      timer.current = setTimeout(() => {
        timer.current = null;
        setFrom(null);
      }, DEVICE.ROLL_HOLD);
    },
    [clear],
  );
  const dismiss = useCallback(() => {
    clear();
    setFrom(null);
  }, [clear]);

  return { from, show, dismiss };
}

/**
 * The roll call (decision 86): today's lifts over the display's content while the rocker moves.
 * The header names the day and the position (`2/6`); rows are `lcdRow`, done lifts filled with
 * a ✓, the rest dim with sets logged of planned; a ring steps from the lift you were on to the
 * new one. Centred in the display, clear of the thumb on the rocker. Not interactive: touches
 * pass through to the content underneath.
 */
export function RollCall({
  title,
  rows,
  index,
  from,
}: {
  title: string;
  rows: readonly RollRow[];
  index: number;
  from: number;
}) {
  const styles = useScreenStyles(baseStyles);
  const height = useDisplayHeight();
  const reduceMotion = useReducedMotion();

  const room = Math.max(0, height - LIST_TOP - device.displayFooterY);
  const fits = Math.floor((room + logGeometry.rollRowGap) / PITCH);
  const { start, end } = rollWindow(rows.length, index, fits);
  const shown = rows.slice(start, end);
  const block = shown.length * PITCH - logGeometry.rollRowGap;
  const top = LIST_TOP + Math.max(0, Math.round((room - block) / 2));

  const rowY = (row: number) => (Math.min(Math.max(row, start), end - 1) - start) * PITCH;
  const y = useSharedValue(rowY(from));
  const target = rowY(index);
  useEffect(() => {
    y.set(reduceMotion ? target : withTiming(target, { duration: DEVICE.ROLL_MOVE, easing: EASE_OUT_FN }));
  }, [reduceMotion, target, y]);
  const frameStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Animated.View
      entering={FadeIn.duration(DEVICE.ROLL_IN)}
      exiting={FadeOut.duration(DEVICE.ROLL_OUT)}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.ground]}>
      <View style={styles.header}>
        <LcdText lines={1} style={[gadgetType.lcdSmall, styles.dim, styles.shrink]}>
          {title}
        </LcdText>
        <LcdText style={[gadgetType.lcdSmall, styles.dim]}>{`${index + 1}/${rows.length}`}</LcdText>
      </View>
      <View style={[styles.rows, { top }]}>
        {shown.map((row, offset) => {
          const current = start + offset === index;
          const ink = row.done ? styles.doneInk : current ? null : styles.dim;
          return (
            <View key={row.key} style={[styles.row, row.done ? styles.doneRow : styles.todoRow]}>
              <LcdText lines={1} glow={!row.done} style={[gadgetType.lcdRow, styles.shrink, ink]}>
                {row.name}
              </LcdText>
              <LcdText lines={1} glow={!row.done} style={[gadgetType.lcdRow, ink]}>
                {row.done ? '✓' : row.meta}
              </LcdText>
            </View>
          );
        })}
        <Animated.View style={[styles.frame, frameStyle]} />
      </View>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  ground: { backgroundColor: lcd.lcd },
  dim: { color: lcd.amberDim },
  shrink: { flexShrink: 1 },
  doneInk: { color: lcd.doneRowInk },
  header: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: device.rowGap,
  },
  rows: { position: 'absolute', left: device.rowInset, right: device.rowInset, gap: logGeometry.rollRowGap },
  row: {
    height: logGeometry.rollRowHeight,
    borderRadius: gadgetRadius.lcdRow,
    borderCurve: 'continuous',
    paddingHorizontal: device.rowPadX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: device.rowGap,
  },
  todoRow: { backgroundColor: lcd.todoRow },
  doneRow: { backgroundColor: lcd.doneRow },
  frame: {
    position: 'absolute',
    left: -RING,
    right: -RING,
    top: -RING,
    height: logGeometry.rollRowHeight + RING * 2,
    borderWidth: device.rowOutline,
    borderColor: lcd.amber,
    borderRadius: gadgetRadius.lcdRow + RING,
    borderCurve: 'continuous',
  },
});
