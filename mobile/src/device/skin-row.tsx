import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import {
  bodyFinish,
  device,
  deviceObject,
  finishColors,
  fontScaleCap,
  gadgetType,
  lcd,
  sheetColors,
  sheetGeometry,
  space,
  tourColors,
  tourGeometry,
} from '@/constants/theme';
import type { Finish, FinishLock } from '@/domain/finish';
import { trainableDays } from '@/domain/plan-loop';
import { DEVICE_OBJECT_HEIGHT, DeviceObject, offLamps } from '@/device/device-object';
import { FinishProvider } from '@/device/finish';
import type { LampState } from '@/device/parts';
import { LcdText, useScreenStyles } from '@/device/parts/lcd-text';
import { PillButton } from '@/device/sheets/primitives';
import { DEVICE, SPRING } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

/*
 * The row of machines (decisions 95, 97): every skin as the whole machine, side by side; a swipe
 * (or a tap on a neighbour or a dot) brings another to the middle, and the one in the middle is
 * the pick. Under it the foot: what the pick is, a dot per skin (a padlock on a locked one) and
 * the pill. Shared by the tour's gift and the Skin Library.
 *
 * Cheap on purpose: each machine is drawn once in its own skin and never re-rendered by a pick;
 * where it sits, its size and how dim it is come from `pos` and `z` on the UI thread. A pick
 * re-renders only the foot.
 */

const OBJECT_W = deviceObject.width;
const OBJECT_H = DEVICE_OBJECT_HEIGHT;
/** The pivot each machine hangs on: a 2-pt square, never zero (iOS mis-centres a 0 × 0 view's scale). */
const PIVOT = 2;

export type SkinRowPill = {
  title: string;
  variant: 'light' | 'dark';
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
};

type Frame = {
  /** The middle machine's scale and centre at full size (`z` 0) and stepped back into the row (1). */
  s0: number;
  s1: number;
  cy0: number;
  cy1: number;
  /** The middle slot's centre, and the distance between slots. */
  cx: number;
  step: number;
};

