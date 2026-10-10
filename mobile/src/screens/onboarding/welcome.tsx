import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { deviceObject, fontScaleCap, onboardingGeometry, onboardingType, space } from '@/constants/theme';
import { DEVICE_OBJECT_HEIGHT, DeviceObject, deviceObjectScale } from '@/device/device-object';
import { useHaptics, useSounds } from '@/device/haptics';
import { EmptySlot } from '@/device/home/home-display';
import { ASSEMBLY, DEVICE, EASE_DISPLAY_FN, enterUp } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { AssemblyGround, BootingSlot, RimLight, useAssembly } from './assembly';
import { OnboardingFrame } from './frame';
import { localeUnits } from './locale-units';

/**
 * Step 1, first open (D74, trim-ui §12 Moments): the machine is born. It floats in out of space,
 * assembles itself on a quickening beat and comes alive with a bang; the grid floor lights, and
 * then `Trim`, what it is, and Continue. A tap skips to the end. Reduce Motion: the device fades
 * in whole, with the bang's haptic and sound. No Skip of onboarding itself: the only way out is
 * with a plan.
 */
export function OnboardingWelcome() {
  const router = useRouter();
  const reduceMotion = Boolean(useReducedMotion());
  const { width, height } = useWindowDimensions();
  const { setUnits } = useWorkoutStore();
  const units = localeUnits();
  const haptics = useHaptics();
  const sound = useSounds();

  const scene = useAssembly(!reduceMotion);

  // Reduce Motion: no assembly; the device fades in and the bang still lands.
  const shown = useSharedValue(reduceMotion ? 0 : 1);
  useEffect(() => {
    if (!reduceMotion) return undefined;
    shown.set(withTiming(1, { duration: DEVICE.REDUCED_FADE, easing: EASE_DISPLAY_FN }));
    const bang = setTimeout(() => {
      haptics.assemblyBang();
      sound('bang');
    }, DEVICE.REDUCED_FADE);
    return () => clearTimeout(bang);
    // Once, on the first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));

  const scale = deviceObjectScale(
    width - onboardingGeometry.gutter * 2,
    height * onboardingGeometry.welcomeDeviceShare,
  );

  const next = () => {
    // Preset from the device locale and persist now; the Units step confirms or changes it.
    setUnits(units);
    router.push('/onboarding/name');
  };

  // Continue and the words wait for the machine; after a skip they come straight away.
  const holding = !reduceMotion && !scene.skipped;
  const replay = scene.skipped ? 'skipped' : 'scene';

  return (
    <View style={styles.root}>
      <OnboardingFrame
        back={false}
        scroll={false}
        ground={<AssemblyGround clock={scene.clock} playing={scene.playing} />}
        actionEntering={enterUp(reduceMotion, holding ? ASSEMBLY.ACTION_AT : 0)}
        actionKey={replay}
        action={{ title: 'Continue', onPress: next }}
        testID="onboarding-welcome">
        <Animated.View style={[styles.fill, scene.stage]}>
          <View style={styles.stage}>
            <Animated.View style={reduceMotion ? fadeStyle : null}>
              {reduceMotion ? null : (
                <RimLight clock={scene.clock} width={deviceObject.width * scale} height={DEVICE_OBJECT_HEIGHT * scale} />
              )}
              <DeviceObject
                scale={scale}
                displayKey="empty"
                display={reduceMotion ? <EmptySlot /> : <BootingSlot clock={scene.clock} />}
                assembly={reduceMotion ? undefined : scene.assembly}
                bigKeyVariant="metal"
                accessibilityLabel="Trim, with no plan in it yet"
              />
            </Animated.View>
          </View>
          <Animated.View key={replay} entering={enterUp(reduceMotion, holding ? ASSEMBLY.WORDS_AT : 0)} style={styles.words}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap.display} style={[onboardingType.hero, styles.center]}>
              Trim
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.sub, styles.center]}>
              A workout machine.
            </Text>
          </Animated.View>
        </Animated.View>
      </OnboardingFrame>
      {scene.playing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          onPress={scene.skip}
          style={StyleSheet.absoluteFill}
          testID="onboarding-welcome-skip"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  words: { gap: space.tight, paddingBottom: space.gutter },
  center: { textAlign: 'center' },
});
