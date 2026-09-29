import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { PaperRow } from '@/components/paper';
import { showToast } from '@/components/toast';
import { LEGAL_URLS } from '@/constants/legal';
import { formatMonthDay } from '@/domain/dates';
import { appearanceLabel, space, type AppearancePreference } from '@/constants/theme';
import { openPaywall } from '@/purchases/pro-gate';
import { PURCHASE_COPY, manageSubscription, restorePurchases } from '@/purchases/purchases';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/** Air between setting groups: preferences, Pro, links out, data. */
const GROUP_GAP = space.section;

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
    proRenewal,
    applyEntitlement,
    clearWorkoutHistory,
  } = useWorkoutStore();
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoringRef = useRef(false);

  const restore = async () => {
    if (restoringRef.current) {
      return;
    }
    restoringRef.current = true;
    setRestoring(true);
    setRestoreError(null);
    const result = await restorePurchases();
    restoringRef.current = false;
    setRestoring(false);
    // Rule 19: restore finishes in place with a toast. A failure stays on the row.
    if (result.kind === 'restored') {
      applyEntitlement(result.entitlement);
      showToast({ title: PURCHASE_COPY.restored });
    } else if (result.kind === 'none') {
      applyEntitlement(result.entitlement);
      showToast({ title: PURCHASE_COPY.none });
    } else {
      setRestoreError(result.message);
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
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentInsetAdjustmentBehavior="automatic"
        // Content shares the title's leading edge; the first row's text sits `section` under the
        // title (its own 16 padding counts), like every tab (trim-ui → Layout → Under a large title).
        contentContainerStyle={{
          paddingHorizontal: space.margin,
          paddingTop: space.inset,
          paddingBottom: space.section,
        }}>
        <View>
          <PaperRow
            title="Weight"
            symbol="scalemass"
            trailing={<Text style={[type.row, { color: colors.tertiaryLabel }]}>{units}</Text>}
            onPress={pickUnits}
          />
          <PaperRow
            title="Appearance"
            symbol="circle.lefthalf.filled"
            testID="settings-appearance"
            trailing={
              <Text style={[type.row, { color: colors.tertiaryLabel }]}>
                {appearanceLabel(appearance)}
              </Text>
            }
            onPress={pickAppearance}
          />
        </View>
        <View style={{ paddingTop: GROUP_GAP }}>
          <PaperRow
            title="Trim Pro"
            // The same lock the Pro-locked chips wear; it opens once Pro is on.
            symbol={isPro ? 'lock.open' : 'lock'}
            testID="settings-pro"
            trailing={
              <Text style={[type.row, { color: colors.tertiaryLabel }]}>
                {proStatusLabel(isPro, proRenewal)}
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
            symbol="arrow.clockwise"
            meta={restoreError ?? undefined}
            testID="settings-restore"
            onPress={restoring ? undefined : () => void restore()}
          />
        </View>
        {/* Rows that leave the app sit in their own group and carry the ↗ arrow. */}
        <View style={{ paddingTop: GROUP_GAP }}>
          <PaperRow
            link
            title="Contact support"
            symbol="envelope"
            testID="settings-support"
            onPress={contactSupport}
          />
          <PaperRow
            link
            title="Privacy Policy"
            symbol="hand.raised"
            onPress={() => openLegal(LEGAL_URLS.privacyPolicy)}
          />
          <PaperRow
            link
            title="Terms of Use"
            symbol="doc.text"
            onPress={() => openLegal(LEGAL_URLS.termsOfUse)}
          />
        </View>
        <View style={{ paddingTop: GROUP_GAP }}>
          <PaperRow
            title="Clear history"
            symbol="trash"
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
          style={[type.footnote, { color: colors.tertiaryLabel, paddingTop: space.gutter }]}
          selectable
          testID="settings-version">
          {versionLabel()}
        </Text>
      </ScrollView>
    </>
  );
}

/** `Off`, `On`, `On, renews Oct 3`, or `On until Oct 3` once renewal is off (trim-ui §13 Settings). */
function proStatusLabel(isPro: boolean, renewal: { expiresAt: string; willRenew: boolean } | null): string {
  if (!isPro) {
    return 'Off';
  }
  const ends = renewal ? new Date(renewal.expiresAt) : null;
  if (!ends || Number.isNaN(ends.getTime())) {
    return 'On';
  }
  const date = formatMonthDay(ends);
  return renewal?.willRenew ? `On, renews ${date}` : `On until ${date}`;
}
