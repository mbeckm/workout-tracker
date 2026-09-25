import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { enterUp } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

import { OnboardingFrame } from './frame';
import { localeUnits } from './locale-units';

/** Step 1: what Trim is. No Skip: the only way out of onboarding is with a plan. */
export function OnboardingWelcome() {
  const { type } = useTheme();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { setUnits } = useWorkoutStore();

  const next = () => {
    // Preset from the device locale and persist now; the Units step confirms or changes it.
    setUnits(localeUnits());
    router.push('/onboarding/units');
  };

  return (
    <OnboardingFrame back={false} centered action={{ title: 'Continue', onPress: next }} testID="onboarding-welcome">
      <Animated.View entering={enterUp(Boolean(reduceMotion))} style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={type.hero} maxFontSizeMultiplier={1.2}>
          Trim
        </Text>
        <Text style={type.lede}>A plan. Then the gym.</Text>
      </Animated.View>
    </OnboardingFrame>
  );
}