export function SkinRow({
  row,
  pick,
  pos,
  z,
  enabled,
  onPass,
  lockOf,
  label,
  pill,
  top,
  bottom,
  full,
  sparkle,
  style,
  children,
}: {
  row: readonly Finish[];
  /** The machine in the middle (the foot, the dots, VoiceOver). */
  pick: Finish;
  /** The row's middle, in machines (fractional while it moves). */
  pos: SharedValue<number>;
  /** 0: the middle machine at full size (the gift's reveal); 1: stepped back into the row. */
  z: SharedValue<number>;
  enabled: boolean;
  /** A machine reached the middle. */
  onPass: (finish: Finish) => void;
  lockOf: (finish: Finish) => FinishLock | null;
  label: string;
  pill: SkinRowPill;
  /** Room above the stepped-back row, and under the pill. */
  top: number;
  bottom: number;
  /** The full-size machine's insets (`z` 0): the safe area. Without it the row is always stepped back. */
  full?: { top: number; bottom: number };
  /** Graphite unlocked (decision 97): sparkles round this machine as `progress` runs 0 → 1, once. */
  sparkle?: { finish: Finish; progress: SharedValue<number> };
  style?: StyleProp<ViewStyle>;
  /** Drawn over everything (the gift's tap-to-skip). */
  children?: ReactNode;
}) {
  const { activePlan } = useWorkoutStore();
  const reduceMotion = useReducedMotion();
  const last = row.length - 1;
  const days = activePlan ? trainableDays(activePlan).length : 0;
  const lamps = useMemo(() => offLamps(days), [days]);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [footTop, setFootTop] = useState<number | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current?.width === width && current.height === height ? current : { width, height }));
  };
  const onFoot = (event: LayoutChangeEvent) => setFootTop(event.nativeEvent.layout.y);

  const frame = useMemo<Frame | null>(() => {
    if (!size) return null;
    const { width, height } = size;
    const rowBottom = Math.max(top + 1, (footTop ?? height) - space.gutter);
    const s1 = Math.min((width * tourGeometry.cardWidth) / OBJECT_W, (rowBottom - top) / OBJECT_H);
    const cy1 = (top + rowBottom) / 2;
    return {
      s0: full ? Math.min(width / OBJECT_W, (height - full.top - full.bottom) / OBJECT_H) : s1,
      s1,
      cy0: full ? height / 2 : cy1,
      cy1,
      cx: width / 2,
      step: OBJECT_W * s1 + tourGeometry.cardGap,
    };
  }, [footTop, full, size, top]);

  const fade = useSharedValue(1);

  // The machine in the middle is the pick.
  const passRef = useRef(onPass);
  useEffect(() => {
    passRef.current = onPass;
  }, [onPass]);
  const pass = useCallback((index: number) => passRef.current(row[index]), [row]);
  useAnimatedReaction(
    () => Math.min(last, Math.max(0, Math.round(pos.get()))),
    (now, previous) => {
      if (previous != null && now !== previous) scheduleOnRN(pass, now);
    },
  );

  /** Bring machine `target` to the middle: a spring, or under Reduce Motion a crossfade. */
  const goTo = useMemo(
    () => (target: number, velocity: number) => {
      'worklet';
      if (reduceMotion) {
        fade.set(
          withTiming(0, { duration: DEVICE.TOUR_FADE / 2 }, (finished) => {
            if (!finished) return;
            pos.set(target);
            fade.set(withTiming(1, { duration: DEVICE.TOUR_FADE / 2 }));
          }),
        );
        return;
      }
      pos.set(withSpring(target, { ...SPRING.fling, velocity }));
    },
    [fade, pos, reduceMotion],
  );

  // Made once per layout, not per render: a pick re-renders the foot mid-swipe, and a new gesture
  // object there would drop the finger's pan before it settles.
  const step = frame?.step ?? 1;
  const width = size?.width ?? 0;
  const dragging = useSharedValue(0);
  const start = useSharedValue(0);
  const gesture = useMemo(() => {
    const band = (raw: number) => {
      'worklet';
      const give = (excess: number) =>
        tourGeometry.swipeBandMax * (1 - 1 / (1 + (excess * tourGeometry.swipeBand) / tourGeometry.swipeBandMax));
      if (raw > last) return last + give(raw - last);
      if (raw < 0) return -give(-raw);
      return raw;
    };
    const clampIndex = (value: number) => {
      'worklet';
      return Math.min(last, Math.max(0, Math.round(value)));
    };
    const pan = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX([-space.related, space.related])
      // A pull down belongs to the sheet the row sits in (the Skin Library).
      .failOffsetY([-space.inset, space.inset])
      // From activation, not touch-down: a tap (a neighbour) must not stop a row that's still settling.
      .onStart(() => {
        cancelAnimation(pos);
        start.set(pos.get());
        dragging.set(1);
      })
      .onUpdate((event) => {
        pos.set(band(start.get() - event.translationX / step));
      })
      .onEnd((event) => {
        dragging.set(0);
        const velocity = -event.velocityX / step;
        goTo(clampIndex(pos.get() + velocity * tourGeometry.swipeThrow), velocity);
      })
      // A pan that ends any other way (cancelled, interrupted) still clicks into a machine.
      .onFinalize(() => {
        if (dragging.get() === 0) return;
        dragging.set(0);
        goTo(clampIndex(pos.get()), 0);
      });
    const tap = Gesture.Tap()
      .enabled(enabled)
      .onEnd((event) => {
        const offset = Math.round((event.x - width / 2) / step);
        if (offset === 0) return;
        goTo(clampIndex(Math.round(pos.get()) + offset), 0);
      });
    return Gesture.Race(pan, tap);
  }, [dragging, enabled, goTo, last, pos, start, step, width]);

  const index = Math.max(0, row.indexOf(pick));
  const jump = (target: number) => goTo(target, 0);
  const onAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    const next = name === 'increment' ? index + 1 : name === 'decrement' ? index - 1 : index;
    if (next >= 0 && next <= last && next !== index) jump(next);
  };

  const footStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (z.get() - tourGeometry.footFrom) / (1 - tourGeometry.footFrom)));
    return { opacity: t };
  });
  const rowStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const lock = lockOf(pick);
  const name = finishColors[pick].name;

  return (
    <View style={[styles.fill, style]} onLayout={onLayout}>
      {frame ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, rowStyle]}>
          {row.map((id, i) => (
            <SkinMachine key={id} id={id} index={i} lamps={lamps} z={z} pos={pos} frame={frame} />
          ))}
          {sparkle && !reduceMotion ? (
            <Sparkles index={Math.max(0, row.indexOf(sparkle.finish))} progress={sparkle.progress} pos={pos} frame={frame} />
          ) : null}
        </Animated.View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Skin"
          accessibilityValue={{ text: `${pick}, ${name}${lock === 'pro' ? ', Trim Pro' : ''}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
          style={[styles.swipe, { height: footTop ?? 0 }]}
        />
      </GestureDetector>
      <Animated.View onLayout={onFoot} style={[styles.foot, { paddingBottom: bottom }, footStyle]}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.sectionLabel, styles.label]}>
          {label}
        </Text>
        <View style={styles.dots}>
          {row.map((id, i) => (
            <SkinDot key={id} id={id} selected={id === pick} locked={lockOf(id) != null} onPress={() => jump(i)} />
          ))}
        </View>
        <PillButton
          title={pill.title}
          variant={pill.variant}
          disabled={pill.disabled}
          onPress={pill.onPress}
          testID={pill.testID}
        />
      </Animated.View>
      {children}
    </View>
  );
}

/**
 * One machine in the row. The moving view is a 2-pt pivot at the machine's centre, the machine
 * hung around it, so where the scale is centred can be off by a point at most (a full-size view
 * sometimes scaled about its top-left on iOS, and a 0 × 0 one shifted every machine).
 */
const SkinMachine = memo(function SkinMachine({
  id,
  index,
  lamps,
  z,
  pos,
  frame,
}: {
  id: Finish;
  index: number;
  lamps: readonly LampState[];
  z: SharedValue<number>;
  pos: SharedValue<number>;
  frame: Frame;
}) {
  const style = useAnimatedStyle(() => {
    const t = z.get();
    const s = frame.s0 + (frame.s1 - frame.s0) * t;
    const cy = frame.cy0 + (frame.cy1 - frame.cy0) * t;
    const d = index - pos.get();
    const near = Math.min(1, Math.abs(d));
    const drawn = Math.abs(d) <= tourGeometry.cardsDrawn ? 1 : 0;
    return {
      opacity: drawn * (1 - near * (1 - tourGeometry.sideOpacity * t)),
      transform: [
        { translateX: frame.cx + d * (OBJECT_W * s + tourGeometry.cardGap) },
        { translateY: cy },
        { scale: s * (1 - (1 - tourGeometry.sideScale) * near) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.pivot, style]}>
      <View style={styles.card}>
        <FinishProvider override={id}>
          <DeviceObject
            scale={1}
            displayKey={id}
            display={<SkinScreen id={id} />}
            lamps={lamps}
            accessibilityLabel={`Skin ${id}, ${finishColors[id].name}`}
          />
        </FinishProvider>
      </View>
    </Animated.View>
  );
});

/** The machine's display in the row: its number, then its name. */
function SkinScreen({ id }: { id: Finish }) {
  const s = useScreenStyles(screenStyles);
  return (
    <View style={s.fill}>
      <LcdText lines={1} style={[gadgetType.lcdSmall, s.dim, s.header]}>
        {`SKIN ${id}`}
      </LcdText>
      <View style={s.center}>
        <LcdText lines={1} adjustsFontSizeToFit style={gadgetType.lcdTitle}>
          {finishColors[id].name.toUpperCase()}
        </LcdText>
      </View>
    </View>
  );
}

/**
 * Where the eight sparkles sit round the machine, as shares of its half width and half height
 * (± beyond 1 is outside it), and in which order they twinkle.
 */
const SPARKLE_AT = [
  [-1, -0.62],
  [1, -0.9],
  [0.35, -1],
  [-1, 0.28],
  [1, 0.12],
  [-0.4, 1],
  [1, 0.78],
  [-0.15, -1],
] as const;

/**
 * Graphite unlocked (decision 97): eight pixel sparkles, plus signs drawn in the display's white
 * and the brand amber, twinkle round the new machine once (each scales up and out over
 * `TOUR_SPARKLE_EACH`, staggered over `TOUR_SPARKLE`). One shared value drives all of them on the
 * UI thread; they follow the machine if the row moves, and fade as it leaves the middle.
 */
function Sparkles({
  index,
  progress,
  pos,
  frame,
}: {
  index: number;
  progress: SharedValue<number>;
  pos: SharedValue<number>;
  frame: Frame;
}) {
  return (
    <>
      {SPARKLE_AT.map(([x, y], i) => (
        <Sparkle key={i} order={i} x={x} y={y} index={index} progress={progress} pos={pos} frame={frame} />
      ))}
    </>
  );
}

function Sparkle({
  order,
  x,
  y,
  index,
  progress,
  pos,
  frame,
}: {
  order: number;
  x: number;
  y: number;
  index: number;
  progress: SharedValue<number>;
  pos: SharedValue<number>;
  frame: Frame;
}) {
  const halfW = (OBJECT_W * frame.s1) / 2;
  const halfH = (OBJECT_H * frame.s1) / 2;
  const left = frame.cx + x * halfW + Math.sign(x) * tourGeometry.sparkleOut * Math.abs(x);
  const top = frame.cy1 + y * halfH + Math.sign(y) * tourGeometry.sparkleOut * Math.abs(y);
  const each = DEVICE.TOUR_SPARKLE_EACH / DEVICE.TOUR_SPARKLE;
  const delay = (order / (SPARKLE_AT.length - 1)) * (1 - each);
  const style = useAnimatedStyle(() => {
    const local = (progress.get() - delay) / each;
    const on = local <= 0 || local >= 1 ? 0 : Math.sin(local * Math.PI);
    const d = index - pos.get();
    const here = 1 - Math.min(1, Math.abs(d));
    return {
      opacity: on * here,
      transform: [
        { translateX: left + d * frame.step },
        { translateY: top },
        { scale: on },
      ],
    };
  });
  const color = order % 2 === 0 ? tourColors.sparkleLight : tourColors.sparkleWarm;
  return (
    <Animated.View style={[styles.sparkle, style]}>
      <View style={[styles.sparkleBarH, { backgroundColor: color }]} />
      <View style={[styles.sparkleBarV, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/** A skin dot under the row: the machine's body colours, ringed when it's in the middle, a padlock when it's locked. */
function SkinDot({
  id,
  selected,
  locked,
  onPress,
}: {
  id: Finish;
  selected: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const colors = finishColors[id];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Skin ${id}, ${colors.name}${locked ? ', locked' : ''}`}
      style={styles.dotHit}>
      <View style={[styles.ring, selected && styles.ringOn]}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: colors.body2,
              experimental_backgroundImage: colors.bodyStops
                ? `linear-gradient(${bodyFinish.holoAngle}deg, ${colors.bodyStops.join(', ')})`
                : `linear-gradient(180deg, ${colors.body1}, ${colors.body2})`,
            },
          ]}
        />
      </View>
      {locked ? (
        <View style={styles.lock}>
          <LockGlyph />
        </View>
      ) : null}
    </Pressable>
  );
}

