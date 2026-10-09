import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  fontScaleCap,
  lcd,
  objectColors,
  onboardingGeometry,
  onboardingType,
  packColors,
  signal,
  space,
} from '@/constants/theme';
import { cartLabel } from '@/device/plans-model';
import { DEVICE, EASE_FILE_FN, EASE_KEY_FN, PRESS_SCALE } from '@/motion';

/** A selected pack's cartridges hop once, one after another (a small cousin of the rack's filing). */
const HOP = 6;
const HOP_STAGGER = DEVICE.FILE_STAGGER / 3;

/** A cartridge's label: the rack's rule (`cartLabel`) in the pack's narrower window. */
export function cartridgeLabel(title: string): string {
  return cartLabel(title, onboardingGeometry.cartLabelChars);
}

/**
 * A plan pack (PB1 `.pack`): the plan's name and one fact, and its days as cartridges along the
 * bottom. Selected: a 3pt orange ring, and the cartridges hop in turn. `labels: null` per slot
 * draws an empty slot with `+` (Build my own).
 */
export function PlanPack({
  title,
  sub,
  carts,
  selected,
  onSelect,
  accessibilityLabel,
  testID,
}: {
  title: string;
  sub: string;
  /** One per day: its label, or null for an empty slot. */
  carts: readonly (string | null)[];
  selected: boolean;
  onSelect: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onSelect}
      testID={testID}
      style={({ pressed }) => [styles.pack, selected && styles.on, pressed && !selected && styles.pressed]}>
      <Text maxFontSizeMultiplier={fontScaleCap.title} style={onboardingType.packTitle}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.packSub, styles.sub]}>
        {sub}
      </Text>
      <View style={styles.carts}>
        {carts.map((label, index) =>
          label == null ? (
            <EmptySlot key={index} />
          ) : (
            <Cartridge key={index} label={label} hop={selected} order={index} />
          ),
        )}
      </View>
    </Pressable>
  );
}

export function Cartridge({ label, hop, order }: { label: string; hop: boolean; order: number }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  // The pack picked when the step opens doesn't hop; only a pick does.
  const first = useRef(true);
  useEffect(() => {
    const initial = first.current;
    first.current = false;
    if (!hop || reduceMotion || initial) {
      return;
    }
    y.set(
      withDelay(
        order * HOP_STAGGER,
        withSequence(
          withTiming(-HOP, { duration: DEVICE.KEY_PRESS, easing: EASE_KEY_FN }),
          withTiming(0, { duration: DEVICE.DRUM * 2, easing: EASE_FILE_FN }),
        ),
      ),
    );
  }, [hop, order, reduceMotion, y]);
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Animated.View style={[styles.cartFrame, hopStyle]}>
      <View style={styles.cartLip} />
      <View style={styles.cart}>
        <View style={styles.window}>
          <Text maxFontSizeMultiplier={1} numberOfLines={1} style={onboardingType.cartLabel}>
            {label}
          </Text>
        </View>
        <View style={styles.grip}>
          {GRIP.map((key) => (
            <View key={key} style={styles.ridge} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const GRIP = Array.from(
  {
    length: Math.floor(
      (onboardingGeometry.cartW - onboardingGeometry.cartGripInset * 2 + onboardingGeometry.cartGripRidge) /
        onboardingGeometry.cartGripPeriod,
    ),
  },
  (_, index) => index,
);

function EmptySlot() {
  return (
    <View style={[styles.cartFrame, styles.blank]}>
      <Text maxFontSizeMultiplier={1} style={onboardingType.cartPlus}>
        +
      </Text>
    </View>
  );
}

const G = onboardingGeometry;

const styles = StyleSheet.create({
  pack: {
    minHeight: G.packHeight,
    borderRadius: G.packRadius,
    borderCurve: 'continuous',
    backgroundColor: packColors.pack,
    boxShadow: `inset 0 1px 0 ${packColors.packHighlight}`,
    paddingHorizontal: G.packPadX,
    paddingVertical: G.packPadY,
  },
  on: { boxShadow: `inset 0 0 0 ${G.packRing}px ${signal.orange}` },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
  sub: { marginTop: space.pair },
  carts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: G.cartGap,
    marginTop: space.inline,
    // Room for the cartridges' lip.
    paddingBottom: G.cartLip,
    flexGrow: 1,
    alignContent: 'flex-end',
  },
  cartFrame: { width: G.cartW, height: G.cartH },
  cartLip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: G.cartLip,
    bottom: -G.cartLip,
    backgroundColor: objectColors.lip,
    borderTopLeftRadius: G.cartRadiusTop,
    borderTopRightRadius: G.cartRadiusTop,
    borderBottomLeftRadius: G.cartRadiusBottom,
    borderBottomRightRadius: G.cartRadiusBottom,
  },
  cart: {
    flex: 1,
    borderTopLeftRadius: G.cartRadiusTop,
    borderTopRightRadius: G.cartRadiusTop,
    borderBottomLeftRadius: G.cartRadiusBottom,
    borderBottomRightRadius: G.cartRadiusBottom,
    borderCurve: 'continuous',
    backgroundColor: objectColors.plasticLo,
    experimental_backgroundImage: `linear-gradient(180deg, ${objectColors.plasticHi}, ${objectColors.plasticLo})`,
    boxShadow: `inset 0 2px 0 ${packColors.cartHighlight}`,
  },
  window: {
    position: 'absolute',
    left: G.cartWindowInset,
    right: G.cartWindowInset,
    top: G.cartWindowTop,
    height: G.cartWindowH,
    borderRadius: G.cartWindowRadius,
    backgroundColor: lcd.lcd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: {
    position: 'absolute',
    left: G.cartGripInset,
    right: G.cartGripInset,
    bottom: G.cartGripBottom,
    height: G.cartGripH,
    flexDirection: 'row',
    gap: G.cartGripPeriod - G.cartGripRidge,
  },
  ridge: { width: G.cartGripRidge, backgroundColor: packColors.cartGrip },
  blank: {
    borderRadius: G.cartRadiusTop,
    borderCurve: 'continuous',
    boxShadow: `inset 0 0 0 ${G.cartBlankRing}px ${packColors.blankRing}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
