import { Children, useEffect, useRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  device,
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  sheetColors,
  sheetGeometry,
  signal,
  finishColors,
  space,
} from '@/constants/theme';
import { DEVICE, PRESS_SCALE } from '@/motion';

import { useSheetChrome } from './sheet-context';

/* ----------------------------------------------------------------------------------------- *
 * Layout: header over a scroll, an optional sticky action bar
 * ----------------------------------------------------------------------------------------- */

/**
 * A sheet's page: the content scrolls under the sticky header (prototype `.scroll` + `.sh-top`)
 * and, with `actionBar`, over a sticky bar at the bottom (`.usebar`). The swipe-down hands off
 * from this scroll at its top.
 */
export function SheetScroll({
  header,
  actionBar,
  scrollRef,
  children,
}: {
  header: ReactNode;
  actionBar?: ReactNode;
  /** For sheets that scroll a focused field into view (the check-in). */
  scrollRef?: Ref<Animated.ScrollView>;
  children: ReactNode;
}) {
  const { scrollY, scrollGesture, keyboard } = useSheetChrome();
  const insets = useSafeAreaInsets();
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  const bottom = Math.max(insets.bottom, sheetGeometry.bottomPad);
  return (
    <View style={styles.fill}>
      <GestureDetector gesture={scrollGesture}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          // At the top a pull moves the sheet, not the content.
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={keyboard ? 'interactive' : 'none'}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: actionBar
                ? bottom + sheetGeometry.pillHeight + sheetGeometry.usebarTop
                : bottom,
            },
          ]}>
          {children}
        </Animated.ScrollView>
      </GestureDetector>
      {actionBar}
      <View style={styles.headerSlot} pointerEvents="box-none">
        {header}
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Header
 * ----------------------------------------------------------------------------------------- */

export type SheetControl = {
  /** `back` ‹ and `close` ✕ draw glyphs; anything else is a word (Done, Edit) or `+`. */
  kind: 'back' | 'close' | 'text';
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
  /** Dimmed and inert (Save with nothing to save). */
  disabled?: boolean;
};

const CONTROL_GLYPH = { back: '‹', close: '✕' } as const;
const CONTROL_A11Y = { back: 'Back', close: 'Close' } as const;

/**
 * The sticky header (SPEC §6): 68 tall, the title centred (18/800), round 40pt controls 16
 * from the edges, fading from the sheet colour at 70% to clear. VoiceOver lands on the title
 * whenever the sheet opens or swaps.
 */
export function SheetHeader({
  title,
  titleHidden = false,
  left,
  right,
}: {
  title: string;
  /** The page repeats the title right below (the editor's plan name): drawn clear, still read first. */
  titleHidden?: boolean;
  left?: SheetControl;
  right?: SheetControl;
}) {
  const { focusKey } = useSheetChrome();
  const titleRef = useRef<Text>(null);

  useEffect(() => {
    // After the slide, so VoiceOver doesn't read the device underneath first.
    const timer = setTimeout(() => {
      // Not on web (react-native-web has no sendAccessibilityEvent).
      if (titleRef.current && typeof AccessibilityInfo.sendAccessibilityEvent === 'function') {
        AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
      }
    }, DEVICE.SHEET);
    return () => clearTimeout(timer);
  }, [focusKey]);

  return (
    <View style={styles.header}>
      <Text
        ref={titleRef}
        accessibilityRole="header"
        numberOfLines={1}
        maxFontSizeMultiplier={fontScaleCap.title}
        style={[gadgetType.sheetTitle, styles.title, titleHidden && styles.titleHidden]}>
        {title}
      </Text>
      {left ? <ControlButton control={left} side="left" /> : null}
      {right ? <ControlButton control={right} side="right" /> : null}
    </View>
  );
}

function ControlButton({ control, side }: { control: SheetControl; side: 'left' | 'right' }) {
  const text = control.kind === 'text' ? (control.label ?? '') : CONTROL_GLYPH[control.kind];
  const label =
    control.accessibilityLabel ?? (control.kind === 'text' ? text : CONTROL_A11Y[control.kind]);
  return (
    <Pressable
      onPress={control.onPress}
      disabled={control.disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={control.disabled ? { disabled: true } : undefined}
      hitSlop={sheetGeometry.controlTop / 2}
      style={({ pressed }) => [
        styles.control,
        side === 'left' ? styles.controlLeft : styles.controlRight,
        pressed && styles.controlPressed,
        control.disabled && styles.disabled,
      ]}>
      <Text maxFontSizeMultiplier={fontScaleCap.display} style={gadgetType.control}>
        {text}
      </Text>
    </Pressable>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Cards and rows
 * ----------------------------------------------------------------------------------------- */

/** A card (SPEC §6 Content): r24, its rows split by a 1pt rule. */
export function SheetCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = Children.toArray(children);
  return (
    <View style={[styles.card, style]}>
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? styles.rule : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

/**
 * A row (prototype `.item`): an optional 56pt object icon, the title over a muted sub, and an
 * optional trailing value. `size="compact"` is the settings row (17pt title).
 */
export function SheetRow({
  title,
  sub,
  icon,
  trailing,
  accessory,
  onPress,
  destructive = false,
  size = 'large',
  accessibilityLabel,
  testID,
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
  trailing?: string;
  /** A control at the end (a switch, a text field); it carries its own label. */
  accessory?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  size?: 'large' | 'compact';
  accessibilityLabel?: string;
  testID?: string;
}) {
  const titleStyle = size === 'large' ? gadgetType.itemTitle : gadgetType.rowTitle;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      // With an accessory, VoiceOver reaches the control itself.
      accessible={accessory == null}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        accessibilityLabel ?? [title, sub, trailing].filter((part) => part != null && part !== '').join(', ')
      }
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
      {icon}
      <View style={styles.itemText}>
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[titleStyle, destructive && styles.destructive]}>
          {title}
        </Text>
        {sub ? (
          <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.sub]}>
            {sub}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[gadgetType.rowSub, styles.trailing]}>
          {trailing}
        </Text>
      ) : null}
      {accessory}
    </Pressable>
  );
}

