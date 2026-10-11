import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { device, gadgetRadius, gadgetType, lcd, logGeometry, PRESSED_OPACITY, TOUCH_TARGET } from '@/constants/theme';
import { LcdText, useScreenStyles } from '@/device/parts/lcd-text';
import { PadlockGlyph, SparkGlyph, useDisplayHeight, useDrumRoll, useFrameFlash, type DrumNudge } from '@/device/parts';
import { useScreen } from '@/device/finish';
import { durationIsMinutes } from '@/domain/helpers';
import { sessionDurationMinutes } from '@/domain/log-session';
import { DEVICE } from '@/motion';

import type { AutoLamp } from './auto-model';
import { restNextText, restUpText, setLampLayout, type SetLampState } from './log-model';
import { useLogSession } from './log-session-context';
import { RestCharge } from './rest-charge';
import { useRest } from './use-rest';

/** Weights from 1000 (`1000.0`) and `20 MIN` take six characters: the drum's compact size. */
const COMPACT_FROM = 6;

/** The display's lift name (amber in log, dim in rest), ▾ marks it as the way into the exercise sheet. */
function LiftName({
  name,
  dim = false,
  large = false,
  onPress,
}: {
  name: string;
  dim?: boolean;
  /** The log header's name (`lcdRow`); rest keeps it small and dim. */
  large?: boolean;
  onPress: () => void;
}) {
  const styles = useScreenStyles(baseStyles);
  return (
    <Pressable
      onPress={onPress}
      accessible={false}
      hitSlop={{ top: device.displayHeaderY, bottom: logGeometry.namePadX, left: device.displayPad }}
      style={({ pressed }) => [styles.name, pressed && styles.namePressed]}>
      <LcdText
        numberOfLines={1}
        style={[large ? gadgetType.lcdRow : gadgetType.lcdSmall, dim && styles.dim]}>
        {`${name.toUpperCase()} ▾`}
      </LcdText>
    </Pressable>
  );
}

const HEADER_BOTTOM = device.displayHeaderY + gadgetType.lcdSmall.lineHeight;

/** The log header (decision 99): one line, the lift name (`lcdRow`), the set lamps and `2/3`. */
const LOG_HEADER_BOTTOM = device.displayHeaderY + gadgetType.lcdRow.lineHeight;
const CARD_TOP = LOG_HEADER_BOTTOM + logGeometry.cardTopClear;

/** The set lamps (`setLamps`): done lit, the set on the display outlined, the rest off. */
function SetLamps({ lamps }: { lamps: readonly SetLampState[] }) {
  const styles = useScreenStyles(baseStyles);
  if (setLampLayout(lamps.length) === 'none' || lamps.length === 0) {
    return null;
  }
  return (
    <View style={styles.setLamps}>
      {lamps.map((lamp, index) => (
        <View
          key={index}
          style={[styles.setLamp, lamp === 'done' ? styles.gridOn : lamp === 'on' ? styles.setLampOn : styles.gridOff]}
        />
      ))}
    </View>
  );
}

/**
 * The clip on the set card's top edge (decision 99): `AUTO` lit when Trim set the numbers, `MAN`
 * when the lifter moved them, a dim `AUTO` when Auto mode is off, a dim `AUTO` with a padlock on
 * Trim Free. Tapping it opens the Auto mode sheet (Free: the paywall).
 */
function AutoClip({ lamp, onPress }: { lamp: AutoLamp; onPress: () => void }) {
  const styles = useScreenStyles(baseStyles);
  const screen = useScreen();
  const ink = lamp === 'auto' ? screen.lcd : lamp === 'man' ? screen.amber : screen.amberDim;
  return (
    <Pressable
      onPress={onPress}
      accessible={false}
      hitSlop={(TOUCH_TARGET - logGeometry.clipHeight) / 2}
      style={({ pressed }) => [
        styles.clip,
        lamp === 'auto' ? styles.clipOn : lamp === 'man' ? styles.clipMan : styles.clipOff,
        pressed && styles.clipPressed,
      ]}>
      {lamp === 'man' ? null : <SparkGlyph color={ink} size={logGeometry.clipGlyph} />}
      <LcdText glow={lamp !== 'auto'} style={[gadgetType.lcdSmall, { color: ink }]}>
        {lamp === 'man' ? 'MAN' : 'AUTO'}
      </LcdText>
      {lamp === 'locked' ? <PadlockGlyph color={ink} size={logGeometry.clipLock} /> : null}
    </Pressable>
  );
}

