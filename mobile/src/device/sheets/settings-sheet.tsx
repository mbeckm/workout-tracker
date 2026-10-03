import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { showToast } from '@/components/toast';
import { LEGAL_URLS } from '@/constants/legal';
import {
  deviceColors,
  fontScaleCap,
  gadgetType,
  sheetColors,
  sheetGeometry,
  signal,
  space,
} from '@/constants/theme';
import { formatMonthDay } from '@/domain/dates';
import { useDevice } from '@/device/device-context';
import { openPaywall } from '@/purchases/pro-gate';
import { PURCHASE_COPY, manageSubscription, restorePurchases } from '@/purchases/purchases';
import { useWorkoutStore } from '@/store/workout-store';

import { SheetCard, SheetHeader, SheetRow, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

const SUPPORT_EMAIL = 'marvinbeckm@gmail.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Trim%20support`;

/** `Trim 1.0.0 (42)`: marketing version plus the native build (CFBundleVersion) when known. */
function versionLabel(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Constants.platform?.ios?.buildNumber ?? Constants.expoConfig?.ios?.buildNumber;
  return build ? `Trim ${version} (${build})` : `Trim ${version}`;
}

/** `Off`, `On`, `On, renews Oct 3`, or `On until Oct 3` once renewal is off. */
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

/**
 * Settings (D1): every action from the old Settings tab, in the dark sheet. No Appearance row
 * (D2): the device's look is the finish. The name edits in place, above the keyboard.
 */
export function SettingsSheet({ fromMenu }: { fromMenu: boolean }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const {
    userName,
    setUserName,
    units,
    setUnits,
    soundsOn,
    setSoundsOn,
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
    // Restore finishes in place with a toast. A failure stays on the row.
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

  const clearHistory = () =>
    Alert.alert('Clear history?', 'This deletes every completed workout on this iPhone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearWorkoutHistory() },
    ]);

  return (
    <SheetScroll
      header={
        <SheetHeader
          title="Settings"
          left={fromMenu ? { kind: 'back', onPress: () => swapSheet('menu') } : undefined}
          right={{ kind: 'close', onPress: close }}
        />
      }>
      <SheetCard>
        <NameRow key={userName} name={userName} onSave={setUserName} />
        <SheetRow size="compact" title="Weight units" trailing={units} onPress={pickUnits} />
        {/* The whole row flips the switch. A quick tap straight on the UISwitch (under ~150 ms) was
            lost inside the sheet's pan, so the row's Pressable takes every touch; VoiceOver still
            reaches the switch itself. */}
        <SheetRow
          size="compact"
          title="Sounds"
          onPress={() => setSoundsOn(!soundsOn)}
          accessory={
            <View pointerEvents="none">
              <Switch
                value={soundsOn}
                onValueChange={setSoundsOn}
                accessibilityLabel="Sounds"
                trackColor={{ true: signal.orange, false: sheetColors.track }}
                thumbColor={deviceColors.key1}
                ios_backgroundColor={sheetColors.track}
                testID="settings-sounds"
              />
            </View>
          }
        />
      </SheetCard>
      <SheetCard>
        <SheetRow
          size="compact"
          title="Trim Pro"
          trailing={proStatusLabel(isPro, proRenewal)}
          testID="settings-pro"
          onPress={
            !isPro
              ? () => void openPaywall('settings')
              : proPeriod === 'lifetime'
                ? undefined
                : () => void manageSubscription()
          }
        />
        <SheetRow
          size="compact"
          title={restoring ? 'Restoring…' : 'Restore purchases'}
          sub={restoreError ?? undefined}
          testID="settings-restore"
          onPress={restoring ? undefined : () => void restore()}
        />
      </SheetCard>
      <SheetCard>
        <SheetRow size="compact" title="Contact support" trailing="↗" accessibilityLabel="Contact support" testID="settings-support" onPress={contactSupport} />
        <SheetRow size="compact" title="Privacy Policy" trailing="↗" accessibilityLabel="Privacy Policy" onPress={() => openLegal(LEGAL_URLS.privacyPolicy)} />
        <SheetRow size="compact" title="Terms of Use" trailing="↗" accessibilityLabel="Terms of Use" onPress={() => openLegal(LEGAL_URLS.termsOfUse)} />
      </SheetCard>
      <SheetCard>
        <SheetRow size="compact" title="Clear history" destructive onPress={clearHistory} />
      </SheetCard>
      <Text
        selectable
        testID="settings-version"
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[gadgetType.rowSub, styles.version]}>
        {versionLabel()}
      </Text>
    </SheetScroll>
  );
}

/** The name, edited in place; an empty field clears it. Saves on Return and on leaving the field. */
function NameRow({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  // Keyed by the saved name (below), so a change from elsewhere starts a fresh draft.
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<TextInput>(null);

  const save = () => {
    const next = draft.trim();
    if (next !== name) {
      onSave(next);
    }
  };

  return (
    <SheetRow
      size="compact"
      title="Name"
      onPress={() => inputRef.current?.focus()}
      accessory={
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          onEndEditing={save}
          onSubmitEditing={save}
          returnKeyType="done"
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="givenName"
          keyboardAppearance="dark"
          selectionColor={signal.orange}
          placeholder="None"
          placeholderTextColor={sheetColors.muted}
          accessibilityLabel="Name"
          maxFontSizeMultiplier={fontScaleCap.text}
          testID="settings-name"
          style={styles.nameInput}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  nameInput: {
    // No lineHeight on a TextInput (AGENTS.md): a fixed height keeps the placeholder in place.
    fontFamily: gadgetType.rowSub.fontFamily,
    fontSize: gadgetType.rowSub.fontSize,
    fontWeight: gadgetType.rowSub.fontWeight,
    color: sheetColors.ink,
    height: sheetGeometry.control,
    minWidth: sheetGeometry.swatchW,
    flexShrink: 1,
    textAlign: 'right',
  },
  version: { textAlign: 'center', paddingTop: space.inline },
});
