import { Stack } from 'expo-router/stack';

import { largeTitleOptions } from '@/navigation/large-title';
import { useTheme } from '@/theme/theme-context';

export default function HistoryStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ animation: 'none', headerShown: false }}>
      <Stack.Screen name="index" options={largeTitleOptions(colors, 'History')} />
    </Stack>
  );
}
