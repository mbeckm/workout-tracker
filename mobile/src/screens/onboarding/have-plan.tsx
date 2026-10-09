import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontScaleCap, gadgetType, importGeometry, sheetColors, signal, space } from '@/constants/theme';
import { ImportDeviceCard, StarterDeviceCard } from '@/screens/plan-import/new-plan-cards';
import { PRESS_SCALE } from '@/motion';

import { selectionTick } from './choice';
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

  const pick = (next: Answer) => {
    if (next !== answer) {
      selectionTick();
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
          accessibilityState={{ checked: answer === 'own' }}
          onPress={() => pick('own')}
          testID="onboarding-have-plan-own"
          style={({ pressed }) => [styles.own, answer === 'own' && styles.ownOn, pressed && styles.pressed]}>
          <Text
            maxFontSizeMultiplier={fontScaleCap.title}
            style={[gadgetType.pill, { color: answer === 'own' ? signal.orange : sheetColors.muted }]}>
            Build my own
          </Text>
        </Pressable>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, gap: space.gutter, paddingTop: space.gutter, paddingBottom: space.related },
  fill: { flex: 1 },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
  own: {
    alignSelf: 'center',
    minHeight: importGeometry.choiceHeight,
    paddingHorizontal: space.gutter,
    borderRadius: importGeometry.choiceHeight / 2,
    justifyContent: 'center',
  },
  ownOn: { backgroundColor: sheetColors.control },
});
