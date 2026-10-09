import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import {
  fontScaleCap,
  gadgetType,
  importColors as C,
  importGeometry as G,
  importType,
  lcd,
  signal,
  space,
} from '@/constants/theme';
import { DURATION, IMPORT, PRESS_SCALE } from '@/motion';

/** A clock for a looping demo: ms since it started, ticking every `tick`. Still under Reduce Motion. */
function useLoopClock(period: number, tick: number): number | null {
  const reduceMotion = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) % period), tick);
    return () => clearInterval(timer);
  }, [period, reduceMotion, tick]);
  return reduceMotion ? null : elapsed;
}

/** One press of a round key each time `pulse` changes. */
function usePress(pulse: number) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || pulse < 0) return;
    y.set(withSequence(withTiming(G.keyLip, { duration: IMPORT.KEY_DOWN }), withTiming(0, { duration: IMPORT.KEY_DOWN * 2 })));
  }, [pulse, reduceMotion, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
}

/**
 * New plan's two choices (decision 88) as small Trim machines: a metal face, an amber display and
 * Trim's own round key. Each card's display shows what the choice does, on a quiet loop.
 */
/** What every card takes: its words (onboarding asks the question its own way) and, as a radio, `selected`. */
export type DeviceCardProps = {
  onPress: () => void;
  title?: string;
  sub?: string;
  /** Onboarding's radios: the orange selection ring. Leave undefined for a button. */
  selected?: boolean;
  testID?: string;
};

