import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartridgeInsert } from '../../modules/trim-device';

import { device, editGeometry, finishColors, insertGeometry, gadgetType, logGeometry, signal, space } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import { commandFromParams, deviceMode } from '@/device/device-state';
import { EditDisplay } from '@/device/edit/edit-display';
import { useEditDevice } from '@/device/edit/use-edit-device';
import { useFinish } from '@/device/finish';
import { useAppFonts } from '@/device/fonts';
import { HomeDisplay } from '@/device/home/home-display';
import { InsertBackdrop, InsertBody, SlotGlow, useInsertDeviceStyle } from '@/device/insert/insert-scene';
import { LoadingDisplay } from '@/device/insert/loading-display';
import { useInsert } from '@/device/insert/use-insert';
import { useHome } from '@/device/home/use-home';
import type { HomeModel } from '@/device/home-model';
import { REFERENCE_WIDTH, fromReferenceTop } from '@/device/layout';
import { LogSessionProvider, type KeysKind } from '@/device/log';
import { FinishDisplay, LogDisplay, RestDisplay } from '@/device/log/log-display';
import { useLogDevice } from '@/device/log/use-log-device';
import { MomentHost } from '@/device/moment/moment-host';
import {
  BigKey,
  type BigKeyVariant,
  DeviceBody,
  Display,
  EngravedLabel,
  HistoryGlyph,
  HoldRing,
  LampPlate,
  MenuGlyph,
  Rocker,
  RoundKey,
  TallKey,
  Well,
  Wheel,
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
 * The device (PLAN Phase 2): the whole app's home screen. The open log session (Phase 4) wraps
 * it and the sheets, so the display, keys and the Today, menu and exercise sheets share it.
 */
export function DeviceScreen() {
  return (
    <LogSessionProvider>
      <DeviceSurface />
    </LogSessionProvider>
  );
}

/**
 * Laid out with flex and safe areas from SPEC §4's reference: the top row under the safe area,
 * the display taking what's left, the bottom row above the home indicator. Keys never shrink;
 * on big phones the margins grow and the display takes the extra height. The parts never move:
 * each mode (trim-ui §2 key map) only changes what they show and do. SheetHost sits above it,
 * in the same view tree.
 */
function DeviceSurface() {
  const fontsReady = useAppFonts();
  const { finish, palette } = useFinish();
  const { soundsOn } = useWorkoutStore();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { state, openSheet, setLogMode } = useDevice();
  const home = useHome();
  const work = useLogDevice();
  const edit = useEditDevice();
  const insert = useInsert();
  const jsClock = insert?.engine === 'js' && insert.phase === 'scene' ? insert.clock : null;
  const deviceMotion = useInsertDeviceStyle(jsClock);
  const hidden = insert?.engine === 'native' && insert.phase === 'scene' && insert.nativeShowing;
  const hiddenStyle = useAnimatedStyle(() => ({ opacity: hidden ? 0 : 1 }));
  const { log } = work;
  /**
   * What the big key meant when the finger landed. The release runs that, even if the mode
   * changed meanwhile: a fast tap right after Log (before its re-render) still logs or skips,
   * and the release that closes a finish hold doesn't press Start on Home.
   */
  const pressed = useRef<BigKeyAction | null>(null);
  useDeviceParams();
  useDevInsertParam();

  // Readers outside the session (`useDevice().mode`, Home's stamp) see the log's mode too.
  useEffect(() => {
    setLogMode(log.mode);
  }, [log.mode, setLogMode]);

  if (!fontsReady) {
    return null;
  }

  const mode = deviceMode(state, log.mode);
  const view: DeviceView =
    mode === 'edit'
      ? edit
        ? 'edit'
        : 'home'
      : mode === 'loading'
        ? insert
          ? 'loading'
          : 'home'
        : mode === 'home'
          ? 'home'
          : (work.view ?? 'home');
  const working = view === 'log' || view === 'rest' || view === 'finish';

  // Margins scale with the width (Pro Max); the keys keep their size.
  const edge = Math.round(device.edge * Math.max(1, width / REFERENCE_WIDTH));
  const hasHomeIndicator = insets.bottom > 0;
  const bottomPad = hasHomeIndicator
    ? Math.max(insets.bottom, device.bottomClearance) + space.gutter
    : device.bottomClearanceCompact + space.inset;

  const topRowY = fromReferenceTop(device.topRowY, insets.top);
  // Where the display and the well sit, for the native insert's last frame to line up.
  const displayY = topRowY + device.keySize + ROW_GAP;
  const bottomRowY = height - bottomPad - BOTTOM_ROW;
  const displayHeight = bottomRowY - ROW_GAP - displayY;
  const stage = log.stage;
  const contentKey =
    view === 'log' && stage
      ? `log:${stage.current.prescription.id}:${stage.kind}:${stage.setIndex}`
      : view === 'home'
        ? home.model.kind
        : view === 'edit' && edit
          ? `edit:${edit.exercise.id}`
          : view;
  // While the device is turned away or under the native scene, the status bar sits on the dark scene.
  const onScene = insert != null && insert.phase === 'scene' && (insert.engine === 'js' || insert.nativeShowing);

  const bigKey: BigKeyAction = (() => {
    switch (view) {
      case 'log':
        return stage?.kind === 'edit'
          ? { label: 'Save', accessibilityLabel: 'Save set', variant: 'primary' as const, onPress: work.onLog }
          : { label: 'Log', accessibilityLabel: 'Log set', variant: 'primary' as const, onPress: work.onLog };
      case 'rest':
        return { label: 'Skip', accessibilityLabel: 'Skip rest', variant: 'metal' as const, onPress: work.rest.skip };
      case 'finish':
        return log.finishSummary?.nothingLogged
          ? {
              label: 'Discard',
              accessibilityLabel: 'Discard workout',
              variant: 'metal' as const,
              onPress: () => void log.discard(),
            }
          : {
              label: 'Finish',
              accessibilityLabel: 'Finish workout, hold',
              variant: 'primary' as const,
              onPressIn: work.hold.pressIn,
              onPressOut: work.hold.pressOut,
            };
      case 'loading':
        return { label: 'Start', accessibilityLabel: 'Start', variant: 'disabled' as const };
      case 'edit':
        return { label: 'Done', accessibilityLabel: 'Done', variant: 'metal' as const, onPress: edit?.back };
      default:
        return {
          label: home.startLabel,
          accessibilityLabel: home.startAccessibilityLabel,
          variant: home.model.kind === 'empty' ? ('metal' as const) : ('primary' as const),
          onPress: home.start,
        };
    }
  })();

  const leftX = edge + KEY_INSET;

  return (
    <View style={styles.root}>
      <StatusBar style={onScene ? 'light' : finishColors[finish].statusBar} />
      {jsClock ? <InsertBackdrop clock={jsClock} width={width} height={height} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, deviceMotion, hiddenStyle]}>
        {jsClock && insert ? (
          <InsertBody clock={jsClock} palette={palette} width={width} planName={insert.planName} days={insert.days} part="back" />
        ) : null}
        {jsClock && insert ? (
          <InsertBody clock={jsClock} palette={palette} width={width} planName={insert.planName} days={insert.days} part="front" />
        ) : null}
        <DeviceBody
          rim={jsClock != null}
          rimRadius={insertGeometry.bodyRadius}
          style={jsClock ? styles.bodyObject : undefined}>
          {/*
            VoiceOver groups every view's children and reads siblings top-left first, so the
            top-right key sits outside this column (drawn over its top-right slot): the order is
            menu, the rocker, the display, the bottom row, then History or Undo (PLAN Phase 3).
          */}
          <View style={[styles.column, { paddingTop: topRowY, paddingBottom: bottomPad }]}>
            <View style={[styles.topRow, { paddingHorizontal: edge }]}>
              {view === 'edit' && edit ? (
                <RoundKey label="‹" accessibilityLabel="Back to the plan" onPress={edit.back} />
              ) : (
                <RoundKey accessibilityLabel="Menu" onPress={() => openSheet('menu')}>
                  <MenuGlyph />
                </RoundKey>
              )}
              {view === 'edit' && edit ? (
                <Rocker
                  variant="lifts"
                  lamps={edit.day.exercises.map((_, index) => (index === edit.index ? 'on' : 'off'))}
                  prevDisabled={edit.index <= 0}
                  nextDisabled={edit.index >= edit.count - 1}
                  onPrev={edit.prev}
                  onNext={edit.next}
                  onMiddle={edit.back}
                  middleLabel="Back to the plan"
                  style={styles.rocker}
                />
              ) : view === 'loading' && insert ? (
                <View style={styles.rocker}>
                  <Rocker variant="week" lamps={insert.lamps} accessibilityLabel="" />
                </View>
              ) : view === 'home' ? (
                <WeekRocker model={home.model} />
              ) : view === 'finish' ? (
                <View style={[styles.rocker, styles.plateSlot]}>
                  <LampPlate
                    lamps={log.lamps.map((lamp) => (lamp === 'done' ? 'done' : 'off'))}
                    accessibilityLabel={`${log.lamps.filter((lamp) => lamp === 'done').length} of ${log.lamps.length} lifts done`}
                  />
                </View>
              ) : (
                <Rocker
                  variant="lifts"
                  lamps={log.lamps}
                  prevDisabled={log.exerciseIndex <= 0}
                  nextDisabled={log.exerciseIndex >= log.drafts.length - 1}
                  onPrev={() => log.goToExercise(log.exerciseIndex - 1)}
                  onNext={() => log.goToExercise(log.exerciseIndex + 1)}
                  onMiddle={() => openSheet('today')}
                />
              )}
              <View style={styles.keySlot} />
            </View>

            <Display
              contentKey={contentKey}
              accessibilityLabel={working ? work.display.summary : view === 'edit' ? edit?.summary : undefined}
              accessibilityActions={working ? work.display.actions : undefined}
              onAccessibilityAction={working ? work.display.onAction : undefined}
              style={[
                styles.display,
                { marginHorizontal: edge, minHeight: height >= TALL_SCREEN ? DISPLAY_MIN : undefined },
              ]}>
              {view === 'loading' && insert ? (
                <LoadingDisplay insert={insert} />
              ) : view === 'edit' && edit ? (
                <EditDisplay edit={edit} />
              ) : view === 'log' ? (
                <LogDisplay
                  nudge={work.nudge}
                  flash={work.flash}
                  onName={work.openExercise}
                  onKeypad={work.openKeypad}
                />
              ) : view === 'rest' ? (
                <RestDisplay onName={work.openExercise} />
              ) : view === 'finish' ? (
                <FinishDisplay />
              ) : (
                <HomeDisplay model={home.model} celebrateDayId={home.celebrateDayId} onPick={home.pickDay} />
              )}
            </Display>

            <View style={styles.bottomRow}>
              {view === 'log' && log.controls?.keys ? (
                <>
                  <TallKey
                    label="+"
                    accessibilityLabel={KEY_NAMES[log.controls.keys].more}
                    onPress={() => work.keys.step(1)}
                    onLongPress={() => work.keys.repeat(1)}
                    onPressOut={work.keys.stopRepeat}
                    style={[styles.tallKey, { left: leftX, top: logGeometry.tallKeyTop }]}
                  />
                  <TallKey
                    label="−"
                    accessibilityLabel={KEY_NAMES[log.controls.keys].fewer}
                    onPress={() => work.keys.step(-1)}
                    onLongPress={() => work.keys.repeat(-1)}
                    onPressOut={work.keys.stopRepeat}
                    style={[styles.tallKey, { left: leftX, top: logGeometry.tallKeyBottom }]}
                  />
                </>
              ) : null}
              {view === 'rest' ? (
                <>
                  <TallKey
                    label="+15"
                    text="word"
                    accessibilityLabel="Add 15 seconds"
                    onPress={() => work.keys.nudgeRest(1)}
                    onLongPress={() => work.keys.repeatRest(1)}
                    onPressOut={work.keys.stopRepeat}
                    style={[styles.tallKey, { left: leftX, top: logGeometry.tallKeyTop }]}
                  />
                  <TallKey
                    label="−15"
                    text="word"
                    accessibilityLabel="Take off 15 seconds"
                    onPress={() => work.keys.nudgeRest(-1)}
                    onLongPress={() => work.keys.repeatRest(-1)}
                    onPressOut={work.keys.stopRepeat}
                    style={[styles.tallKey, { left: leftX, top: logGeometry.tallKeyBottom }]}
                  />
                </>
              ) : null}
              {view === 'edit' && edit ? (
                <>
                  <TallKey
                    label="+"
                    accessibilityLabel="More sets"
                    onPress={() => edit.stepSets(1)}
                    style={[styles.tallKey, { left: leftX, top: logGeometry.tallKeyTop }]}
                  />
                  <TallKey
                    label="−"
                    accessibilityLabel="Fewer sets"
                    onPress={() => edit.stepSets(-1)}
                    style={[styles.tallKey, { left: leftX, top: logGeometry.tallKeyBottom }]}
                  />
                  <EngravedLabel style={[styles.tallKeyLabel, { left: leftX, top: editGeometry.setsLabelY }]}>
                    SETS
                  </EngravedLabel>
                </>
              ) : null}
              {view === 'finish' ? (
                <TallKey
                  label="Back"
                  text="wordSmall"
                  accessibilityLabel="Back to the workout"
                  onPress={log.leaveFinish}
                  style={[styles.tallKey, { left: leftX, top: logGeometry.backKeyTop }]}
                />
              ) : null}
              <View style={[styles.centered, { top: WELL_Y }]}>
                <Well />
              </View>
              {view === 'finish' ? (
                <View style={[styles.centered, { top: WELL_Y }]} pointerEvents="none">
                  <HoldRing progress={work.hold.progress} />
                </View>
              ) : null}
              <View style={[styles.centered, { top: BIG_KEY_Y }]}>
                <BigKey
                  label={bigKey.label}
                  variant={bigKey.variant}
                  accessibilityLabel={bigKey.accessibilityLabel}
                  onPressIn={() => {
                    pressed.current = bigKey;
                    bigKey.onPressIn?.();
                  }}
                  onPressOut={() => pressed.current?.onPressOut?.()}
                  onPress={() => pressed.current?.onPress?.()}
                />
              </View>
              <Wheel
                stowed={view === 'home' || view === 'finish' || view === 'loading'}
                label={
                  view === 'log' || view === 'rest' ? work.wheel.label : view === 'edit' ? edit?.face.wheelLabel : undefined
                }
                accessibilityLabel={
                  working ? work.wheel.accessibilityLabel : view === 'edit' && edit ? (edit.face.kind === 'reps' ? 'Reps' : 'Time') : 'Weight'
                }
                accessibilityValue={
                  working ? work.wheel.accessibilityValue : view === 'edit' && edit ? edit.face.spokenValue : undefined
                }
                onNotch={
                  view === 'log' || view === 'rest'
                    ? work.onWheelNotch
                    : view === 'edit' && edit
                      ? (direction) => edit.stepValue(direction)
                      : NO_LIFT
                }
                style={[styles.wheel, { right: edge + KEY_INSET }]}
              />
            </View>
          </View>
          {view === 'edit' && edit ? (
            <RoundKey
              label="✕"
              accessibilityLabel="Remove lift"
              onPress={edit.remove}
              style={[styles.historyKey, { top: topRowY, right: edge }]}
            />
          ) : view === 'loading' ? null : working ? (
            <RoundKey
              label="↶"
              accessibilityLabel={work.editing ? 'Cancel edit' : 'Undo last set'}
              disabled={!work.editing && !log.canUndo}
              onPress={work.onUndo}
              style={[styles.historyKey, { top: topRowY, right: edge }]}
            />
          ) : (
            <RoundKey
              accessibilityLabel="History"
              onPress={() => openSheet('history')}
              style={[styles.historyKey, { top: topRowY, right: edge }]}>
              <HistoryGlyph />
            </RoundKey>
          )}
        </DeviceBody>
        {jsClock ? <SlotGlow clock={jsClock} width={width} /> : null}
      </Animated.View>
      <SheetHost />
      <MomentHost />
      {insert?.engine === 'native' && insert.phase === 'scene' ? (
        <CartridgeInsert
          style={StyleSheet.absoluteFill}
          finish={finish}
          planName={insert.planName}
          days={insert.days.map((day) => day.title)}
          playing
          reduceMotion={false}
          soundsOn={soundsOn}
          safeTop={insets.top}
          safeBottom={insets.bottom}
          deviceLayout={{ topRowY, displayY, displayHeight, wellY: bottomRowY + WELL_Y }}
          pauseAt={insert.pauseAt}
          speed={insert.speed}
          onSceneReady={insert.onNativeReady}
          onSeated={insert.onNativeSeated}
          onFinished={insert.onNativeFinished}
        />
      ) : null}
      {insert && !hidden ? (
        // D22: nothing waits on the moment. A tap skips the scene to face-on, then the ticks to Home.
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={insert.skip}
          accessibilityRole="button"
          accessibilityLabel={`Loading ${insert.planName}. Skip`}
        />
      ) : null}
    </View>
  );
}

