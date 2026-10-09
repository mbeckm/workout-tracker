import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type EntryOrExitLayoutType } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  onboardingGeometry,
  onboardingType,
  sheetColors,
  sheetGeometry,
  space,
} from '@/constants/theme';
import { ToastHost } from '@/components/toast';
import { GridGround } from '@/device/moment/grid-ground';
import { KeyboardStickyView } from '@/keyboard';
import { PRESS_SCALE } from '@/motion';

/**
 * One onboarding step on the moments' dark grid ground (D12, PB1, N10): a round ‹ (except on
 * Welcome), the step's question centred with an optional fact under it, a scrollable stage, and
 * the light Continue pill at the thumb, riding the keyboard on a step with a field.
 */
export function OnboardingFrame({
  title,
  sub,
  back = true,
  action,
  children,
  stageStyle,
  scroll = true,
  ground,
  actionEntering,
  actionKey,
  testID,
}: {
  /** The step's question, read as the screen's header. */
  title?: string;
  /** One fact under the title (`4 days a week`). */
  sub?: string;
  back?: boolean;
  /** The light pill at the thumb; left out when the stage brings its own actions (Import plan). */
  action?: { title: string; onPress: () => void; testID?: string; disabled?: boolean };
  children: ReactNode;
  stageStyle?: StyleProp<ViewStyle>;
  /** Off for a step that lays its stage out to the screen (Welcome, Pick your finish). */
  scroll?: boolean;
  /** Replaces the grid ground (Welcome draws space, then the grid, D74). */
  ground?: ReactNode;
  /** How Continue arrives (Welcome holds it until the machine has landed); a new `actionKey` replays it. */
  actionEntering?: EntryOrExitLayoutType;
  actionKey?: string;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottom = Math.max(insets.bottom, space.inline);

  const heading = title ? (
    <View style={styles.heading}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.title, styles.center]}>
        {title}
      </Text>
      {sub ? (
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.sub, styles.center, styles.sub]}>
          {sub}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View testID={testID} style={styles.root}>
      <StatusBar style="light" />
      {ground ?? <GridGround />}
      <View style={[styles.bar, { marginTop: insets.top + space.related }]}>
        {back ? <RoundControl glyph="‹" accessibilityLabel="Back" onPress={() => router.back()} testID="onboarding-back" /> : null}
      </View>
      {scroll ? (
        <ScrollView
          style={styles.fill}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.stage, stageStyle]}>
          {heading}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, styles.stageFixed, stageStyle]}>
          {heading}
          {children}
        </View>
      )}
      {action ? (
        <KeyboardStickyView
          offset={{ closed: 0, opened: bottom - space.inline }}
          style={[styles.footer, { paddingBottom: bottom }]}>
          <Animated.View key={actionKey} entering={actionEntering}>
            <WidePill
              title={action.title}
              onPress={action.onPress}
              disabled={action.disabled}
              testID={action.testID ?? 'onboarding-continue'}
            />
          </Animated.View>
        </KeyboardStickyView>
      ) : null}
      {/* Onboarding's screens are drawn above the root toast (Import plan's `Copy your plan first`). */}
      <ToastHost />
    </View>
  );
}

/** A round sheet control (SPEC §6 Header): 40, `control` ground, ‹ or ✕. */
export function RoundControl({
  glyph,
  accessibilityLabel,
  onPress,
  testID,
}: {
  glyph: string;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={sheetGeometry.controlTop / 2}
      testID={testID}
      style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}>
      <Text maxFontSizeMultiplier={fontScaleCap.display} style={gadgetType.control}>
        {glyph}
      </Text>
    </Pressable>
  );
}

/** The light main pill at full width (PB1 `.cta`: 60 tall, r30). */
export function WidePill({
  title,
  onPress,
  disabled = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.pill, disabled && styles.pillDisabled, pressed && styles.pillPressed]}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={fontScaleCap.title}
        style={[gadgetType.pill, { color: sheetColors.pillLightInk }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  bar: {
    height: sheetGeometry.control,
    paddingHorizontal: onboardingGeometry.gutter,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heading: { paddingTop: onboardingGeometry.titleTop },
  center: { textAlign: 'center' },
  sub: { marginTop: onboardingGeometry.subTop },
  stage: {
    flexGrow: 1,
    paddingHorizontal: onboardingGeometry.gutter,
    paddingBottom: space.gutter,
  },
  stageFixed: { paddingHorizontal: onboardingGeometry.gutter },
  footer: {
    paddingHorizontal: onboardingGeometry.gutter,
    paddingTop: space.related,
  },
  control: {
    height: sheetGeometry.control,
    minWidth: sheetGeometry.control,
    paddingHorizontal: sheetGeometry.controlPadX,
    borderRadius: gadgetRadius.control,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPressed: { backgroundColor: sheetColors.cardRaised },
  pill: {
    height: onboardingGeometry.ctaHeight,
    borderRadius: onboardingGeometry.ctaHeight / 2,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.pillLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutter,
  },
  pillDisabled: { backgroundColor: sheetColors.pillDark },
  pillPressed: { transform: [{ scale: PRESS_SCALE }] },
});
