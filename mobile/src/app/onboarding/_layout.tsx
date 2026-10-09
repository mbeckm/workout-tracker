import { Stack } from 'expo-router/stack';
import { useReducedMotion } from 'react-native-reanimated';

import { momentColors } from '@/constants/theme';

/**
 * Onboarding is its own native stack on the dark grid ground (D12): every step is a push, so
 * Back and the edge swipe work between steps. The whole stack is replaced when onboarding
 * finishes. "Plan ready" is the insert on the device itself, after the stack is gone.
 */
export default function OnboardingLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'fade' : 'default',
        contentStyle: { backgroundColor: momentColors.ground },
      }}>
      <Stack.Screen name="index" options={{ title: 'Welcome', gestureEnabled: false }} />
      <Stack.Screen name="name" options={{ title: 'Name' }} />
      <Stack.Screen name="units" options={{ title: 'Units' }} />
      <Stack.Screen name="days" options={{ title: 'Days a week' }} />
      <Stack.Screen name="plan" options={{ title: 'Pick a plan' }} />
      <Stack.Screen name="finish" options={{ title: 'Pick your skin' }} />
    </Stack>
  );
}