function DeviceCard({
  title,
  sub,
  onPress,
  selected,
  children,
  testID,
}: {
  title: string;
  sub: string;
  onPress: () => void;
  selected?: boolean;
  children: ReactNode;
  testID: string;
}) {
  const radio = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: selected } : undefined}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && !selected && styles.pressed]}>
      {children}
      <View style={styles.titles}>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={importType.forkTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={[importType.forkSub, styles.sub]}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

const SOURCES = [
  { name: 'Note', tile: C.sourceNote, ink: C.sourceNoteInk, icon: 'M7 7h10M7 12h10M7 17h6', lift: 'BENCH PRESS', chip: '4×8' },
  {
    name: 'AI chat',
    tile: C.sourceAi,
    ink: C.sourceAiInk,
    icon: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 20 12z',
    lift: 'BACK SQUAT',
    chip: '4×5',
  },
  { name: 'Workout app', tile: C.sourceApp, ink: C.sourceAppInk, icon: 'M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12', lift: 'BARBELL ROW', chip: '3×10' },
] as const;

/**
 * Import plan: a note, an AI chat and another workout app sit along the top and take turns; the
 * one on turn is ringed, the arrow under it brightens and nudges down, and its lift lands on Trim's
 * display at the bottom.
 */
export function ImportDeviceCard({ onPress, title = 'Import plan', sub = 'From a note, an AI chat or another app', selected, testID = 'new-plan-import' }: DeviceCardProps) {
  const clock = useLoopClock(IMPORT.SOURCE_STEP * SOURCES.length, DURATION.change);
  const turn = clock == null ? SOURCES.length - 1 : Math.floor(clock / IMPORT.SOURCE_STEP);
  const push = usePress(clock == null ? -1 : turn);
  // The display is as tall as the card leaves it. Lines are whole rows (G.displayRow), so it shows
  // as many as fit, newest last; a line is never cut by the display's edge.
  const [fit, setFit] = useState(0);
  const landed = SOURCES.slice(0, turn + 1);
  const shown = fit > 0 ? landed.slice(-fit) : [];

  return (
    <DeviceCard title={title} sub={sub} onPress={onPress} selected={selected} testID={testID}>
      <View style={styles.importArt}>
        <View style={styles.sources}>
          {SOURCES.map((source, index) => {
            const on = clock != null && index === turn;
            return (
              <View key={source.name} style={styles.sourceColumn}>
                <View style={[styles.chip, on && styles.chipOn]}>
                  <View style={[styles.tile, { backgroundColor: source.tile }]}>
                    <Svg width={G.sourceTile - space.related} height={G.sourceTile - space.related} viewBox="0 0 24 24" fill="none" stroke={source.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <Path d={source.icon} />
                    </Svg>
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={fontScaleCap.display} style={importType.sourceName}>
                    {source.name}
                  </Text>
                </View>
                <Animated.View style={on ? push : undefined}>
                  <Svg width={G.arrow} height={G.arrow} viewBox="0 0 24 24" fill="none" stroke={on ? C.arrowOn : C.arrow} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 4v15M6 13l6 6 6-6" />
                  </Svg>
                </Animated.View>
              </View>
            );
          })}
        </View>
        <View style={styles.display} onLayout={(event) => {
            const free = event.nativeEvent.layout.height - 2 * G.displayPad - gadgetType.lcdMeta.lineHeight;
            setFit(Math.max(0, Math.floor(free / (G.displayRow + space.tight))));
          }}>
          <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdMeta, styles.dim]}>
            TRIM
          </Text>
          {shown.map((source) => (
            <Animated.View
              key={`${source.name}-${clock == null ? 'still' : 'loop'}`}
              entering={clock == null ? undefined : FadeInUp.duration(DURATION.change)}
              style={styles.landed}>
              <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdSmall, styles.liftName]}>
                {source.lift}
              </Text>
              <Text maxFontSizeMultiplier={fontScaleCap.display} style={gadgetType.lcdMeta}>
                {source.chip}
              </Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </DeviceCard>
  );
}

const LIFTS = [
  { name: 'BENCH PRESS', chip: '3×8' },
  { name: 'BARBELL ROW', chip: '3×10' },
  { name: 'SQUAT', chip: '4×5' },
] as const;

/**
 * Build one: each press of the + key adds the next lift to Day 1, typed a letter at a time, its
 * sets × reps landing after it; `+ ADD LIFT` and its cursor move down a row each time.
 */
export function BuildDeviceCard({ onPress, title = 'Build one', sub = 'Add your lifts one by one', selected, testID = 'new-plan-build' }: DeviceCardProps) {
  // One extra step at the end holds the full day before it starts over.
  const clock = useLoopClock(IMPORT.LIFT_STEP * (LIFTS.length + 1), IMPORT.TYPE_CHAR);
  const added = clock == null ? LIFTS.length : Math.min(LIFTS.length, Math.floor(clock / IMPORT.LIFT_STEP));
  const typed = clock == null ? 0 : Math.floor((clock % IMPORT.LIFT_STEP) / IMPORT.TYPE_CHAR);
  const typing = added < LIFTS.length ? LIFTS[added] : null;
  const press = usePress(clock == null || !typing ? -1 : added);

  const reduceMotion = useReducedMotion();
  const cursor = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    cursor.set(withRepeat(withTiming(0, { duration: IMPORT.BREATHE }), -1, true));
  }, [cursor, reduceMotion]);
  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursor.get() }));

  return (
    <DeviceCard title={title} sub={sub} onPress={onPress} selected={selected} testID={testID}>
      <View style={[styles.display, styles.buildDisplay]}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdMeta, styles.dim]}>
          DAY 1
        </Text>
        {LIFTS.slice(0, added).map((lift) => (
          <LiftRow key={lift.name} name={lift.name} chip={lift.chip} />
        ))}
        {typing && typed > 0 ? <LiftRow name={typing.name.slice(0, typed)} chip={typed >= typing.name.length ? typing.chip : null} /> : null}
        <View style={styles.row}>
          <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdSmall, styles.dim]}>
            + ADD LIFT
            <Animated.Text style={[gadgetType.lcdSmall, cursorStyle]}>_</Animated.Text>
          </Text>
        </View>
      </View>
      <Animated.View style={[styles.sideKey, press]} accessible={false}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={importType.keyGlyph}>
          +
        </Text>
      </Animated.View>
    </DeviceCard>
  );
}

