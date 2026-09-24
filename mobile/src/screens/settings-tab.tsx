import { Stack } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { PaperRow, PaperScreen } from '@/components/paper';
import { appearanceLabel, type AppearancePreference } from '@/constants/theme';
import { openPaywall } from '@/purchases/pro-gate';
import { restorePurchases } from '@/purchases/purchases';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

export function SettingsTab() {
  const { colors, type } = useTheme();
  const { units, setUnits, appearance, setAppearance, isPro, applyEntitlement, clearWorkoutHistory } =
    useWorkoutStore();

  const pickUnits = () => {
    Alert.alert('Weight', undefined, [
      { text: 'Kilograms', onPress: () => setUnits('kg') },
      { text: 'Pounds', onPress: () => setUnits('lbs') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickAppearance = () => {
    const choose = (value: AppearancePreference) => () => setAppearance(value);
    Alert.alert('Appearance', undefined, [
      { text: 'System', onPress: choose('system') },
      { text: 'Light', onPress: choose('light') },
      { text: 'Dark', onPress: choose('dark') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <>
      <PaperScreen>
        <Text style={type.planTitle}>Settings</Text>
        <View style={{ paddingTop: 32 }}>
          <PaperRow
            title="Weight"
            trailing={<Text style={[type.row, { color: colors.tertiaryLabel }]}>{units}</Text>}
            onPress={pickUnits}
          />
          <PaperRow
            title="Appearance"
            testID="settings-appearance"
            trailing={
              <Text style={[type.row, { color: colors.tertiaryLabel }]}>
                {appearanceLabel(appearance)}
              </Text>
            }
            onPress={pickAppearance}
          />
          <PaperRow
            title="Trim Pro"
            testID="settings-pro"
            trailing={
              <Text style={[type.row, { color: colors.tertiaryLabel }]}>{isPro ? 'On' : 'Off'}</Text>
            }
            onPress={() => void openPaywall('settings')}
          />
          <PaperRow
            title="Restore purchases"
            onPress={async () => {
              const result = await restorePurchases();
              if (result.kind !== 'error') {
                applyEntitlement(result.entitlement);
              }
            }}
          />
          <PaperRow
            title="Clear history"
            destructive
            onPress={() =>
              Alert.alert(
                'Clear history?',
                'This deletes every completed workout on this iPhone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => clearWorkoutHistory(),
                  },
                ],
              )
            }
          />
        </View>
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: 'Settings' }} />
    </>
  );
}
