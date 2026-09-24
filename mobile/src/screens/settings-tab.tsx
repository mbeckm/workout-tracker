import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { PaperRow, PaperScreen } from '@/components/paper';
import { LEGAL_URLS } from '@/constants/legal';
import { appearanceLabel, type AppearancePreference } from '@/constants/theme';
import { openPaywall } from '@/purchases/pro-gate';
import {
  PURCHASE_COPY,
  manageSubscription,
  proPeriodLabel,
  restorePurchases,
} from '@/purchases/purchases';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

const SUPPORT_EMAIL = 'marvinbeckm@gmail.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Trim%20support`;

/** `Trim 1.0.0 (42)`: marketing version plus the native build (CFBundleVersion) when known. */
function versionLabel(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Constants.platform?.ios?.buildNumber ?? Constants.expoConfig?.ios?.buildNumber;
  return build ? `Trim ${version} (${build})` : `Trim ${version}`;
}

export function SettingsTab() {
  const { colors, type } = useTheme();
  const {
    units,
    setUnits,
    appearance,
    setAppearance,
    isPro,
    proPeriod,
    applyEntitlement,
    clearWorkoutHistory,
  } = useWorkoutStore();
  const [restoring, setRestoring] = useState(false);
  const restoringRef = useRef(false);

  const restore = async () => {
    if (restoringRef.current) {
      return;
    }
    restoringRef.current = true;
    setRestoring(true);
    const result = await restorePurchases();
    restoringRef.current = false;
    setRestoring(false);
    if (result.kind === 'restored') {
      applyEntitlement(result.entitlement);
      Alert.alert(PURCHASE_COPY.restoredTitle, PURCHASE_COPY.restoredBody);
    } else if (result.kind === 'none') {
      applyEntitlement(result.entitlement);
      Alert.alert(PURCHASE_COPY.noneTitle, PURCHASE_COPY.noneBody);
    } else {
      Alert.alert(PURCHASE_COPY.restoreFailedTitle, result.message);
    }
  };

  const openLegal = (url: string) => {
    void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
  };

  const contactSupport = () => {
    // No Mail account on the device: show the address so it can still be copied.
    void Linking.openURL(SUPPORT_MAILTO).catch(() =>
      Alert.alert('Contact support', `Write to ${SUPPORT_EMAIL}.`),
    );
  };

  const pickUnits = () => {
    // Switching relabels; it does not convert what was logged.
    Alert.alert('Weight', 'Past workouts keep their numbers.', [
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
              <Text style={[type.row, { color: colors.tertiaryLabel }]}>
                {isPro ? (proPeriod ? `On · ${proPeriodLabel(proPeriod)}` : 'On') : 'Off'}
              </Text>
            }
            onPress={
              !isPro
                ? () => void openPaywall('settings')
                : proPeriod === 'lifetime'
                  ? undefined
                  : () => void manageSubscription()
            }
          />
          <PaperRow
            title={restoring ? 'Restoring…' : 'Restore purchases'}
            testID="settings-restore"
            onPress={restoring ? undefined : () => void restore()}
          />
          <PaperRow title="Contact support" testID="settings-support" onPress={contactSupport} />
          <PaperRow title="Privacy Policy" onPress={() => openLegal(LEGAL_URLS.privacyPolicy)} />
          <PaperRow title="Terms of Use" onPress={() => openLegal(LEGAL_URLS.termsOfUse)} />
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
        <Text
          style={[type.caption, { color: colors.tertiaryLabel, fontWeight: '400', paddingTop: 24 }]}
          selectable
          testID="settings-version">
          {versionLabel()}
        </Text>
      </PaperScreen>
      <Stack.Screen options={{ headerShown: false, title: 'Settings' }} />
    </>
  );
}
