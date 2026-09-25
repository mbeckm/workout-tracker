import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { STARTER_DAY_COUNTS, type StarterDayCount } from '@/catalog/templates';
import { enterUp, exitFade } from '@/motion';
import { useTheme } from '@/theme/theme-context';

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

/** Step 3: the weekly target, which picks the split. */
export function OnboardingDays() {
  const { colors, type } = useTheme();
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
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Days a week"
        style={{ flexDirection: 'row', paddingTop: 28 }}>
        {STARTER_DAY_COUNTS.map((count) => (
          <BigChoice
            key={count}
            label={String(count)}
            accessibilityLabel={`${count} days a week`}
            selected={days === count}
            onSelect={() => setDays(count)}
            fixedHeight
            style={{ flex: 1, alignItems: 'flex-start' }}
            testID={`onboarding-days-${count}`}
          />
        ))}
      </View>
      {/* The invisible copy sizes the line; the visible one crossfades on top so nothing jumps. */}
      <View style={{ marginTop: 20 }}>
        <Text
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          style={[type.kicker, { opacity: 0 }]}>
          {DAYS_FACT[days]}
        </Text>
        <Animated.View
          key={days}
          entering={enterUp(reduceMotion)}
          exiting={exitFade(reduceMotion)}
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{DAYS_FACT[days]}</Text>
        </Animated.View>
      </View>
    </OnboardingFrame>
  );
}
