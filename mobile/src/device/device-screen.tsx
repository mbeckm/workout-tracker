import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { device, finishColors, gadgetType, lcd, space } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import { commandFromParams } from '@/device/device-state';
import { useFinish } from '@/device/finish';
import { useAppFonts } from '@/device/fonts';
import { REFERENCE_WIDTH, fromReferenceTop } from '@/device/layout';
import {
  BigKey,
  DeviceBody,
  Display,
  HistoryGlyph,
  MenuGlyph,
  Rocker,
  RoundKey,
  Well,
  Wheel,
  type LampState,
} from '@/device/parts';
import { SheetHost } from '@/device/sheets';
import { useWorkoutStore } from '@/store/workout-store';

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

  return (
    <View style={styles.root}>
      <StatusBar style={finishColors[finish].statusBar} />
      <DeviceBody>
        <View
          style={[
            styles.column,
            { paddingTop: fromReferenceTop(device.topRowY, insets.top), paddingBottom: bottomPad },
          ]}>
          <View style={[styles.topRow, { paddingHorizontal: edge }]}>
            <RoundKey accessibilityLabel="Menu" onPress={() => openSheet('menu')}>
              <MenuGlyph />
            </RoundKey>
            <WeekRocker />
            <RoundKey accessibilityLabel="History" onPress={() => openSheet('history')}>
              <HistoryGlyph />
            </RoundKey>
          </View>

          <Display
            contentKey="home"
            style={[
              styles.display,
              { marginHorizontal: edge, minHeight: height >= TALL_SCREEN ? DISPLAY_MIN : undefined },
            ]}>
            <HomePlaceholder />
          </Display>

          <View style={styles.bottomRow}>
            <View style={[styles.centered, { top: WELL_Y }]}>
              <Well />
            </View>
            <View style={[styles.centered, { top: BIG_KEY_Y }]}>
              {/* Start lands in Phase 3 (Home picks the day). */}
              <BigKey label="Start" />
            </View>
            <Wheel
              stowed
              accessibilityLabel="Weight"
              onNotch={NO_LIFT}
              style={[styles.wheel, { right: edge + KEY_INSET }]}
            />
          </View>
        </View>
      </DeviceBody>
      <SheetHost />
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

/** The week in the rocker body (W1): done days green, the next day orange. Phase 3 refines it. */
function WeekRocker() {
  const { activePlan, completedDayIds, nextDayIndex } = useWorkoutStore();
  const days = activePlan?.days ?? [];
  const lamps: LampState[] = days.map((day, index) =>
    completedDayIds.includes(day.id) ? 'done' : index === nextDayIndex ? 'on' : 'off',
  );
  const done = lamps.filter((lamp) => lamp === 'done').length;
  // TODO(Phase 3): the engraved WEEK n label under the rocker (D20).
  return (
    <Rocker
      variant="week"
      lamps={lamps}
      accessibilityLabel={`${done} of ${days.length} days done this week`}
    />
  );
}

/** Until Phase 3's day rows: the plan's days, in the display's own type. */
function HomePlaceholder() {
  const { activePlan, completedDayIds } = useWorkoutStore();
  return (
    <View style={styles.home}>
      {(activePlan?.days ?? []).map((day) => {
        const done = completedDayIds.includes(day.id);
        return (
          <View key={day.id} style={styles.homeRow}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1}
              style={[gadgetType.lcdRow, styles.homeName, !done && styles.dim]}>
              {day.title.toUpperCase()}
            </Text>
            {done ? (
              <Text maxFontSizeMultiplier={1} style={gadgetType.lcdRow}>
                ✓
              </Text>
            ) : null}
          </View>
        );
      })}
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
  home: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayPad,
    gap: device.rowGap,
  },
  homeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  homeName: { flexShrink: 1 },
  dim: { color: lcd.amberDim },
});
