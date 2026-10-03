import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { device, editGeometry as geo, gadgetType, lcd } from '@/constants/theme';
import { useDisplayHeight } from '@/device/parts';
import { DEVICE, EASE_DISPLAY_FN } from '@/motion';

import type { EditController } from './use-edit-device';

/** The numbers' size: 104 while sets and the value fit, then 88, then 56 (`0:45` with 10 sets). */
function numberRole(chars: number) {
  if (chars <= geo.heroChars) return { text: gadgetType.lcdHero, line: geo.numberLine };
  if (chars <= geo.compactChars) {
    const size = gadgetType.lcdHeroCompact.fontSize;
    return { text: gadgetType.lcdHeroCompact, line: Math.round((geo.numberLine * size) / gadgetType.lcdHero.fontSize) };
  }
  return { text: gadgetType.lcdBig, line: gadgetType.lcdBig.lineHeight };
}

/** A number that steps up or down a little as it changes (the drum's step, smaller). */
function SteppingNumber({ value, text, style }: { value: number; text: string; style: object }) {
  const reduceMotion = useReducedMotion();
  const shift = useSharedValue(0);
  const last = useRef(value);
  useEffect(() => {
    const from = last.current;
    last.current = value;
    if (reduceMotion || from === value) return;
    shift.set(value > from ? device.displayRise : -device.displayRise);
    shift.set(withTiming(0, { duration: DEVICE.DRUM, easing: EASE_DISPLAY_FN }));
  }, [value, reduceMotion, shift]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: shift.get() }] }));
  return (
    <Animated.Text maxFontSizeMultiplier={1} numberOfLines={1} style={[style, animated]}>
      {text}
    </Animated.Text>
  );
}

/**
 * Device edit (SPEC §5 Edit, screen 22): `<DAY>  EDIT` / `n OF m`, the lift name (28), then
 * SETS × REPS (104 each) with the wheel's value framed in amber, and the plan / `N REPS`.
 */
export function EditDisplay({ edit }: { edit: EditController }) {
  const height = useDisplayHeight();
  const { face } = edit;
  const role = numberRole(face.setsText.length + face.valueText.length);
  const numbersY = height
    ? Math.max(geo.nameY, Math.min(geo.numbersY, height - geo.footerRoom - geo.numbersHeight))
    : geo.numbersY;
  // On short displays (iPhone SE) the numbers move up into the name's second line: keep it to one, shrunk.
  const nameLines = numbersY - geo.nameY >= 2 * gadgetType.lcdName.lineHeight + geo.nameClear ? 2 : 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.header}>
        <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim, styles.shrink]}>
          {`${edit.dayName.toUpperCase()}  EDIT`}
        </Text>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim]}>
          {`${edit.index + 1} OF ${edit.count}`}
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={1}
        numberOfLines={nameLines}
        adjustsFontSizeToFit={nameLines === 1}
        minimumFontScale={geo.nameMinScale}
        style={[gadgetType.lcdName, styles.name]}>
        {edit.exercise.name.toUpperCase()}
      </Text>
      <View style={[styles.numbers, { top: numbersY }]}>
        <View>
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdCaption, styles.dim]}>
            SETS
          </Text>
          <SteppingNumber
            value={face.sets}
            text={face.setsText}
            style={[role.text, styles.number, { lineHeight: role.line }]}
          />
        </View>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdTimes, styles.dim, styles.times]}>
          ×
        </Text>
        <View>
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdCaption, styles.dim]}>
            {face.valueLabel}
          </Text>
          <SteppingNumber
            value={face.value}
            text={face.valueText}
            style={[role.text, styles.number, { lineHeight: role.line }]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.frame,
              { top: geo.frameTop, height: role.line + geo.frameHeight - geo.numberLine },
            ]}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim, styles.shrink]}>
          {edit.planName.toUpperCase()}
        </Text>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim]}>
          {face.total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { color: lcd.amberDim },
  shrink: { flexShrink: 1 },
  header: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: device.rowGap,
  },
  name: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: geo.nameY },
  numbers: {
    position: 'absolute',
    left: device.displayPad,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: geo.columnGap,
  },
  number: { marginTop: geo.numberGap },
  times: { marginBottom: geo.timesLift },
  frame: {
    position: 'absolute',
    left: -geo.frameOutset,
    right: -geo.frameOutset,
    borderRadius: geo.frameRadius,
    borderCurve: 'continuous',
    borderWidth: geo.frameStroke,
    borderColor: lcd.amber,
  },
  footer: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    bottom: geo.footerY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: device.rowGap,
  },
});
