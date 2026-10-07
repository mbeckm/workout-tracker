import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { device, gadgetType, lcd, logGeometry, tourGeometry, tourType } from '@/constants/theme';
import { useScreen } from '@/device/finish';
import { useHaptics } from '@/device/haptics';
import { Drum, drumLayout, useDisplayHeight, type DrumNudge } from '@/device/parts';
import { LcdText, useScreenStyles } from '@/device/parts/lcd-text';
import { DEVICE } from '@/motion';

import { useTour } from './tour-context';
import { tourSetLamps } from './tour-model';

/** The log header: the lift name, then the set lamps (as the log display, decision 84). */
const HEADER_BOTTOM =
  device.displayHeaderY + gadgetType.lcdRow.lineHeight + logGeometry.nameSetGap + gadgetType.lcdSmall.lineHeight;

function weightText(value: number): string {
  return value.toFixed(1);
}

/**
 * The tour's display (decision 85): the practice set (or the rest ring) on top and Trim's chat at
 * the foot, the line before dim above the line being typed. A tap anywhere on the chat finishes
 * the line, then answers a line that waits for a tap (the blinking ▸). The first line also says
 * so, once. On the hello and the end the chat takes the whole display.
 */
export function TourDisplay({ onName }: { onName: () => void }) {
  const styles = useScreenStyles(baseStyles);
  const tour = useTour();
  const haptics = useHaptics();
  const height = useDisplayHeight();
  const { state } = tour;
  const full = state.screen === 'intro' || state.screen === 'ready';
  const waitsForTap = tour.typedLine.length === tour.line.length && tour.state.beat >= 0 && !tour.lit;
  const firstLine = state.beat === 0;

  const tap = () => {
    haptics.displayTap();
    tour.dispatch({ type: 'tap' });
  };

  const chat = (
    <Pressable
      onPress={tap}
      accessibilityRole="button"
      accessibilityLabel={tour.line}
      accessibilityHint={waitsForTap ? 'Continues' : undefined}
      style={full ? styles.chatFull : [styles.chat, { height: tourGeometry.chatHeight }]}>
      {state.previous ? (
        <LcdText numberOfLines={full ? undefined : 1} style={[full ? tourType.lcdChatLarge : tourType.lcdChat, styles.dim]}>
          {state.previous.toUpperCase()}
        </LcdText>
      ) : null}
      <LcdText style={full ? tourType.lcdChatLarge : tourType.lcdChat}>
        {tour.typedLine.toUpperCase()}
        {waitsForTap && !firstLine ? <Blinking>{'  ▸'}</Blinking> : null}
      </LcdText>
      {waitsForTap && firstLine ? (
        <LcdText style={tourType.lcdChat}>
          {'TAP MY SCREEN TO GO ON  '}
          <Blinking>▸</Blinking>
        </LcdText>
      ) : null}
    </Pressable>
  );

  if (full) {
    return (
      <Pressable accessible={false} onPress={tap} style={StyleSheet.absoluteFill}>
        {state.screen === 'ready' ? (
          <LcdText style={[tourType.lcdReady, styles.ready]}>READY</LcdText>
        ) : null}
        {chat}
      </Pressable>
    );
  }

  const contentHeight = Math.max(0, height - tourGeometry.chatHeight);
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* "Tap my screen": anywhere on the display goes on (the lift name keeps its own tap). */}
      <Pressable accessible={false} onPress={tap} style={[styles.content, { height: contentHeight }]}>
        {state.screen === 'rest' ? (
          <TourRest height={contentHeight} />
        ) : (
          <TourLog height={contentHeight} onName={onName} />
        )}
      </Pressable>
      {chat}
    </View>
  );
}

/** The practice set: name ▾ (framed while the swap waits), set lamps, the drum and the reps. */
function TourLog({ height, onName }: { height: number; onName: () => void }) {
  const styles = useScreenStyles(baseStyles);
  const tour = useTour();
  const { state } = tour;
  const lift = state.lifts[state.lift];
  const layout = drumLayout(height, HEADER_BOTTOM);
  const nudge = useNudge(state.weight);
  if (!lift) return null;
  const step = tour.loadStep;
  const lamps = tourSetLamps(state);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Drum
        current={weightText(state.weight)}
        above={layout.above ? weightText(state.weight + step) : undefined}
        below={layout.below && state.weight - step >= 0 ? weightText(state.weight - step) : undefined}
        nudge={nudge}
        layout={layout}
      />
      <View style={styles.header} pointerEvents="box-none">
        <View style={styles.nameRow} pointerEvents="box-none">
          <Pressable
            onPress={onName}
            accessibilityRole="button"
            accessibilityLabel={`${lift.name}. Opens the lift`}
            style={({ pressed }) => [styles.name, tour.lit === 'swap' && styles.nameFramed, pressed && styles.namePressed]}>
            <LcdText numberOfLines={1} style={gadgetType.lcdRow}>
              {`${lift.name.toUpperCase()} ▾`}
            </LcdText>
          </Pressable>
        </View>
        <View style={styles.setRow}>
          <View style={styles.setLamps}>
            {lamps.map((lamp, index) => (
              <View
                key={index}
                style={[styles.setLamp, lamp === 'done' ? styles.lampDone : lamp === 'on' ? styles.lampOn : styles.lampOff]}
              />
            ))}
          </View>
          <LcdText style={gadgetType.lcdSmall}>{`SET ${Math.min(state.logged + 1, state.setsPerLift)}/${state.setsPerLift}`}</LcdText>
        </View>
      </View>
      <View style={styles.footer} pointerEvents="none">
        <View style={styles.keysValue}>
          <LcdText style={gadgetType.lcdReps}>{String(state.reps)}</LcdText>
          <LcdText style={[gadgetType.lcdSmall, styles.besideReps]}>REPS</LcdText>
        </View>
        <LcdText style={[gadgetType.lcdSmall, styles.dim, styles.besideReps]}>PRACTICE</LcdText>
      </View>
    </View>
  );
}

