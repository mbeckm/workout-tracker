import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fontScaleCap,
  importColors,
  importGeometry,
  importType,
  onboardingGeometry as G,
  packColors,
  signal,
  space,
} from '@/constants/theme';
import { PRESS_SCALE } from '@/motion';
import { Cartridge, EmptySlot } from '@/screens/onboarding/pack';

/**
 * A big choice card (decision 88): art at the top, a bold title and one line at the bottom, on the
 * plan packs' ground. Onboarding's Got a plan? uses them as radios with an orange ring; the rack's
 * New plan sheet as buttons that go straight on.
 */
export function ForkCard({
  title,
  sub,
  selected,
  onPress,
  children,
  style,
  testID,
}: {
  title: string;
  sub: string;
  /** Radios only: draws the ring. Leave undefined for a button. */
  selected?: boolean;
  onPress: () => void;
  children: ReactNode;
  style?: object;
  testID: string;
}) {
  const radio = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: selected } : undefined}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.card, selected && styles.on, pressed && !selected && styles.pressed, style]}>
      {children}
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={importType.forkTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={importType.forkSub}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

/** Two sheets of notes, tilted apart: a plan written down somewhere. */
export function NotesArt() {
  return (
    <View style={styles.row}>
      <Note tilt={-importGeometry.noteTilt} />
      <Note tilt={importGeometry.noteTilt} back />
    </View>
  );
}

/** A starter plan's cartridges; they hop once when `hop` turns on. */
export function CartsArt({ labels, hop = false }: { labels: readonly string[]; hop?: boolean }) {
  return (
    <View style={[styles.row, styles.carts]}>
      {labels.map((label, index) => (
        <Cartridge key={label} label={label} hop={hop} order={index} />
      ))}
    </View>
  );
}

/** Empty cartridge slots: a plan you fill in yourself. */
export function EmptySlotsArt({ count = 3 }: { count?: number }) {
  return (
    <View style={[styles.row, styles.carts]}>
      {Array.from({ length: count }, (_, index) => (
        <EmptySlot key={index} />
      ))}
    </View>
  );
}

function Note({ tilt, back = false }: { tilt: number; back?: boolean }) {
  return (
    <View
      style={[
        styles.note,
        back && styles.noteBack,
        { transform: [{ rotate: `${tilt}deg` }, { translateY: back ? space.tight : 0 }] },
      ]}>
      <View style={[styles.noteLine, styles.noteHeading, back && styles.noteHeadingBack]} />
      <View style={[styles.noteLine, styles.w100, back && styles.noteLineBack]} />
      <View style={[styles.noteLine, styles.w80, back && styles.noteLineBack]} />
      <View style={[styles.noteLine, styles.w100, back && styles.noteLineBack]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: G.packRadius,
    borderCurve: 'continuous',
    backgroundColor: packColors.pack,
    boxShadow: `inset 0 1px 0 ${packColors.packHighlight}`,
    paddingHorizontal: G.packPadX,
    paddingVertical: G.packPadX,
    justifyContent: 'space-between',
  },
  on: { boxShadow: `inset 0 0 0 ${G.packRing}px ${signal.orange}` },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
  text: { gap: space.pair },
  row: { flexDirection: 'row', gap: space.related },
  carts: { gap: G.cartGap },
  note: {
    width: importGeometry.noteWidth,
    height: importGeometry.noteHeight,
    borderRadius: importGeometry.rowIconRadius + 2,
    backgroundColor: importColors.paper,
    padding: space.related,
    gap: space.tight,
  },
  noteBack: { backgroundColor: importColors.paperLineSoft },
  noteLine: { height: importGeometry.bar - 2, borderRadius: importGeometry.barRadius, backgroundColor: importColors.paperLineSoft },
  noteLineBack: { backgroundColor: importColors.barStrong },
  noteHeading: { width: '70%', height: importGeometry.bar - 1, backgroundColor: importColors.paperLineStrong },
  noteHeadingBack: { backgroundColor: importColors.barSoft },
  w100: { width: '100%' },
  w80: { width: '80%' },
});