/** A padlock: the shackle over the body (22-unit grid, like the key glyphs). */
function LockGlyph() {
  const size = tourGeometry.lockGlyph;
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path d="M6.5 10 V7 a4.5 4.5 0 0 1 9 0 V10" fill="none" stroke={sheetColors.ink} strokeWidth={3} />
      <Rect x={3} y={10} width={16} height={11} rx={2.5} fill={sheetColors.ink} />
    </Svg>
  );
}

const RING = tourGeometry.dotSize + (tourGeometry.dotRing + tourGeometry.dotRingGap) * 2;
const BADGE = tourGeometry.lockBadge;
const ARM = tourGeometry.sparkleArm;
const PIXEL = tourGeometry.sparklePixel;

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  pivot: { position: 'absolute', left: -PIVOT / 2, top: -PIVOT / 2, width: PIVOT, height: PIVOT },
  card: {
    position: 'absolute',
    left: (PIVOT - OBJECT_W) / 2,
    top: (PIVOT - OBJECT_H) / 2,
    width: OBJECT_W,
    height: OBJECT_H,
  },
  sparkle: { position: 'absolute', left: -ARM / 2, top: -ARM / 2, width: ARM, height: ARM },
  sparkleBarH: { position: 'absolute', left: 0, top: (ARM - PIXEL) / 2, width: ARM, height: PIXEL },
  sparkleBarV: { position: 'absolute', top: 0, left: (ARM - PIXEL) / 2, width: PIXEL, height: ARM },
  swipe: { position: 'absolute', left: 0, right: 0, top: 0 },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: space.related,
    paddingHorizontal: sheetGeometry.sidePad + sheetGeometry.sectionX,
  },
  label: { color: lcd.amber },
  dots: { flexDirection: 'row', gap: tourGeometry.dotGap },
  dotHit: { width: tourGeometry.dotHit, height: tourGeometry.dotHit, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { borderWidth: tourGeometry.dotRing, borderColor: sheetColors.ring },
  dot: { width: tourGeometry.dotSize, height: tourGeometry.dotSize, borderRadius: tourGeometry.dotSize / 2 },
  lock: {
    position: 'absolute',
    right: (tourGeometry.dotHit - RING) / 2,
    bottom: (tourGeometry.dotHit - RING) / 2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: sheetColors.sheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const screenStyles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { color: lcd.amberDim },
  // As Home's header: inset from the display's edges, clear of its corners.
  header: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: device.displayHeaderY },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
