import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PaperLink } from '@/components/paper';
import { enterUp, exitFade } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

export function OnboardingScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { units, setUnits, completeOnboarding } = useWorkoutStore();
  const [step, setStep] = useState<0 | 1>(0);

  const finish = () => {
    completeOnboarding();
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 12),
        }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 12 }}>
          <Animated.View
            key={step}
            entering={enterUp(Boolean(reduceMotion))}
            exiting={exitFade(Boolean(reduceMotion))}
            style={{ gap: 10 }}>
            {step === 0 ? (
              <>
                <Text style={type.hero}>Trim</Text>
                <Text style={type.lede}>A plan. Then the gym.</Text>
              </>
            ) : (
              <>
                <Pressable onPress={() => setUnits('kg')} accessibilityRole="button">
                  <Text style={units === 'kg' ? type.hero : [type.row, { color: colors.tertiaryLabel }]}>
                    kg
                  </Text>
                </Pressable>
                <Pressable onPress={() => setUnits('lbs')} accessibilityRole="button">
                  <Text style={units === 'lbs' ? type.hero : [type.row, { color: colors.tertiaryLabel }]}>
                    lbs
                  </Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </View>
        <Button
          title="Continue"
          variant="black"
          onPress={step === 0 ? () => setStep(1) : finish}
        />
        {step === 0 ? <PaperLink title="Skip" onPress={finish} /> : null}
      </View>
    </>
  );
}
