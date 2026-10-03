import { useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { device, gadgetType, insertColors, insertGeometry as geo, lcd } from '@/constants/theme';
import { EmptySlot } from '@/device/home/home-display';
import { DEVICE, EASE_DISPLAY } from '@/motion';

import { boot } from './timeline';
import type { InsertController } from './use-insert';

const ROW_IN = FadeInUp.duration(DEVICE.DISPLAY)
  .easing(EASE_DISPLAY)
  .withInitialValues({ opacity: 0, transform: [{ translateY: device.displayRise }] });
const ROW_IN_REDUCED = FadeIn.duration(DEVICE.DISPLAY);
/** Reanimated's web entering can leave a new view hidden; web only smoke-tests. */
const ANIMATES = Platform.OS !== 'web';

/**
 * The display while a plan loads (SPEC §5 Loading; frames a–g): `SLOT EMPTY` with a blinking
 * `INSERT PLAN` until the click, then `LOADED` / `k/n`, the plan name (40), the days ticking in
 * with ✓, and a 10-segment bar. On the JS insert's clock it powers on at the click (scaleY
 * .02 → 1.04 → 1 with the ground flickering).
 */
export function LoadingDisplay({ insert }: { insert: InsertController }) {
  if (insert.display === 'empty') {
    return <EmptySlot />;
  }
  return <Loaded insert={insert} />;
}

function Loaded({ insert }: { insert: InsertController }) {
  const reduceMotion = useReducedMotion();
  const [height, setHeight] = useState(0);
  const n = insert.days.length;
  const filled = n > 0 ? Math.round((insert.ticked / n) * geo.barSegments) : 0;
  // Long plans close the list up so the last day stays clear of the bar.
  const listRoom = height - geo.loadedListY - geo.barBottom - geo.barHeight - device.rowGap;
  const line = height && n > 0 ? Math.min(geo.loadedLine, Math.max(gadgetType.lcdSmall.lineHeight, listRoom / n)) : geo.loadedLine;

  const clock = insert.clock;
  const bootStyle = useAnimatedStyle(() => {
    if (!clock) return { transform: [{ scaleY: 1 }] };
    return { transform: [{ scaleY: boot(clock.get()).scaleY }] };
  });
  const flash1 = useAnimatedStyle(() => ({ opacity: clock && boot(clock.get()).flash === 1 ? 1 : 0 }));
  const flash2 = useAnimatedStyle(() => ({ opacity: clock && boot(clock.get()).flash === 2 ? 1 : 0 }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      accessible
      accessibilityLabel={`Loaded ${insert.planName}, ${insert.ticked} of ${n} days`}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash1, flash1]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash2, flash2]} />
      <Animated.View style={[StyleSheet.absoluteFill, bootStyle]}>
        <View style={styles.header}>
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim]}>
            LOADED
          </Text>
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim]}>
            {`${insert.ticked}/${n}`}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={1} numberOfLines={2} style={[gadgetType.lcdPrompt, styles.name]}>
          {insert.planName.toUpperCase()}
        </Text>
        <View style={styles.list}>
          {insert.days.slice(0, insert.ticked).map((day, index) => (
            <Animated.View
              key={index}
              entering={!ANIMATES ? undefined : reduceMotion ? ROW_IN_REDUCED : ROW_IN}
              style={{ height: line }}>
              <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdLoadDay, { lineHeight: line }]}>
                {`${day.title.toUpperCase()} `}
                <Text style={styles.dim}>{`${day.lifts} ${day.lifts === 1 ? 'LIFT' : 'LIFTS'}`}</Text>
                {' ✓'}
              </Text>
            </Animated.View>
          ))}
        </View>
        <View style={styles.bar}>
          {Array.from({ length: geo.barSegments }, (_, index) => (
            <View key={index} style={[styles.segment, index < filled ? styles.segmentOn : null]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { color: lcd.amberDim },
  header: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: geo.loadedNameY },
  list: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: geo.loadedListY },
  bar: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    bottom: geo.barBottom,
    flexDirection: 'row',
    gap: geo.barGap,
  },
  segment: { flex: 1, height: geo.barHeight, backgroundColor: lcd.amberOff },
  segmentOn: { backgroundColor: lcd.amber },
  flash1: { backgroundColor: insertColors.bootFlash1 },
  flash2: { backgroundColor: insertColors.bootFlash2 },
});
