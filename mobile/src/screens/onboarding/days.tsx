import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { STARTER_DAY_COUNTS, type StarterDayCount } from '@/catalog/templates';
import { fontScaleCap, onboardingType, space } from '@/constants/theme';
import { Rocker, type LampState } from '@/device/parts';
import { enterUp, exitFade } from '@/motion';

import { BigChoice } from './choice';
import { OnboardingFrame } from './frame';

/** What each weekly count gets you. Facts about the split, not encouragement. */
const DAYS_FACT: Record<StarterDayCount, string> = {
  2: 'Full body, two different days.',
  3: 'Full body, or push, pull and legs.',
  4: 'Upper and lower body, twice each.',
  5: 'Upper, lower, push, pull and legs.',
  6: 'Push, pull and legs, twice each.',
};

const lit = (count: number): LampState[] => Array.from({ length: count }, () => 'on' as const);

/**
 * Step 4: the weekly target, which picks the split. The rocker above the numbers is the device's
 * own week: one lamp per training day, lit as the count changes.
 */
export function OnboardingDays() {
  const router = useRouter();
  const reduceMotion = Boolean(useReducedMotion());
  const [days, setDays] = useState<StarterDayCount>(3);

  return (
    <OnboardingFrame
      title="Days a week"
      action={{
        title: 'Continue',
        onPress: () => router.push({ pathname: '/onboarding/plan', params: { days: String(days) } }),
      }}
      testID="onboarding-days">
      <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Rocker variant="week" lamps={lit(days)} accessibilityLabel="" />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Days a week" style={styles.row}>
        {STARTER_DAY_COUNTS.map((count) => (
          <BigChoice
            key={count}
            label={String(count)}
            accessibilityLabel={`${count} days a week`}
            selected={days === count}
            onSelect={() => setDays(count)}
            style={styles.cell}
            testID={`onboarding-days-${count}`}
          />
        ))}
      </View>
      {/* The invisible copy sizes the line; the visible one crossfades on top so nothing jumps. */}
      <View style={styles.factSlot}>
        <Text
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[onboardingType.sub, styles.center, styles.hidden]}>
          {DAYS_FACT[days]}
        </Text>
        <Animated.View
          key={days}
          entering={enterUp(reduceMotion)}
          exiting={exitFade(reduceMotion)}
          accessibilityLiveRegion="polite"
          style={styles.fact}>
          <Text maxFontSizeMultiplier={fontScaleCap.text} style={[onboardingType.sub, styles.center]}>
            {DAYS_FACT[days]}
          </Text>
        </Animated.View>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  week: { alignItems: 'center', paddingTop: space.section },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: space.gutter },
  cell: { flex: 1 },
  factSlot: { marginTop: space.gutter },
  fact: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { textAlign: 'center' },
  hidden: { opacity: 0 },
});
