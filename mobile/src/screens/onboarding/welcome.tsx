import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { deviceObject, fontScaleCap, onboardingGeometry, onboardingType, space } from '@/constants/theme';
import { DeviceObject, deviceObjectScale } from '@/device/device-object';
import { EmptySlot } from '@/device/home/home-display';
import { DEVICE, EASE_DISPLAY_FN, enterUp } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { OnboardingFrame } from './frame';
import { localeUnits } from './locale-units';

/** The device arrives first, then the words under it. */
const DEVICE_DELAY = 150;
const WORDS_DELAY = DEVICE_DELAY + DEVICE.INSERT_SCENE / 2;

/**
 * Step 1 (D12, trim-ui §12 Moments, First open): the device fades in over the dark grid, its
 * slot empty and waiting for a plan, then the name and what Trim is. No Skip: the only way out of
 * onboarding is with a plan.
 */
export function OnboardingWelcome() {
  const router = useRouter();
  const reduceMotion = Boolean(useReducedMotion());
  const { width, height } = useWindowDimensions();
  const { setUnits } = useWorkoutStore();
  const units = localeUnits();

  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withDelay(DEVICE_DELAY, withTiming(1, { duration: DEVICE.INSERT_SCENE, easing: EASE_DISPLAY_FN })));
  }, [shown]);
  const deviceStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: reduceMotion ? 0 : (1 - shown.get()) * deviceObject.rise }],
  }));

  const scale = deviceObjectScale(
    width - onboardingGeometry.gutter * 2,
    height * onboardingGeometry.welcomeDeviceShare,
  );

  const next = () => {
    // Preset from the device locale and persist now; the Units step confirms or changes it.
    setUnits(units);
    router.push('/onboarding/name');
  };

  return (
    <OnboardingFrame back={false} scroll={false} action={{ title: 'Continue', onPress: next }} testID="onboarding-welcome">
      <View style={styles.stage}>
        <Animated.View style={deviceStyle}>
          <DeviceObject
            scale={scale}
            displayKey="empty"
            display={<EmptySlot />}
            wheelLabel={units === 'lbs' ? 'LB' : 'KG'}
            accessibilityLabel="Trim, with no plan in it yet"
          />
        </Animated.View>
      </View>
      <Animated.View entering={enterUp(reduceMotion, WORDS_DELAY)} style={styles.words}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap.display} style={[onboardingType.hero, styles.center]}>
          Trim
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.sub, styles.center]}>
          A plan. Then the gym.
        </Text>
      </Animated.View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  words: { gap: space.tight, paddingBottom: space.gutter },
  center: { textAlign: 'center' },
});
