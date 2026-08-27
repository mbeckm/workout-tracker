import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

export default function NotFoundScreen() {
  const { colors, type } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.systemBackground,
          padding: spacing.lg,
          gap: spacing.md,
        }}>
        <Text style={type.headline}>This screen doesn’t exist.</Text>
        <Link href="/">
          <Text style={{ ...type.body, color: colors.systemBlue }}>Go to Workout</Text>
        </Link>
      </View>
    </>
  );
}
