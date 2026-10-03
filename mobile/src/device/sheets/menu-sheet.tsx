import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import {
  deviceColors,
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  lcd,
  sheetColors,
  sheetGeometry,
  finishColors,
  space,
} from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import { PRESS_SCALE } from '@/motion';
import { useFinish } from '@/device/finish';
import { useLogSession } from '@/device/log';
import { trackedLiftCount } from '@/device/progress-model';
import { useWorkoutStore } from '@/store/workout-store';

import { ObjectIcon } from './object-icon';
import { SheetCard, SheetHeader, SheetRow, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/** During a workout: the End workout row's facts and action, and Discard under it. */
export type MenuWorkout = { logged: number; total: number; onEnd: () => void; onDiscard: () => void };

/** The menu with the open workout's End and Discard (PLAN Phase 4, screen 10). */
export function DeviceMenuSheet() {
  const log = useLogSession();
  const { close } = useSheetChrome();
  const workout: MenuWorkout | null = log.openDay
    ? {
        logged: log.loggedSetCount,
        total: Math.max(log.finishSummary?.planned ?? 0, log.loggedSetCount),
        onEnd: () => {
          close();
          log.endWorkout();
        },
        onDiscard: () => {
          close();
          void log.discard();
        },
      }
    : null;
  return <MenuSheet workout={workout} />;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The menu (SPEC §6 Menu, N4, D1): End workout during a session, the finish card, then Plans,
 * Progress, History and Settings. Every row swaps the sheet's content in place; ‹ comes back.
 */
export function MenuSheet({ workout }: { workout: MenuWorkout | null }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const { activePlan, workoutHistory } = useWorkoutStore();

  // The lifts Progress lists (weighted sets); no rank line (D4).
  const trackedLifts = useMemo(() => trackedLiftCount(workoutHistory), [workoutHistory]);

  const from = { from: 'menu' };

  return (
    <SheetScroll header={<SheetHeader title="Trim" right={{ kind: 'close', onPress: close }} />}>
      {workout ? (
        <SheetCard>
          <SheetRow
            icon={<ObjectIcon kind="endKey" />}
            title="End workout"
            sub={`${workout.logged} of ${plural(workout.total, 'set', 'sets')} logged`}
            onPress={workout.onEnd}
          />
          <SheetRow title="Discard workout" size="compact" destructive onPress={workout.onDiscard} />
        </SheetCard>
      ) : null}
      <FinishCard onPress={() => swapSheet('finishes', from)} />
      <SheetCard>
        <SheetRow
          icon={<ObjectIcon kind="knob" />}
          title="Plans"
          sub={activePlan ? `${activePlan.name}, ${plural(activePlan.days.length, 'day', 'days')}` : undefined}
          onPress={() => swapSheet('plans', from)}
          testID="menu-plans"
        />
      </SheetCard>
      <SheetCard>
        <SheetRow
          icon={<ObjectIcon kind="gauge" />}
          title="Progress"
          // rank: the gauge and "top n%" wait for strength-standards data (PLAN D4).
          sub={trackedLifts > 0 ? plural(trackedLifts, 'lift tracked', 'lifts tracked') : undefined}
          onPress={() => swapSheet('progress', from)}
          testID="menu-progress"
        />
      </SheetCard>
      <SheetCard>
        <SheetRow
          icon={<ObjectIcon kind="receipt" />}
          title="History"
          sub={workoutHistory.length > 0 ? plural(workoutHistory.length, 'workout', 'workouts') : undefined}
          onPress={() => swapSheet('history', from)}
          testID="menu-history"
        />
      </SheetCard>
      <SheetCard>
        <SheetRow
          icon={<ObjectIcon kind="toggles" />}
          title="Settings"
          onPress={() => swapSheet('settings', from)}
          testID="menu-settings"
        />
      </SheetCard>
    </SheetScroll>
  );
}

/** The finish card: a mini device in the current finish on a warm glow, its name, Change finish. */
function FinishCard({ onPress }: { onPress: () => void }) {
  const { finish } = useFinish();
  const name = finishColors[finish].name;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Finish ${finish}, ${name}. Change finish`}
      testID="menu-finish"
      style={({ pressed }) => [styles.finishCard, pressed && styles.pressed]}>
      <MiniDevice />
      <View style={styles.finishText}>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.itemTitle, styles.center]}>
          {`Finish ${finish}, ${name}`}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.center]}>
          Change finish
        </Text>
      </View>
    </Pressable>
  );
}

/** The device in miniature (prototype menu): body, screen, the big key and a sliver of wheel. */
function MiniDevice() {
  const { finish, palette } = useFinish();
  const id = `mini-${finish}`;
  const w = sheetGeometry.miniDeviceW;
  const h = sheetGeometry.miniDeviceH;
  const screen = { x: 12, y: 12, w: w - 24, h: 44 };
  const key = { cx: 44 + 18, cy: h - 8 - 18, r: 18 };
  const wheel = { x: w - 10 - 14, y: h - 8 - 36, w: 14, h: 36 };
  return (
    <View style={[styles.mini, { transform: [{ rotate: `${sheetGeometry.miniDeviceTilt}deg` }] }]}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.body1} />
            <Stop offset="1" stopColor={palette.body2} />
          </LinearGradient>
          <LinearGradient id={`${id}-key`} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={palette.bigKeyHi} />
            <Stop offset="1" stopColor={palette.bigKeyLo} />
          </LinearGradient>
          <Pattern id={`${id}-ridges`} width={wheel.w} height={4} patternUnits="userSpaceOnUse">
            <Rect width={wheel.w} height={3} fill={deviceColors.wheelLight} />
            <Rect y={3} width={wheel.w} height={1} fill={deviceColors.wheelDark} />
          </Pattern>
        </Defs>
        <Rect width={w} height={h} rx={gadgetRadius.miniDevice} fill={`url(#${id}-body)`} />
        <Rect
          x={screen.x}
          y={screen.y}
          width={screen.w}
          height={screen.h}
          rx={gadgetRadius.miniScreen}
          fill={lcd.lcd}
        />
        <Rect
          x={key.cx - key.r}
          y={key.cy - key.r}
          width={key.r * 2}
          height={key.r * 2}
          rx={key.r}
          fill={`url(#${id}-key)`}
        />
        <Rect x={wheel.x} y={wheel.y} width={wheel.w} height={wheel.h} rx={6} fill={`url(#${id}-ridges)`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // The figure on top, the text under it: at default size the card is 200 with the figure 22
  // from the top and the text 16 from the bottom; large text grows the card, never overlaps.
  finishCard: {
    minHeight: sheetGeometry.finishCard,
    paddingTop: sheetGeometry.miniDeviceTop,
    paddingBottom: space.inset,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.inline,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    marginBottom: sheetGeometry.cardGap,
    overflow: 'hidden',
    backgroundColor: sheetColors.finishGlowLo,
    experimental_backgroundImage: `radial-gradient(ellipse at 50% 30%, ${sheetColors.finishGlowHi}, ${sheetColors.finishGlowLo})`,
  },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
  mini: {
    width: sheetGeometry.miniDeviceW,
    height: sheetGeometry.miniDeviceH,
    borderRadius: gadgetRadius.miniDevice,
    borderCurve: 'continuous',
    boxShadow: `inset 0 2px 0 ${deviceColors.bodyRim}, 0 14px 24px ${sheetColors.swatchShadow}`,
  },
  finishText: { alignSelf: 'stretch', paddingHorizontal: space.inset },
  center: { textAlign: 'center' },
});
