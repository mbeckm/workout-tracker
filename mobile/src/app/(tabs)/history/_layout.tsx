import { Stack } from 'expo-router/stack';

import { useTheme } from '@/theme/theme-context';

export default function HistoryStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ animation: 'none', headerShown: false }}>
      {/* Native large title (trim-ui → Typography). Light and dark are JS-only, so the bar
          takes its ink from the theme instead of the system appearance. */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerLargeTitleEnabled: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerTintColor: colors.label,
          headerTitleStyle: { color: colors.label },
          headerLargeTitleStyle: { color: colors.label },
          title: 'History',
        }}
      />
    </Stack>
  );
}
