import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PaperLink } from '@/components/paper';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

export function OnboardingScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        {step === 0 ? (
          <>
            <View style={{ flex: 1, justifyContent: 'center', gap: 10, paddingBottom: 12 }}>
              <Text style={type.hero}>Trim</Text>
              <Text style={type.lede}>A plan. Then the gym.</Text>
            </View>
            <Button title="Continue" variant="black" onPress={() => setStep(1)} />
            <PaperLink title="Skip" onPress={finish} />
          </>
        ) : (
          <>
            <View style={{ flex: 1, justifyContent: 'center', gap: 10, paddingBottom: 12 }}>
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
            </View>
            <Button title="Continue" variant="black" onPress={finish} />
          </>
        )}
      </View>
    </>
  );
}
