import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { device, finishColors, gadgetType, signal, space } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import { commandFromParams } from '@/device/device-state';
import { useFinish } from '@/device/finish';
import { useAppFonts } from '@/device/fonts';
import { HomeDisplay } from '@/device/home/home-display';
import { useHome } from '@/device/home/use-home';
import type { HomeModel } from '@/device/home-model';
import { REFERENCE_WIDTH, fromReferenceTop } from '@/device/layout';
import { MomentHost } from '@/device/moment/moment-host';
import {
  BigKey,
  DeviceBody,
  Display,
  EngravedLabel,
  HistoryGlyph,
  MenuGlyph,
  Rocker,
  RoundKey,
  Well,
  Wheel,
} from '@/device/parts';
import { SheetHost } from '@/device/sheets';

/** The gap between the top row and the display, and between the display and the bottom row (SPEC §4: 140 − 112, 588 − 560). */
const ROW_GAP = device.displayY - device.topRowY - device.keySize;
/** The bottom row, from the wheel's top to under its label (SPEC §4: y588 to ~786). */
const BOTTOM_ROW = device.wheelHeight + device.labelGap + gadgetType.engraved.lineHeight;
/** Bottom-row parts, offset from the wheel's top (SPEC §4: well y590, big key y600, tall keys y592 / y680). */
const WELL_Y = 2;
/** The wheel and the tall keys sit 2pt inside the margin (SPEC §4: x22 against the 20 edge). */
const KEY_INSET = 2;
const BIG_KEY_Y = WELL_Y + (device.wellSize - device.bigKeySize) / 2;
/** Screens 812pt or taller keep the display at least this tall; smaller ones let it shrink (~296 on SE). */
const TALL_SCREEN = 812;
const DISPLAY_MIN = 360;

const NO_LIFT = () => false as const;

/**
 * The device (PLAN Phase 2): the whole app's home screen. Laid out with flex and safe areas
 * from SPEC §4's reference: the top row under the safe area, the display taking what's left,
 * the bottom row above the home indicator. Keys never shrink; on big phones the margins grow
 * and the display takes the extra height. SheetHost sits above it, in the same view tree.
 */
export function DeviceScreen() {
  const fontsReady = useAppFonts();
  const { finish } = useFinish();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { openSheet } = useDevice();
  const home = useHome();
  useDeviceParams();

  if (!fontsReady) {
    return null;
  }

  // Margins scale with the width (Pro Max); the keys keep their size.
  const edge = Math.round(device.edge * Math.max(1, width / REFERENCE_WIDTH));
  const hasHomeIndicator = insets.bottom > 0;
  const bottomPad = hasHomeIndicator
    ? Math.max(insets.bottom, device.bottomClearance) + space.gutter
    : device.bottomClearanceCompact + space.inset;

  const topRowY = fromReferenceTop(device.topRowY, insets.top);

  return (
    <View style={styles.root}>
      <StatusBar style={finishColors[finish].statusBar} />
      <DeviceBody>
        {/*
          VoiceOver groups every view's children and reads siblings top-left first, so the
          History key sits outside this column (drawn over its top-right slot): the order is
          menu, the week, the rows, Start, then History (PLAN Phase 3).
        */}
        <View style={[styles.column, { paddingTop: topRowY, paddingBottom: bottomPad }]}>
          <View style={[styles.topRow, { paddingHorizontal: edge }]}>
            <RoundKey accessibilityLabel="Menu" onPress={() => openSheet('menu')}>
              <MenuGlyph />
            </RoundKey>
            <WeekRocker model={home.model} />
            <View style={styles.keySlot} />
          </View>

          <Display
            contentKey={home.model.kind}
            style={[
              styles.display,
              { marginHorizontal: edge, minHeight: height >= TALL_SCREEN ? DISPLAY_MIN : undefined },
            ]}>
            <HomeDisplay model={home.model} celebrateDayId={home.celebrateDayId} onPick={home.pickDay} />
          </Display>

          <View style={styles.bottomRow}>
            <View style={[styles.centered, { top: WELL_Y }]}>
              <Well />
            </View>
            <View style={[styles.centered, { top: BIG_KEY_Y }]}>
              <BigKey
                label={home.startLabel}
                variant={home.model.kind === 'empty' ? 'metal' : 'primary'}
                accessibilityLabel={home.startAccessibilityLabel}
                onPress={home.start}
              />
            </View>
            <Wheel
              stowed
              accessibilityLabel="Weight"
              onNotch={NO_LIFT}
              style={[styles.wheel, { right: edge + KEY_INSET }]}
            />
          </View>
        </View>
        <RoundKey
          accessibilityLabel="History"
          onPress={() => openSheet('history')}
          style={[styles.historyKey, { top: topRowY, right: edge }]}>
          <HistoryGlyph />
        </RoundKey>
      </DeviceBody>
      <SheetHost />
      <MomentHost />
    </View>
  );
}

/**
 * `/` takes device commands as search params (`?sheet=settings`, `?log=1&planId&dayId`), so
 * deep links and old routes can reach into the device. Each command runs once, then the params
 * are cleared so the same link works again.
 */
function useDeviceParams() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const router = useRouter();
  const { open } = useDevice();
  const command = commandFromParams(params);
  const signature = command ? JSON.stringify(command) : null;

  useEffect(() => {
    if (!command) {
      return;
    }
    open(command);
    const cleared: Record<string, undefined> = {};
    for (const key of Object.keys(params)) {
      cleared[key] = undefined;
    }
    router.setParams(cleared);
    // `signature` stands for `command` and `params`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

/**
 * The week in the rocker body (W1): one lamp per trainable day, green in the order trained, the
 * next one orange; `WEEK n` engraved under it, with `▲n` in orange once the streak counts (D20).
 */
function WeekRocker({ model }: { model: HomeModel }) {
  const week = model.kind === 'plan' ? model.week : null;
  return (
    <View
      accessible
      accessibilityLabel={week ? week.accessibilityLabel : 'No plan'}
      style={styles.rocker}>
      <Rocker
        variant="week"
        lamps={week?.lamps ?? []}
        litIndex={week?.litIndex ?? undefined}
        accessibilityLabel=""
      />
      {week ? (
        <EngravedLabel
          accent={week.streak ? { text: week.streak, color: signal.orange } : undefined}
          style={styles.rockerLabel}>
          {week.label}
        </EngravedLabel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1 },
  topRow: {
    height: device.keySize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  display: { flex: 1, marginVertical: ROW_GAP },
  bottomRow: { height: BOTTOM_ROW },
  centered: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wheel: { position: 'absolute', top: 0 },
  keySlot: { width: device.keySize, height: device.keySize },
  historyKey: { position: 'absolute' },
  rocker: { width: device.rockerWidth, height: device.rockerHeight },
  rockerLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: device.rockerHeight + device.labelGap,
  },
});
