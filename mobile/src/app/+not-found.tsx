import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { gadgetType, sheetColors, signal, space } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: sheetColors.sheet,
          padding: space.gutter,
          gap: space.inset,
        }}>
        <Text style={gadgetType.sheetTitle}>This screen doesn’t exist.</Text>
        <Link href="/">
          <Text style={[gadgetType.rowTitle, { color: signal.orange }]}>Back to Trim</Text>
        </Link>
      </View>
    </>
  );
}
