import { Stack } from 'expo-router/stack';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-context';

/**
 * Onboarding is its own native stack: every step is a push, so Back and the edge
 * swipe work between steps. The whole stack is replaced when onboarding finishes.
 */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'fade' : 'default',
        contentStyle: { backgroundColor: colors.systemBackground },
      }}>
      <Stack.Screen name="index" options={{ title: 'Welcome', gestureEnabled: false }} />
      <Stack.Screen name="units" options={{ title: 'Units' }} />
      <Stack.Screen name="days" options={{ title: 'Days a week' }} />
      <Stack.Screen name="plan" options={{ title: 'Pick a plan' }} />
      <Stack.Screen name="ready" options={{ title: 'Plan ready' }} />
    </Stack>
  );
}
