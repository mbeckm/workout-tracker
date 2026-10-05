import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { device, gadgetType, lcd, logGeometry } from '@/constants/theme';
import { Drum, drumLayout, useDisplayHeight, type DrumLayout, type DrumNudge } from '@/device/parts';
import { durationIsMinutes } from '@/domain/helpers';
import { sessionDurationMinutes } from '@/domain/log-session';
import { DEVICE } from '@/motion';

import { restNextText } from './log-model';
import { useLogSession } from './log-session-context';
import { useRest } from './use-rest';

/** Weights from 1000 (`1000.0`) and `20 MIN` take six characters: the drum's compact size. */
const COMPACT_FROM = 6;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The display's lift name (amber in log, dim in rest), ▾ marks it as the way into the exercise sheet. */
function LiftName({
  name,
  dim = false,
  onPress,
}: {
  name: string;
  dim?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessible={false}
      hitSlop={{ top: device.displayHeaderY, bottom: logGeometry.namePadX, left: device.displayPad }}
      style={({ pressed }) => [styles.name, pressed && styles.namePressed]}>
      <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, dim && styles.dim]}>
        {`${name.toUpperCase()} ▾`}
      </Text>
    </Pressable>
  );
}

const HEADER_BOTTOM = device.displayHeaderY + gadgetType.lcdSmall.lineHeight;

/** `ASSIST` rides the step above; without it (short displays) it sits midway to the frame. */
function assistY(layout: DrumLayout): number {
  return layout.above
    ? device.drumAboveY + layout.offset
    : Math.round((HEADER_BOTTOM + layout.frameY - gadgetType.lcdSmall.lineHeight) / 2);
}

/**
 * Where the drum's step tag (`±2`) sits: right-aligned just under the frame, or null when a
 * short display has no room for it above the `×8` footer.
 */
function stepTagY(layout: DrumLayout, height: number): number | null {
  const top = layout.frameY + device.drumFrameHeight + device.drumClear;
  if (height <= 0) return top;
  const footerTop = height - device.repsFooterY - gadgetType.lcdReps.lineHeight;
  return top + gadgetType.lcdSmall.lineHeight + device.drumClear <= footerTop ? top : null;
}

/**
 * Log (V2, screens 04, 05, 09): the lift name ▾ and the set label, the drum (the wheel's value),
 * the keys' value (`×8`) and the reference fact (`LAST 80×8`, `TARGET 87.5×8`, `TARGET ›`).
 * Tapping the drum cycles the lift's wheel step, shown as `±2` under the frame (79);
 * long-pressing it opens the keypad (D19).
 */
export function LogDisplay({
  nudge,
  flash,
  onName,
  onKeypad,
  onStep,
}: {
  nudge: DrumNudge | null;
  flash: number;
  onName: () => void;
  onKeypad: () => void;
  onStep: () => void;
}) {
  const { current, drum, keysText, setLabel, footer, controls, loadStep, unlockTargets } = useLogSession();
  const height = useDisplayHeight();
  const layout = drumLayout(height);
  const tagY = loadStep ? stepTagY(layout, height) : null;
  if (!current || !drum || !controls) {
    return null;
  }
  // Bodyweight puts reps on the drum; the keys step the same value, so it shows once.
  const keysValue = controls.keys && controls.keys !== controls.drum ? keysText : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Drum
        current={drum.text}
        above={drum.up ?? undefined}
        below={drum.down ?? undefined}
        nudge={nudge}
        flash={flash}
        compact={drum.text.length >= COMPACT_FROM}
        layout={layout}
      />
      <Pressable
        accessible={false}
        onPress={onStep}
        onLongPress={onKeypad}
        style={[styles.drumHit, { top: layout.frameY }]}
      />
      {loadStep && tagY != null ? (
        <Text
          maxFontSizeMultiplier={1}
          style={[gadgetType.lcdSmall, !loadStep.chosen && styles.dim, styles.stepTag, { top: tagY }]}>
          {loadStep.text}
        </Text>
      ) : null}
      <View style={styles.header} pointerEvents="box-none">
        <LiftName name={current.prescription.name} onPress={onName} />
        <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim, styles.noShrink]}>
          {setLabel}
        </Text>
      </View>
      {drum.header ? (
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim, styles.assist, { top: assistY(layout) }]}>
          {drum.header}
        </Text>
      ) : null}
      <View style={styles.footer} pointerEvents="box-none">
        <Text maxFontSizeMultiplier={1} numberOfLines={1} style={gadgetType.lcdReps}>
          {keysValue ?? ''}
        </Text>
        {footer?.text ? (
          footer.targetLocked ? (
            <Pressable
              accessible={false}
              hitSlop={device.displayFooterY}
              onPress={() => void unlockTargets()}
              style={({ pressed }) => [styles.footerFact, pressed && styles.namePressed]}>
              <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim]}>
                {footer.text}
              </Text>
            </Pressable>
          ) : (
            <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim, styles.footerFact]}>
              {footer.text}
            </Text>
          )
        ) : null}
      </View>
    </View>
  );
}

/**
 * Rest (screen 08): `REST` / `NEXT 85×8`, the ring (r95, stroke 12, a dashed amberOff track
 * under the amber time left), the clock (56), and the lift name ▾ with the set label. At 0:00 a
 * blinking `GO` replaces the clock for `REST_GO_MS` (D6); then the log view returns.
 */