/**
 * Log (decision 99, built on decision 84): one header line (the lift name ▾, the set lamps,
 * `2/3`), then the set card: weight over reps in one frame. Auto mode clips onto the card's top
 * edge (`AUTO` / `MAN`, and on MAN AUTO's own set with its spark on the right); the card's
 * bottom edge says why (`▲ FROM 85×8`) or last time (`LAST 85×8`). Tapping the card cycles the
 * lift's wheel step, shown as `±2` inside it (80); long-pressing it opens the keypad (D19).
 */
export function LogDisplay({
  nudge,
  flash,
  onName,
  onKeypad,
  onStep,
  onAuto,
}: {
  nudge: DrumNudge | null;
  flash: number;
  onName: () => void;
  onKeypad: () => void;
  onStep: () => void;
  /** The clip: the Auto mode sheet, or on Trim Free the paywall. */
  onAuto: () => void;
}) {
  const styles = useScreenStyles(baseStyles);
  const screen = useScreen();
  const { current, drum, keys, setTag, setLamps, auto, controls, loadStep } = useLogSession();
  const rollStyle = useDrumRoll(nudge);
  const frameStyle = useFrameFlash(flash);
  if (!current || !drum || !controls) {
    return null;
  }
  // Bodyweight puts reps on the drum; the keys step the same value, so it shows once.
  const keysValue = controls.keys && controls.keys !== controls.drum ? keys : null;
  const lamp = auto?.lamp ?? null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.header} pointerEvents="box-none">
        <LiftName name={current.prescription.name} large onPress={onName} />
        <View style={styles.setRow}>
          <SetLamps lamps={setLamps} />
          <LcdText numberOfLines={1} style={gadgetType.lcdRow}>
            {setTag}
          </LcdText>
        </View>
      </View>
      <Animated.View pointerEvents="none" style={[styles.card, frameStyle]} />
      <Pressable accessible={false} onPress={onStep} onLongPress={onKeypad} style={styles.cardBody}>
        <Animated.View style={[styles.cardValues, rollStyle]}>
          {drum.header ? (
            <LcdText style={[gadgetType.lcdSmall, styles.dim]}>
              {drum.header}
            </LcdText>
          ) : null}
          <LcdText
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[drum.text.length >= COMPACT_FROM ? gadgetType.lcdHeroCompact : gadgetType.lcdHero, styles.center]}>
            {drum.text}
          </LcdText>
          {keysValue ? (
            <View style={styles.keysValue}>
              <LcdText numberOfLines={1} style={gadgetType.lcdReps}>
                {keysValue.value}
              </LcdText>
              {keysValue.unit ? (
                <LcdText style={[gadgetType.lcdSmall, styles.besideReps]}>
                  {keysValue.unit}
                </LcdText>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
        {loadStep ? (
          <LcdText style={[gadgetType.lcdSmall, !loadStep.chosen && styles.dim, styles.stepTag]}>
            {loadStep.text}
          </LcdText>
        ) : null}
      </Pressable>
      {lamp ? (
        <View style={styles.clipRow} pointerEvents="box-none">
          <AutoClip lamp={lamp} onPress={onAuto} />
          {lamp === 'man' && auto?.autoText ? (
            <Pressable accessible={false} onPress={onAuto} hitSlop={logGeometry.clipPadX} style={styles.cut}>
              <SparkGlyph color={screen.amber} size={logGeometry.clipGlyph} />
              <LcdText style={gadgetType.lcdSmall}>{auto.autoText}</LcdText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {auto?.edge ? (
        <View style={styles.edgeRow} pointerEvents="none">
          <LcdText numberOfLines={1} style={[gadgetType.lcdSmall, lamp !== 'auto' && styles.dim, styles.cut]}>
            {auto.edge}
          </LcdText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Rest (decision 96): `REST` / `NEXT 85×8`, then centred between header and footer `SET 2 IN`
 * over the clock (56) and the battery that charges toward the next set (`RestCharge`), and the
 * lift name ▾ in the footer. At 0:00 the battery is full and `SET 2` / a blinking `GO` show for
 * `REST_GO_MS` (D6); then the log view returns.
 */
export function RestDisplay({ onName }: { onName: () => void }) {
  const styles = useScreenStyles(baseStyles);
  const { current, stage } = useLogSession();
  const rest = useRest();
  const height = useDisplayHeight();

  // The battery measures against the longest this rest has been (the prototype's
  // `restTotal = max(restTotal, rest)`): −15 lights cells, +15 takes them back.
  const [longest, setLongest] = useState({ key: rest.startedAtMs, seconds: rest.totalSeconds });
  if (longest.key !== rest.startedAtMs || rest.totalSeconds > longest.seconds) {
    setLongest({ key: rest.startedAtMs, seconds: rest.totalSeconds });
  }
  const total = longest.key === rest.startedAtMs ? Math.max(longest.seconds, rest.totalSeconds) : rest.totalSeconds;
  const fraction = rest.go || total <= 0 ? 0 : Math.min(1, rest.secondsLeft / total);

  if (!current || !stage) {
    return null;
  }
  const next = restNextText(stage.values, durationIsMinutes(current.prescription));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.header}>
        <LcdText style={[gadgetType.lcdSmall, styles.dim]}>
          REST
        </LcdText>
        {next ? (
          <LcdText numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim]}>
            {next}
          </LcdText>
        ) : null}
      </View>
      <RestCharge
        up={restUpText(stage)}
        clock={rest.clock}
        fraction={fraction}
        go={rest.go}
        room={height - HEADER_BOTTOM - logGeometry.restFooterY - gadgetType.lcdSmall.lineHeight}
        style={styles.restMiddle}
      />
      <View style={[styles.footer, styles.restFooter]} pointerEvents="box-none">
        <LiftName name={current.prescription.name} dim onPress={onName} />
      </View>
    </View>
  );
}

/** The minutes since the start, refreshed while finish mode shows. */
function useMinutes(startedAt: string | undefined): number {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), DEVICE.MINUTE_TICK);
    return () => clearInterval(timer);
  }, []);
  return startedAt ? sessionDurationMinutes(startedAt, now) : 0;
}

/**
 * The finish grid for `count` sets, always clear of the stats: 9 a row with 10-pt lamps 8 apart
 * up to 4 rows (36 sets, screen 11); then 8-pt lamps 4 apart (the rocker's compression); then
 * more columns, as many rows as fit.
 */
function finishGrid(count: number): { columns: number; lamp: number; gap: number } {
  const room = logGeometry.finishStatsY - logGeometry.finishGridY - logGeometry.finishGridClear;
  const fits = (rows: number, lamp: number, gap: number) => rows * lamp + (rows - 1) * gap <= room;
  const rows = Math.ceil(count / device.gridColumns);
  if (fits(rows, device.gridLamp, device.gridGap)) {
    return { columns: device.gridColumns, lamp: device.gridLamp, gap: device.gridGap };
  }
  const lamp = device.lampCompact;
  const gap = device.lampGapCompact;
  if (fits(rows, lamp, gap)) return { columns: device.gridColumns, lamp, gap };
  const maxRows = Math.floor((room + gap) / (lamp + gap));
  return { columns: Math.ceil(count / maxRows), lamp, gap };
}

/**
 * Finish (screens 11, 12): the day / `N MIN`, `ALL DONE` or `END EARLY?`, the set lamps (9 a
 * row), then `n OF m SETS` and the volume, or `NOTHING LOGGED`. No `HOLD TO FINISH`: the big
 * key's VoiceOver label carries it (SPEC §10).
 */
export function FinishDisplay() {
  const styles = useScreenStyles(baseStyles);
  const { day, openDay, finishSummary } = useLogSession();
  const minutes = useMinutes(openDay?.startedAt);
  if (!finishSummary) {
    return null;
  }
  const grid = finishGrid(finishSummary.grid.length);
  const rows: boolean[][] = [];
  for (let index = 0; index < finishSummary.grid.length; index += grid.columns) {
    rows.push(finishSummary.grid.slice(index, index + grid.columns));
  }
  const cellSize = { height: grid.lamp, borderRadius: grid.lamp / 2 };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.header}>
        <LcdText numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim, styles.shrink]}>
          {(day?.title ?? '').toUpperCase()}
        </LcdText>
        <LcdText style={[gadgetType.lcdSmall, styles.dim, styles.noShrink]}>
          {`${minutes} MIN`}
        </LcdText>
      </View>
      <LcdText numberOfLines={1} style={[gadgetType.lcdTitle, styles.finishTitle]}>
        {finishSummary.headline}
      </LcdText>
      <View style={[styles.grid, { gap: grid.gap }]}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.gridRow, { gap: grid.gap }]}>
            {Array.from({ length: grid.columns }, (_, column) => {
              const lit = row[column];
              return (
                <View
                  key={column}
                  style={[styles.gridCell, cellSize, lit === undefined ? styles.gridEmpty : lit ? styles.gridOn : styles.gridOff]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.stats}>
        <LcdText style={gadgetType.lcdStat}>
          {finishSummary.setsText}
        </LcdText>
        {finishSummary.volumeText ? (
          <LcdText style={gadgetType.lcdStat}>
            {finishSummary.volumeText}
          </LcdText>
        ) : null}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  dim: { color: lcd.amberDim },
  shrink: { flexShrink: 1 },
  noShrink: { flexShrink: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: device.rowGap,
  },
  name: {
    flexShrink: 1,
    paddingHorizontal: logGeometry.namePadX,
    paddingVertical: logGeometry.namePadY,
    marginHorizontal: -logGeometry.namePadX,
    marginVertical: -logGeometry.namePadY,
    borderRadius: logGeometry.nameRadius,
    borderCurve: 'continuous',
  },
  namePressed: { backgroundColor: lcd.amberPress },
  card: {
    position: 'absolute',
    left: device.drumFrameInset,
    right: device.drumFrameInset,
    top: CARD_TOP,
    bottom: logGeometry.cardBottomY,
    borderRadius: gadgetRadius.lcdFrame,
    borderCurve: 'continuous',
    borderWidth: device.drumFrameStroke,
    borderColor: lcd.amber,
  },
  cardBody: {
    position: 'absolute',
    left: device.drumFrameInset,
    right: device.drumFrameInset,
    top: CARD_TOP,
    bottom: logGeometry.cardBottomY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardValues: { alignItems: 'center', gap: logGeometry.cardValueGap, alignSelf: 'stretch', paddingHorizontal: device.displayPad },
  center: { textAlign: 'center', alignSelf: 'stretch' },
  stepTag: { position: 'absolute', right: logGeometry.cardStepInset, bottom: logGeometry.cardStepInset },
  clipRow: {
    position: 'absolute',
    left: device.drumFrameInset + logGeometry.clipInsetX,
    right: device.drumFrameInset + logGeometry.clipInsetX,
    top: CARD_TOP - logGeometry.clipHeight / 2,
    height: logGeometry.clipHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clip: {
    height: logGeometry.clipHeight,
    borderRadius: logGeometry.clipHeight / 2,
    paddingHorizontal: logGeometry.clipPadX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: logGeometry.clipGap,
    backgroundColor: lcd.lcd,
  },
  clipOn: { backgroundColor: lcd.amber, boxShadow: `0 0 12px ${lcd.amberGlow}` },
  clipMan: { borderWidth: device.drumFrameStroke, borderColor: lcd.amber },
  clipOff: { borderWidth: device.drumFrameStroke, borderColor: lcd.amberDim },
  clipPressed: { opacity: PRESSED_OPACITY },
  cut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: logGeometry.clipGap,
    paddingHorizontal: logGeometry.cutPadX,
    backgroundColor: lcd.lcd,
  },
  edgeRow: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    bottom: logGeometry.cardBottomY - gadgetType.lcdSmall.lineHeight / 2,
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    bottom: device.repsFooterY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: device.rowGap,
  },
  besideReps: { marginBottom: device.lcdSmallBesideReps },
  keysValue: { flexDirection: 'row', alignItems: 'flex-end', gap: logGeometry.repsUnitGap },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: logGeometry.setLampLabelGap, flexShrink: 0 },
  setLamps: { flexDirection: 'row', alignItems: 'center', gap: logGeometry.headerLampGap },
  setLamp: {
    width: logGeometry.setLampWidthCompact,
    height: logGeometry.setLampHeight,
    borderRadius: logGeometry.setLampHeight / 2,
  },
  setLampOn: { borderWidth: device.drumFrameStroke, borderColor: lcd.amber },
  restFooter: { bottom: logGeometry.restFooterY, alignItems: 'baseline' },
  restMiddle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: HEADER_BOTTOM,
    bottom: logGeometry.restFooterY + gadgetType.lcdSmall.lineHeight,
  },
  finishTitle: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: logGeometry.finishTitleY },
  grid: {
    position: 'absolute',
    left: device.displayPad,
    right: logGeometry.finishGridRight,
    top: logGeometry.finishGridY,
  },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1 },
  gridOff: { backgroundColor: lcd.amberOff },
  gridOn: { backgroundColor: lcd.amber, boxShadow: `0 0 6px ${lcd.amber}` },
  gridEmpty: { backgroundColor: 'transparent' },
  stats: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: logGeometry.finishStatsY },
});
