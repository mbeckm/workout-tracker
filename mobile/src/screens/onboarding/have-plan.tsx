import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { fontScaleCap, gadgetType, importGeometry, sheetColors, signal, space } from '@/constants/theme';
import { ImportDeviceCard, StarterDeviceCard } from '@/screens/plan-import/new-plan-cards';
import { haptics } from '@/device/haptics';
import { DURATION, softPress, softSelect } from '@/motion';

import { OnboardingFrame } from './frame';

type Answer = 'have' | 'pick' | 'own';

/**
 * Step 4 (decision 88): the fork. Someone with a plan in Notes, ChatGPT or another app imports it
 * and never sees Days a week (their plan decides it); everyone else picks a starter plan for their
 * days. Build my own, quieter, goes to Days and then an empty plan.
 */
export function OnboardingHavePlan() {
  const router = useRouter();
  const [answer, setAnswer] = useState<Answer>('have');
  const reduceMotion = useReducedMotion();
  const [ownPressed, setOwnPressed] = useState(false);
  const ownOn = answer === 'own';

  const pick = (next: Answer) => {
    if (next !== answer) {
      // The cards are little Trims: a pick taps a display, the soft blip, not the swatch's clack.
      haptics.displayTap();
      setAnswer(next);
    }
  };

  const next = () => {
    if (answer === 'have') router.push('/onboarding/import');
    else if (answer === 'own') router.push({ pathname: '/onboarding/days', params: { own: '1' } });
    else router.push('/onboarding/days');
  };

  return (
    <OnboardingFrame
      title="Got a plan?"
      scroll={false}
      action={{ title: 'Continue', onPress: next }}
      testID="onboarding-have-plan">
      <View accessibilityRole="radiogroup" accessibilityLabel="Got a plan?" style={styles.stage}>
        <View style={styles.fill}>
          <ImportDeviceCard
            title="I have one"
            sub="From a note, an AI chat or another app"
            selected={answer === 'have'}
            onPress={() => pick('have')}
            testID="onboarding-have-plan-yes"
          />
        </View>
        <View style={styles.fill}>
          <StarterDeviceCard selected={answer === 'pick'} onPress={() => pick('pick')} testID="onboarding-have-plan-pick" />
        </View>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: ownOn }}
          onPress={() => pick('own')}
          onPressIn={() => setOwnPressed(true)}
          onPressOut={() => setOwnPressed(false)}
          testID="onboarding-have-plan-own"
          style={styles.ownHit}>
          <Animated.View style={[styles.own, softPress(ownPressed && !ownOn, reduceMotion)]}>
            <Animated.View pointerEvents="none" style={[styles.ownFill, softSelect(ownOn)]} />
            <Animated.Text
              maxFontSizeMultiplier={fontScaleCap.title}
              style={[gadgetType.pill, { color: ownOn ? signal.orange : sheetColors.muted }, inkTransition]}>
              Build my own
            </Animated.Text>
          </Animated.View>
        </Pressable>
      </View>
    </OnboardingFrame>
  );
}

/** The pill's words cross over with its fill (softSelect). Outside StyleSheet.create, whose RN types don't know it. */
const inkTransition = {
  transitionProperty: 'color',
  transitionDuration: DURATION.enter,
} as const;

const styles = StyleSheet.create({
  stage: { flex: 1, gap: space.gutter, paddingTop: space.gutter, paddingBottom: space.related },
  fill: { flex: 1 },
  ownHit: { alignSelf: 'center' },
  own: {
    minHeight: importGeometry.choiceHeight,
    paddingHorizontal: space.gutter,
    borderRadius: importGeometry.choiceHeight / 2,
    justifyContent: 'center',
  },
  ownFill: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: importGeometry.choiceHeight / 2,
    backgroundColor: sheetColors.control,
  },
});
