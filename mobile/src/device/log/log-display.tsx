import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { device, gadgetType, lcd, logGeometry } from '@/constants/theme';
import { LcdText, useScreenStyles } from '@/device/parts/lcd-text';
import { Drum, drumLayout, useDisplayHeight, type DrumLayout, type DrumNudge } from '@/device/parts';
import { durationIsMinutes } from '@/domain/helpers';
import { sessionDurationMinutes } from '@/domain/log-session';
import { DEVICE } from '@/motion';

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

/** The log header: the lift name (`lcdRow`), then the set lamps and `SET 2/4`. */
const LOG_HEADER_BOTTOM =
  device.displayHeaderY + gadgetType.lcdRow.lineHeight + logGeometry.nameSetGap + gadgetType.lcdSmall.lineHeight;

/** `ASSIST` rides the step above; without it it sits midway between the header and the frame. */
function assistY(layout: DrumLayout): number {
  return layout.above
    ? device.drumAboveY + layout.offset
    : Math.round((LOG_HEADER_BOTTOM + layout.frameY - gadgetType.lcdSmall.lineHeight) / 2);
}

/** The set lamps (`setLamps`): done lit, the set on the display outlined, the rest off. */
function SetLamps({ lamps }: { lamps: readonly SetLampState[] }) {
  const styles = useScreenStyles(baseStyles);
  const layout = setLampLayout(lamps.length);
  if (layout === 'none' || lamps.length === 0) {
    return null;
  }
  const compact = layout === 'compact';
  const size = { width: compact ? logGeometry.setLampWidthCompact : logGeometry.setLampWidth };
  return (
    <View style={[styles.setLamps, { gap: compact ? logGeometry.setLampGapCompact : logGeometry.setLampGap }]}>
      {lamps.map((lamp, index) => (
        <View
          key={index}
          style={[styles.setLamp, size, lamp === 'done' ? styles.gridOn : lamp === 'on' ? styles.setLampOn : styles.gridOff]}
        />
      ))}
    </View>
  );
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
 * Log (screens 04, 05, 09; decision 84): the lift name ▾ (`lcdRow`), the set lamps and the set
 * label, the drum (the wheel's value, already the target when targets show), the keys' value
 * (`6 REPS`) and last time (`LAST 80×8`, else the locked `TARGET ›`), on one bottom line.
 * Tapping the drum cycles the lift's wheel step, shown as `±2` under the frame (80);
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
  const styles = useScreenStyles(baseStyles);
  const { current, drum, keys, setLabel, setLamps, footer, controls, loadStep, unlockTargets } = useLogSession();
  const height = useDisplayHeight();
  const layout = drumLayout(height, LOG_HEADER_BOTTOM);
  const tagY = loadStep ? stepTagY(layout, height) : null;
  if (!current || !drum || !controls) {
    return null;
  }
  // Bodyweight puts reps on the drum; the keys step the same value, so it shows once.
  const keysValue = controls.keys && controls.keys !== controls.drum ? keys : null;

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
        <LcdText
          style={[gadgetType.lcdSmall, !loadStep.chosen && styles.dim, styles.stepTag, { top: tagY }]}>
          {loadStep.text}
        </LcdText>
      ) : null}
      <View style={[styles.header, styles.logHeader]} pointerEvents="box-none">
        <View style={styles.nameRow} pointerEvents="box-none">
          <LiftName name={current.prescription.name} large onPress={onName} />
        </View>
        <View style={styles.setRow}>
          <SetLamps lamps={setLamps} />
          <LcdText numberOfLines={1} style={gadgetType.lcdSmall}>
            {setLabel}
          </LcdText>
        </View>
      </View>
      {drum.header ? (
        <LcdText style={[gadgetType.lcdSmall, styles.dim, styles.assist, { top: assistY(layout) }]}>
          {drum.header}
        </LcdText>
      ) : null}
      <View style={styles.footer} pointerEvents="box-none">
        <View style={styles.keysValue}>
          <LcdText numberOfLines={1} style={gadgetType.lcdReps}>
            {keysValue?.value ?? ''}
          </LcdText>
          {keysValue?.unit ? (
            <LcdText style={[gadgetType.lcdSmall, styles.besideReps]}>
              {keysValue.unit}
            </LcdText>
          ) : null}
        </View>
        {footer?.text ? (
          footer.targetLocked ? (
            <Pressable
              accessible={false}
              hitSlop={device.displayFooterY}
              onPress={() => void unlockTargets()}
              style={({ pressed }) => [styles.footerFact, pressed && styles.namePressed]}>
              <LcdText style={[gadgetType.lcdSmall, styles.dim]}>
                {footer.text}
              </LcdText>
            </Pressable>
          ) : (
            <LcdText numberOfLines={1} style={[gadgetType.lcdSmall, styles.footerFact]}>
              {footer.text}
            </LcdText>
          )
        ) : null}
      </View>
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
  besideReps: { marginBottom: device.lcdSmallBesideReps },
  keysValue: { flexDirection: 'row', alignItems: 'flex-end', gap: logGeometry.repsUnitGap, flexShrink: 0 },
  logHeader: { flexDirection: 'column', justifyContent: 'flex-start', gap: logGeometry.nameSetGap },
  nameRow: { flexDirection: 'row' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: logGeometry.setLampLabelGap },
  setLamps: { flexDirection: 'row', alignItems: 'center' },
  setLamp: { height: logGeometry.setLampHeight, borderRadius: logGeometry.setLampHeight / 2 },
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