type DeviceView = 'home' | 'log' | 'rest' | 'finish' | 'edit' | 'loading';

type BigKeyAction = {
  label: string;
  accessibilityLabel: string;
  variant: BigKeyVariant;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
};

/** The tall keys' VoiceOver names per what they step (§6.6). */
const KEY_NAMES: Record<NonNullable<KeysKind>, { more: string; fewer: string }> = {
  reps: { more: 'More reps', fewer: 'Fewer reps' },
  seconds: { more: 'Add 5 seconds', fewer: 'Take off 5 seconds' },
  minutes: { more: 'Add a minute', fewer: 'Take off a minute' },
};

/**
 * Development: `/?insert=js` (`native`, or `auto` to choose as Use plan does) plays the insert for the active plan without
 * changing anything; `&pause=<ms>` freezes it there, `&speed=0.25` slows it down (PLAN §10).
 */
function useDevInsertParam() {
  const params = useLocalSearchParams<{ insert?: string; pause?: string; speed?: string }>();
  const router = useRouter();
  const { startLoading } = useDevice();
  const { activePlanId, isHydrated } = useWorkoutStore();
  const engine =
    __DEV__ && (params.insert === 'js' || params.insert === 'native' || params.insert === 'auto') ? params.insert : null;
  useEffect(() => {
    if (!engine || !isHydrated || !activePlanId) return;
    const pauseAt = params.pause != null ? Number(params.pause) : undefined;
    const speed = params.speed != null ? Number(params.speed) : undefined;
    startLoading(activePlanId, { engine: engine === 'auto' ? undefined : engine, pauseAt, speed });
    router.setParams({ insert: undefined, pause: undefined, speed: undefined });
    // Once per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, isHydrated]);
}

/**
 * `/` takes device commands as search params (`?sheet=settings`, `?log=1&planId&dayId`), so
 * deep links and the `/log` alias can reach into the device. Each command runs once, then the params
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
  tallKey: { position: 'absolute' },
  tallKeyLabel: { position: 'absolute', width: device.tallKeyWidth },
  plateSlot: { alignItems: 'center', justifyContent: 'center' },
  historyKey: { position: 'absolute' },
  rocker: { width: device.rockerWidth, height: device.rockerHeight },
  bodyObject: { borderRadius: insertGeometry.bodyRadius, borderCurve: 'continuous' },
  rockerLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: device.rockerHeight + device.labelGap,
  },
});