/** Section label (SPEC §6): Doto 13, spacing 1, uppercase. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={fontScaleCap.title}
      style={[gadgetType.sectionLabel, styles.section]}>
      {children.toUpperCase()}
    </Text>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Actions
 * ----------------------------------------------------------------------------------------- */

/** The pill (SPEC §6 Main action): 56 tall, r28; light for the main action, dark for the rest. */
export function PillButton({
  title,
  onPress,
  variant = 'light',
  disabled = false,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: 'light' | 'dark';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const light = variant === 'light';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: light ? sheetColors.pillLight : sheetColors.pillDark },
        disabled && styles.disabled,
        pressed && styles.pillPressed,
        style,
      ]}>
      <Text
        maxFontSizeMultiplier={fontScaleCap.title}
        style={[gadgetType.pill, { color: light ? sheetColors.pillLightInk : sheetColors.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** The sticky bottom bar (prototype `.usebar`): fades the content out under its pill. */
export function StickyActionBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.usebar, { paddingBottom: Math.max(insets.bottom, sheetGeometry.usebarBottom) }]}>
      {children}
    </View>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Chips and the segmented control
 * ----------------------------------------------------------------------------------------- */

/** A small status chip (prototype `.chip`): `next` orange, `done` quiet. */
export function Chip({ label, tone = 'next' }: { label: string; tone?: 'next' | 'done' }) {
  const next = tone === 'next';
  return (
    <View style={[styles.chip, { backgroundColor: next ? signal.orange : sheetColors.track }]}>
      <Text
        maxFontSizeMultiplier={fontScaleCap.display}
        style={[gadgetType.chip, { color: next ? sheetColors.onOrange : sheetColors.muted }]}>
        {label}
      </Text>
    </View>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string; badge?: string };

/** The segmented control (prototype `.seg`): the selected segment is orange. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.badge ? `${option.label}, ${option.badge}` : option.label}
            style={[styles.segButton, on && styles.segOn]}>
            <Text
              maxFontSizeMultiplier={fontScaleCap.display}
              style={[gadgetType.seg, on && styles.segOnText]}>
              {option.label}
              {option.badge ? (
                <Text style={[gadgetType.engraved, styles.segBadge]}>{` ${option.badge}`}</Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: {
    paddingTop: sheetGeometry.headerHeight,
    paddingHorizontal: sheetGeometry.sidePad,
  },
  headerSlot: { position: 'absolute', left: 0, right: 0, top: 0 },
  header: {
    height: sheetGeometry.headerHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sheetGeometry.control + sheetGeometry.controlInset * 2,
    experimental_backgroundImage: `linear-gradient(180deg, ${sheetColors.sheet} 70%, ${sheetColors.sheetClear})`,
  },
  title: { textAlign: 'center' },
  titleHidden: { opacity: 0 },
  control: {
    position: 'absolute',
    top: sheetGeometry.controlTop,
    height: sheetGeometry.control,
    minWidth: sheetGeometry.control,
    paddingHorizontal: sheetGeometry.controlPadX,
    borderRadius: gadgetRadius.control,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLeft: { left: sheetGeometry.controlInset },
  controlRight: { right: sheetGeometry.controlInset },
  controlPressed: { backgroundColor: sheetColors.cardRaised },
  card: {
    backgroundColor: sheetColors.card,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    marginBottom: sheetGeometry.cardGap,
    overflow: 'hidden',
  },
  rule: { borderTopWidth: 1, borderTopColor: sheetColors.rule },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sheetGeometry.itemGap,
    paddingHorizontal: sheetGeometry.itemPadX,
    paddingVertical: sheetGeometry.itemPadY,
  },
  itemPressed: { backgroundColor: sheetColors.cardRaised },
  itemText: { flex: 1, minWidth: 0 },
  sub: { marginTop: space.pair },
  trailing: { flexShrink: 1, textAlign: 'right' },
  destructive: { color: signal.orange },
  section: {
    marginTop: sheetGeometry.sectionTop,
    marginHorizontal: sheetGeometry.sectionX,
    marginBottom: sheetGeometry.sectionBottom,
  },
  pill: {
    alignSelf: 'center',
    width: sheetGeometry.pillWidth,
    height: sheetGeometry.pillHeight,
    marginTop: sheetGeometry.pillTop,
    borderRadius: gadgetRadius.key,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPressed: { transform: [{ scale: PRESS_SCALE }] },
  disabled: { opacity: device.keyDisabledOpacity },
  usebar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: sheetGeometry.usebarTop,
    experimental_backgroundImage: `linear-gradient(180deg, ${sheetColors.sheetClear}, ${sheetColors.sheet} 40%)`,
  },
  chip: {
    height: sheetGeometry.chipHeight,
    paddingHorizontal: sheetGeometry.chipPadX,
    borderRadius: gadgetRadius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: sheetColors.card,
    borderRadius: gadgetRadius.seg,
    borderCurve: 'continuous',
    padding: sheetGeometry.segPad,
    marginTop: space.inline,
  },
  segButton: {
    flex: 1,
    height: sheetGeometry.segHeight,
    borderRadius: gadgetRadius.segButton,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: { backgroundColor: signal.orange },
  segOnText: { color: sheetColors.onOrange },
  // The prototype's PRO mark is the big key's highlight orange.
  segBadge: { color: finishColors['212'].bigKeyHi },
});
