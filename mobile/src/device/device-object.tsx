import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { device, deviceObject, gadgetType, logGeometry } from '@/constants/theme';
import {
  BigKey,
  DeviceBody,
  Display,
  HistoryGlyph,
  MenuGlyph,
  Rocker,
  RoundKey,
  TallKey,
  Well,
  Wheel,
  type LampState,
} from '@/device/parts';

/** The top row, the gaps around the display, and the bottom row (as on the device screen, SPEC §4). */
const ROW_GAP = device.displayY - device.topRowY - device.keySize;
const BOTTOM_ROW = device.wheelHeight + device.labelGap + gadgetType.engraved.lineHeight;
const WELL_Y = 2;
const BIG_KEY_Y = WELL_Y + (device.wellSize - device.bigKeySize) / 2;
const KEY_INSET = 2;

/** The object's frame before scaling: the device screen at the reference, its display 300 tall. */
export const DEVICE_OBJECT_HEIGHT =
  deviceObject.padTop +
  device.keySize +
  ROW_GAP +
  deviceObject.displayHeight +
  ROW_GAP +
  BOTTOM_ROW +
  deviceObject.padBottom;

const NONE = () => false as const;

/** The parts of the device object that can move on their own (first open, D74). */
export type DevicePart = 'menu' | 'rocker' | 'history' | 'display' | 'plus' | 'minus' | 'well' | 'bigKey' | 'wheel';

type PartStyle = StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;

/**
 * First open's assembly (D74): an animated style for the body and for each part, plus layers in
 * the object's 390 frame: `underlay` over the body and under the parts, `overlay` over all.
 * Without it the object is static. The parts sit outside the body's clip so they can fly in.
 */
export type DeviceAssembly = {
  body?: PartStyle;
  parts?: Partial<Record<DevicePart, PartStyle>>;
  underlay?: ReactNode;
  overlay?: ReactNode;
};

const BOTTOM_ROW_Y = deviceObject.padTop + device.keySize + ROW_GAP + deviceObject.displayHeight + ROW_GAP;

/** Where each part's centre sits in the object's 390 frame (sparks, glows). */
export const DEVICE_OBJECT_ANCHORS: Record<DevicePart, { x: number; y: number }> = {
  menu: { x: device.edge + device.keySize / 2, y: deviceObject.padTop + device.keySize / 2 },
  rocker: { x: deviceObject.width / 2, y: deviceObject.padTop + device.keySize / 2 },
  history: { x: deviceObject.width - device.edge - device.keySize / 2, y: deviceObject.padTop + device.keySize / 2 },
  // The display's top edge: it lands from above.
  display: { x: deviceObject.width / 2, y: deviceObject.padTop + device.keySize + ROW_GAP },
  plus: {
    x: device.edge + KEY_INSET + device.tallKeyWidth / 2,
    y: BOTTOM_ROW_Y + logGeometry.tallKeyTop + device.tallKeyHeight / 2,
  },
  minus: {
    x: device.edge + KEY_INSET + device.tallKeyWidth / 2,
    y: BOTTOM_ROW_Y + logGeometry.tallKeyBottom + device.tallKeyHeight / 2,
  },
  well: { x: deviceObject.width / 2, y: BOTTOM_ROW_Y + WELL_Y + device.wellSize / 2 },
  bigKey: { x: deviceObject.width / 2, y: BOTTOM_ROW_Y + BIG_KEY_Y + device.bigKeySize / 2 },
  wheel: {
    x: deviceObject.width - device.edge - KEY_INSET - device.wheelWidth / 2,
    y: BOTTOM_ROW_Y + device.wheelHeight / 2,
  },
};