function LiftRow({ name, chip }: { name: string; chip: string | null }) {
  return (
    <View style={styles.row}>
      <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdSmall, styles.liftName]}>
        {name}
      </Text>
      {chip ? (
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdMeta, styles.liftChip]}>
          {chip}
        </Text>
      ) : null}
    </View>
  );
}

const STARTERS = [
  { name: 'UPPER LOWER', days: '4 DAYS' },
  { name: 'PUSH PULL LEGS', days: '3 DAYS' },
  { name: 'FULL BODY', days: '3 DAYS' },
] as const;

/**
 * Onboarding's Pick one for me: Trim's starter plans on the display, the one under the cursor
 * stepping down the list the way a dial would.
 */
export function StarterDeviceCard({ onPress, title = 'Pick one for me', sub = 'Starter plans', selected, testID = 'starter-plans' }: DeviceCardProps) {
  const clock = useLoopClock(IMPORT.SOURCE_STEP * STARTERS.length, DURATION.change);
  const on = clock == null ? 0 : Math.floor(clock / IMPORT.SOURCE_STEP);
  return (
    <DeviceCard title={title} sub={sub} onPress={onPress} selected={selected} testID={testID}>
      <View style={styles.display}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdMeta, styles.dim]}>
          STARTER PLANS
        </Text>
        {STARTERS.map((plan, index) => (
          <View key={plan.name} style={styles.row}>
            <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdSmall, styles.liftName, index !== on && styles.dim]}>
              {index === on ? '▸ ' : '  '}
              {plan.name}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.lcdMeta, index !== on && styles.dim]}>
              {plan.days}
            </Text>
          </View>
        ))}
      </View>
    </DeviceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: G.deviceRadius,
    borderCurve: 'continuous',
    experimental_backgroundImage: `linear-gradient(180deg, ${C.deviceHi}, ${C.deviceLo})`,
    padding: G.devicePad,
    gap: space.related + space.tight,
  },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
  selected: { boxShadow: `inset 0 0 0 ${G.selectedRing}px ${signal.orange}` },
  titles: { gap: space.pair, paddingHorizontal: space.tight, paddingBottom: space.tight },
  sub: { color: C.deviceSub },
  importArt: { flex: 1, gap: space.tight },
  sources: { flexDirection: 'row', gap: space.related },
  sourceColumn: { flex: 1, alignItems: 'center', gap: space.tight },
  chip: {
    alignSelf: 'stretch',
    height: G.sourceChip,
    borderRadius: G.sourceChipRadius,
    borderCurve: 'continuous',
    backgroundColor: C.sourceChip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.tight,
    paddingHorizontal: space.tight,
  },
  chipOn: { boxShadow: `inset 0 0 0 2px ${C.sourceRing}` },
  landed: { height: G.displayRow, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.related },
  tile: {
    width: G.sourceTile,
    height: G.sourceTile,
    borderRadius: G.sourceTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  display: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: G.displayRadius,
    borderCurve: 'continuous',
    backgroundColor: lcd.lcd,
    boxShadow: `inset 0 2px 8px ${lcd.lcdShade}`,
    padding: G.displayPad,
    gap: space.tight,
    overflow: 'hidden',
  },
  buildDisplay: { gap: space.tight },
  dim: { color: lcd.amberDim },
  row: { height: G.displayRow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.related },
  liftName: { flexShrink: 1 },
  liftChip: { color: lcd.amber },
  sideKey: {
    position: 'absolute',
    right: G.devicePad + space.tight,
    bottom: G.devicePad + space.tight,
    width: G.sideKey,
    height: G.sideKey,
    borderRadius: G.sideKey / 2,
    experimental_backgroundImage: `radial-gradient(circle at 40% 35%, ${C.keyHi}, ${C.keyLo})`,
    boxShadow: `0 ${G.keyLip}px 0 ${C.keyLip}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
