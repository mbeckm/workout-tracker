import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
  style?: StyleProp<ViewStyle>;
}) {
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
        <View style={styles.shadow} />
        <View style={styles.clip}>
          <DeviceBody rim rimRadius={deviceObject.radius}>
            <View style={[styles.column, { paddingTop: deviceObject.padTop }]}>
              <View style={[styles.topRow, { paddingHorizontal: edge }]}>
                <RoundKey accessibilityLabel="Menu">
                  <MenuGlyph />
                </RoundKey>
                <Rocker variant="week" lamps={lamps} accessibilityLabel="" />
                <RoundKey accessibilityLabel="History">
                  <HistoryGlyph />
                </RoundKey>
              </View>
              <Display contentKey={displayKey} style={[styles.display, { marginHorizontal: edge }]}>
                {display}
              </Display>
              <View style={styles.bottomRow}>
                <TallKey label="+" accessibilityLabel="More" style={[styles.abs, { left: edge + KEY_INSET, top: logGeometry.tallKeyTop }]} />
                <TallKey
                  label="−"
                  accessibilityLabel="Fewer"
                  style={[styles.abs, { left: edge + KEY_INSET, top: logGeometry.tallKeyBottom }]}
                />
                <View style={[styles.centered, { top: WELL_Y }]}>
                  <Well />
                </View>
                <View style={[styles.centered, { top: BIG_KEY_Y }]}>
                  <BigKey label={bigKeyLabel} />
                </View>
                <Wheel
                  onNotch={NONE}
                  accessibilityLabel="Weight"
                  label={wheelLabel}
                  style={[styles.abs, { top: 0, right: edge + KEY_INSET }]}
                />
              </View>
            </View>
          </DeviceBody>
        </View>
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
  column: { flex: 1 },
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