/** The practice rest: `REST`, the ring and the clock, counting down for real. */
function TourRest({ height }: { height: number }) {
  const styles = useScreenStyles(baseStyles);
  const screen = useScreen();
  const tour = useTour();
  const left = tour.restLeft;
  const fraction = Math.min(1, left / Math.max(1, tour.state.restLongest));
  const box = Math.min(logGeometry.restRingBox, Math.max(0, height - HEADER_BOTTOM - logGeometry.restRingClear));
  const scale = box / logGeometry.restRingBox;
  const r = device.restRingRadius * scale;
  const stroke = device.restRingStroke * scale;
  const circumference = 2 * Math.PI * r;
  const center = box / 2;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.restHeader}>
        <LcdText style={[gadgetType.lcdSmall, styles.dim]}>REST</LcdText>
        <LcdText style={[gadgetType.lcdSmall, styles.dim]}>
          {`NEXT ${weightText(tour.state.weight)}×${tour.state.reps}`}
        </LcdText>
      </View>
      {box > 0 ? (
        <View style={[styles.ring, { top: HEADER_BOTTOM, height: box }]}>
          <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
            <Circle cx={center} cy={center} r={r} fill="none" stroke={screen.amberOff} strokeWidth={stroke} strokeDasharray={logGeometry.restRingDash} />
            <Circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={screen.amber}
              strokeWidth={stroke}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - fraction)}
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.centered]}>
            <LcdText style={[gadgetType.lcdBig, scale < 1 && { fontSize: Math.round(gadgetType.lcdBig.fontSize * scale), lineHeight: Math.round(gadgetType.lcdBig.lineHeight * scale) }]}>
              {clock}
            </LcdText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The drum's jump on each wheel notch, from the weight's change. */
function useNudge(weight: number): DrumNudge | null {
  const [nudge, setNudge] = useState<DrumNudge | null>(null);
  const last = useRef(weight);
  useEffect(() => {
    if (weight === last.current) return;
    const direction = weight > last.current ? 1 : -1;
    last.current = weight;
    setNudge((current) => ({ direction, id: (current?.id ?? 0) + 1 }));
  }, [weight]);
  return nudge;
}

/** Blinks a state that waits on the owner (trim-ui §8 rule 5), as `GO` does. */
function Blinking({ children }: { children: string }) {
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
  return <Animated.Text style={style}>{children}</Animated.Text>;
}

const baseStyles = StyleSheet.create({
  dim: { color: lcd.amberDim },
  content: { position: 'absolute', left: 0, right: 0, top: 0 },
  chat: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    bottom: 0,
    justifyContent: 'flex-end',
    gap: tourGeometry.chatGap,
    paddingTop: tourGeometry.chatTop,
    paddingBottom: device.displayFooterY,
    borderTopWidth: tourGeometry.chatRuleWidth,
    borderStyle: 'dotted',
    borderColor: lcd.amberOff,
    overflow: 'hidden',
  },
  chatFull: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayPad,
    bottom: device.displayPad,
    justifyContent: 'flex-end',
    gap: tourGeometry.chatGap * 2,
  },
  ready: { position: 'absolute', left: device.displayPad, top: device.displayPad },
  header: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    gap: logGeometry.nameSetGap,
  },
  nameRow: { flexDirection: 'row' },
  name: {
    flexShrink: 1,
    paddingHorizontal: logGeometry.namePadX,
    paddingVertical: logGeometry.namePadY,
    marginHorizontal: -logGeometry.namePadX,
    marginVertical: -logGeometry.namePadY,
    borderRadius: logGeometry.nameRadius,
    borderCurve: 'continuous',
    borderWidth: device.drumFrameStroke,
    borderColor: 'transparent',
  },
  nameFramed: { borderColor: lcd.amber },
  namePressed: { backgroundColor: lcd.amberPress },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: logGeometry.setLampLabelGap },
  setLamps: { flexDirection: 'row', alignItems: 'center', gap: logGeometry.setLampGap },
  setLamp: { width: logGeometry.setLampWidth, height: logGeometry.setLampHeight, borderRadius: logGeometry.setLampHeight / 2 },
  lampDone: { backgroundColor: lcd.amber, boxShadow: `0 0 6px ${lcd.amber}` },
  lampOn: { borderWidth: device.drumFrameStroke, borderColor: lcd.amber },
  lampOff: { backgroundColor: lcd.amberOff },
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
  keysValue: { flexDirection: 'row', alignItems: 'flex-end', gap: logGeometry.repsUnitGap },
  besideReps: { marginBottom: device.lcdSmallBesideReps },
  restHeader: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ring: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