/** A part's slot: animated while an assembly drives it, a plain view otherwise. */
function Slot({ animated, style, children }: { animated?: PartStyle; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (animated) return <Animated.View style={[style, animated]}>{children}</Animated.View>;
  return <View style={style}>{children}</View>;
}

/** The scale that fits the object in a box. */
export function deviceObjectScale(maxWidth: number, maxHeight: number): number {
  return Math.max(0.1, Math.min(maxWidth / deviceObject.width, maxHeight / DEVICE_OBJECT_HEIGHT));
}

/**
 * The device as an object on the grid (onboarding; boards N7, N10): the same parts as the device
 * screen, in the current finish (a preview included), with rounded corners, a rim and a cast
 * shadow, laid out at the 390 reference and scaled to fit. It's a picture of the device, so it
 * takes no touches and reads as one image to VoiceOver.
 */
export function DeviceObject({
  scale,
  display,
  displayKey,
  lamps = [],
  wheelLabel,
  bigKeyLabel = 'Start',
  accessibilityLabel,
  assembly,
  style,
}: {
  scale: number;
  display: ReactNode;
  /** Changes play the display's fade-and-rise swap. */
  displayKey: string;
  lamps?: readonly LampState[];
  /** Engraved under the wheel (the weight unit). */
  wheelLabel?: string;
  bigKeyLabel?: string;
  accessibilityLabel: string;
  assembly?: DeviceAssembly;
  style?: StyleProp<ViewStyle>;
}) {
  const parts = assembly?.parts ?? {};
  const width = deviceObject.width;
  const height = DEVICE_OBJECT_HEIGHT;
  const edge = device.edge;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
      style={[{ width: width * scale, height: height * scale }, style]}>
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.frame,
          {
            width,
            height,
            left: (width * scale - width) / 2,
            top: (height * scale - height) / 2,
            transform: [{ scale }],
          },
        ]}>
        <Slot animated={assembly?.body} style={StyleSheet.absoluteFill}>
          <View style={styles.shadow} />
          <View style={styles.clip}>
            <DeviceBody rim rimRadius={deviceObject.radius} />
          </View>
        </Slot>
        {assembly?.underlay}
        <View style={[styles.column, { paddingTop: deviceObject.padTop }]}>
          <View style={[styles.topRow, { paddingHorizontal: edge }]}>
            <Slot animated={parts.menu}>
              <RoundKey accessibilityLabel="Menu">
                <MenuGlyph />
              </RoundKey>
            </Slot>
            <Slot animated={parts.rocker}>
              <Rocker variant="week" lamps={lamps} accessibilityLabel="" />
            </Slot>
            <Slot animated={parts.history}>
              <RoundKey accessibilityLabel="History">
                <HistoryGlyph />
              </RoundKey>
            </Slot>
          </View>
          <Slot animated={parts.display} style={[styles.display, { marginHorizontal: edge }]}>
            <Display contentKey={displayKey} style={styles.fill}>
              {display}
            </Display>
          </Slot>
          <View style={styles.bottomRow}>
            <Slot animated={parts.plus} style={[styles.abs, { left: edge + KEY_INSET, top: logGeometry.tallKeyTop }]}>
              <TallKey label="+" accessibilityLabel="More" />
            </Slot>
            <Slot animated={parts.minus} style={[styles.abs, { left: edge + KEY_INSET, top: logGeometry.tallKeyBottom }]}>
              <TallKey label="−" accessibilityLabel="Fewer" />
            </Slot>
            <Slot animated={parts.well} style={[styles.centered, { top: WELL_Y }]}>
              <Well />
            </Slot>
            <Slot animated={parts.wheel} style={[styles.abs, { top: 0, right: edge + KEY_INSET }]}>
              <Wheel onNotch={NONE} accessibilityLabel="Weight" label={wheelLabel} />
            </Slot>
            {/* After the wheel, so the Start key passes over it while it hovers (first open). */}
            <Slot animated={parts.bigKey} style={[styles.centered, { top: BIG_KEY_Y }]}>
              <BigKey label={bigKeyLabel} />
            </Slot>
          </View>
        </View>
        {assembly?.overlay}
      </View>
    </View>
  );
}

/** Rocker lamps for a week of `days` (all off: nothing trained yet). */
export function offLamps(days: number): LampState[] {
  return Array.from({ length: Math.max(0, days) }, () => 'off' as const);
}

const styles = StyleSheet.create({
  frame: { position: 'absolute' },
  shadow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: deviceObject.radius,
    borderCurve: 'continuous',
    boxShadow: `0 ${deviceObject.shadowY}px ${deviceObject.shadowBlur}px ${deviceObject.shadow}`,
  },
  clip: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: deviceObject.radius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  column: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { flex: 1 },
  topRow: {
    height: device.keySize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  display: { height: deviceObject.displayHeight, marginVertical: ROW_GAP },
  bottomRow: { height: BOTTOM_ROW },
  centered: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  abs: { position: 'absolute' },
});