export function RestDisplay({ onName }: { onName: () => void }) {
  const { current, stage, setLabel } = useLogSession();
  const rest = useRest();
  const height = useDisplayHeight();

  // The ring measures against the longest this rest has been (the prototype's
  // `restTotal = max(restTotal, rest)`): −15 takes a visible bite, +15 grows the whole.
  const [longest, setLongest] = useState({ key: rest.startedAtMs, seconds: rest.totalSeconds });
  if (longest.key !== rest.startedAtMs || rest.totalSeconds > longest.seconds) {
    setLongest({ key: rest.startedAtMs, seconds: rest.totalSeconds });
  }
  const total = longest.key === rest.startedAtMs ? Math.max(longest.seconds, rest.totalSeconds) : rest.totalSeconds;
  const fraction = rest.go || total <= 0 ? 0 : Math.min(1, rest.secondsLeft / total);

  // The ring follows the clock smoothly between ticks (the prototype's 1 s linear transition).
  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.set(withTiming(fraction, { duration: DEVICE.REST_TICK, easing: Easing.linear }));
  }, [progress, fraction]);

  const { box, top } = restRingLayout(height);
  const scale = box / logGeometry.restRingBox;
  const r = device.restRingRadius * scale;
  const stroke = device.restRingStroke * scale;
  const circumference = 2 * Math.PI * r;
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(1, Math.max(0, progress.get()))),
  }));

  if (!current || !stage) {
    return null;
  }
  const next = restNextText(stage.values, durationIsMinutes(current.prescription));
  const center = box / 2;
  // The clock shrinks with the ring, so it keeps screen 08's margin inside the stroke.
  const clockSize =
    scale < 1
      ? { fontSize: Math.round(gadgetType.lcdBig.fontSize * scale), lineHeight: Math.round(gadgetType.lcdBig.lineHeight * scale) }
      : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.header}>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim]}>
          REST
        </Text>
        {next ? (
          <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim]}>
            {next}
          </Text>
        ) : null}
      </View>
      <View style={[styles.ring, { top, height: box }]}>
        <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
          <Circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={lcd.amberOff}
            strokeWidth={stroke}
            strokeDasharray={logGeometry.restRingDash}
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={lcd.amber}
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            transform={`rotate(-90 ${center} ${center})`}
            animatedProps={ringProps}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          {rest.go ? (
            <Blink>
              <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdBig, clockSize]}>
                GO
              </Text>
            </Blink>
          ) : (
            <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdBig, clockSize, styles.tabular]}>
              {rest.clock}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.footer, styles.restFooter]} pointerEvents="box-none">
        <LiftName name={current.prescription.name} dim onPress={onName} />
        <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim, styles.noShrink]}>
          {setLabel}
        </Text>
      </View>
    </View>
  );
}

/**
 * The ring's box and top in a display `height` tall: screen 08's 230 at y74 wherever it fits,
 * else as big as fits between the header and the footer (iPhone SE), centred.
 */
function restRingLayout(height: number): { box: number; top: number } {
  if (height <= 0) return { box: logGeometry.restRingBox, top: logGeometry.restRingTop };
  const footerTop = logGeometry.restFooterY + gadgetType.lcdSmall.lineHeight;
  const room = height - HEADER_BOTTOM - footerTop - 2 * logGeometry.restRingClear;
  const box = Math.min(logGeometry.restRingBox, room);
  return { box, top: Math.min(logGeometry.restRingTop, Math.round((height - box) / 2)) };
}

/** Blinking display text (`GO`): on for half the period, dim for the other half, as CSS steps(1). */
function Blink({ children }: { children: ReactNode }) {
  const blink = useSharedValue(1);
  useEffect(() => {
    const half = DEVICE.BLINK / 2;
    blink.set(
      withRepeat(
        withSequence(
          withDelay(half, withTiming(device.blinkDimOpacity, { duration: DEVICE.SNAP })),
          withDelay(half, withTiming(1, { duration: DEVICE.SNAP })),
        ),
        -1,
      ),
    );
  }, [blink]);
  const style = useAnimatedStyle(() => ({ opacity: blink.get() }));
  return <Animated.View style={style}>{children}</Animated.View>;
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
        <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, styles.dim, styles.shrink]}>
          {(day?.title ?? '').toUpperCase()}
        </Text>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdSmall, styles.dim, styles.noShrink]}>
          {`${minutes} MIN`}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdTitle, styles.finishTitle]}>
        {finishSummary.headline}
      </Text>
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
        <Text maxFontSizeMultiplier={1} style={gadgetType.lcdStat}>
          {finishSummary.setsText}
        </Text>
        {finishSummary.volumeText ? (
          <Text maxFontSizeMultiplier={1} style={gadgetType.lcdStat}>
            {finishSummary.volumeText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  drumHit: {
    position: 'absolute',
    left: device.drumFrameInset,
    right: device.drumFrameInset,
    height: device.drumFrameHeight,
  },
  assist: { position: 'absolute', right: device.displayPad },
  stepTag: { position: 'absolute', right: device.displayPad },
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
  footerFact: { marginBottom: device.lcdSmallBesideReps, flexShrink: 1 },
  restFooter: { bottom: logGeometry.restFooterY, alignItems: 'baseline' },
  ring: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center' },
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
