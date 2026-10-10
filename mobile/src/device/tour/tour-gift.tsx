import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  bodyFinish,
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
import { EARNED_FINISH, FINISHES, FREE_FINISHES, finishLock, type Finish } from '@/domain/finish';
import { trainableDays } from '@/domain/plan-loop';
import { DEVICE_OBJECT_HEIGHT, DeviceObject, offLamps } from '@/device/device-object';
import { FinishProvider } from '@/device/finish';
import type { LampState } from '@/device/parts';
import { LcdText, useScreenStyles } from '@/device/parts/lcd-text';
import { PillButton } from '@/device/sheets/primitives';
import { DEVICE, EASE_DISPLAY_FN, EASE_FALL_FN, SPRING } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { useTour, type TourLaunchPhase } from './tour-context';
import { READY_BEAT } from './tour-model';

/*
 * The tour's gift (decision 95), replacing the 3D launch of decision 85. Start lets the device's
 * old skin go: the whole machine falls away like a case, and Graphite stands behind it. The
 * machine steps back into a row of all six, the owner's first, Graphite second, then Trim Pro's;
 * a swipe (or a tap on a neighbour or a dot) brings another to the middle. Use steps the picked
 * one forward again and the device fades in over it, home, in that skin.
 *
 * Cheap on purpose: the row is drawn once, under the device, while the tour's last lines type, so
 * Start only starts animations; the fall, the step back, the swipe and the spring all run on the
 * UI thread; a pick re-renders only the foot (label, dots, Use), never a device.
 */

const OBJECT_W = deviceObject.width;
const OBJECT_H = DEVICE_OBJECT_HEIGHT;

/** The machines in the row: the finish the owner had, Graphite (new), then Trim Pro's. */
function rowOf(before: Finish): Finish[] {
  const order = [before, EARNED_FINISH, ...FINISHES.filter((id) => !FREE_FINISHES.includes(id))];
  return order.filter((id, index) => order.indexOf(id) === index && FINISHES.includes(id));
}

/**
 * The device's own transform while its old skin falls (decision 95): down past the bottom edge,
 * gathering speed, tilting about a point on its top edge. The fall's end reveals the row. At
 * rest (and under Reduce Motion, where the device fades instead) it's no transform at all.
 */
export function useTourDropStyle() {
  const { launch, reveal } = useTour();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const drop = useSharedValue(0);
  const falling = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(drop);
    // `picking` holds the fallen pose (the device is hidden by then); everything else rests.
    if (launch === 'drop' && !reduceMotion) {
      falling.set(1);
      drop.set(0);
      drop.set(
        withTiming(1, { duration: DEVICE.TOUR_DROP, easing: EASE_FALL_FN }, (finished) => {
          if (finished) scheduleOnRN(reveal);
        }),
      );
    } else if (launch !== 'picking') {
      falling.set(0);
      drop.set(0);
    }
  }, [drop, falling, launch, reduceMotion, reveal]);

  // The pivot, from the device's centre. Turning about it is turning about the centre, then
  // moving by (pivot − turned pivot): one translate and one rotate.
  const px = width * (tourGeometry.dropPivotX - 0.5);
  const py = -height / 2;
  return useAnimatedStyle(() => {
    if (falling.get() === 0) return { transform: [] };
    const t = drop.get();
    const angle = (t * tourGeometry.dropTilt * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      transform: [
        { translateX: px - (px * cos - py * sin) },
        { translateY: t * height * tourGeometry.dropFall + py - (px * sin + py * cos) },
        { rotate: `${angle}rad` },
      ],
    };
  });
}

/**
 * The device's opacity around the gift, as a CSS transition so React holds both resting states
 * (trim-ui §8 rule 8): gone while the row is up, faded back in over the picked machine.
 */
export function useTourDeviceFade() {
  const { launch } = useTour();
  const reduceMotion = useReducedMotion();
  const gone = launch === 'picking' || launch === 'landing' || (launch === 'drop' && reduceMotion);
  return {
    opacity: gone ? 0 : 1,
    transitionProperty: 'opacity',
    transitionDuration: DEVICE.TOUR_FADE,
  } as const;
}

type Frame = {
  /** The middle machine's scale and centre at full size (0) and stepped back (1). */
  s0: number;
  s1: number;
  cy0: number;
  cy1: number;
  /** The card's left edge for the middle slot, and the distance between slots. */
  cx: number;
  step: number;
};

/**
 * The row of six (decision 95). Mounted under the device from the tour's last screen on, so it's
 * ready before Start; it takes touches only while `picking`.
 */
export function TourGift() {
  const { launch, before, pick, active, state, choose, keep, reveal } = useTour();
  const armed = launch != null || (active && state.beat >= READY_BEAT);
  if (!armed) return null;
  return <Gift key={before} launch={launch} before={before} pick={pick} choose={choose} keep={keep} reveal={reveal} />;
}

type GiftProps = {
  launch: TourLaunchPhase | null;
  before: Finish;
  pick: Finish;
  choose: (finish: Finish) => void;
  keep: () => void;
  reveal: () => void;
};

/** Memoized: the tour's typing re-renders `TourGift` every character; this only changes with the gift. */
const Gift = memo(function Gift({ launch, before, pick, choose, keep, reveal }: GiftProps) {
  const { isPro, activePlan } = useWorkoutStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const row = useMemo(() => rowOf(before), [before]);
  const last = row.length - 1;
  const earned = Math.max(0, row.indexOf(EARNED_FINISH));
  const days = activePlan ? trainableDays(activePlan).length : 0;
  const lamps = useMemo(() => offLamps(days), [days]);
  const picking = launch === 'picking';

  // Where the foot starts; the row fills the room above it.
  const [footTop, setFootTop] = useState(height);
  const onFoot = (event: LayoutChangeEvent) => setFootTop(event.nativeEvent.layout.y);
  const frame = useMemo<Frame>(() => {
    const top = insets.top + space.gutter;
    const bottom = Math.max(top + 1, footTop - space.gutter);
    const s1 = Math.min((width * tourGeometry.cardWidth) / OBJECT_W, (bottom - top) / OBJECT_H);
    return {
      s0: Math.min(width / OBJECT_W, (height - insets.top - insets.bottom) / OBJECT_H),
      s1,
      cy0: height / 2,
      cy1: (top + bottom) / 2,
      cx: width / 2 - OBJECT_W / 2,
      step: OBJECT_W * s1 + tourGeometry.cardGap,
    };
  }, [footTop, height, insets.bottom, insets.top, width]);

  // `z`: 0 the middle machine at full size, 1 stepped back into the row. `pos`: the row's middle, in machines.
  const z = useSharedValue(0);
  const pos = useSharedValue(earned);
  const start = useSharedValue(earned);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (launch === 'drop') {
      cancelAnimation(pos);
      cancelAnimation(z);
      pos.set(earned);
      z.set(0);
      z.set(
        reduceMotion
          ? 1
          : withDelay(DEVICE.TOUR_STEP_BACK_DELAY, withTiming(1, { duration: DEVICE.TOUR_STEP_BACK, easing: EASE_DISPLAY_FN })),
      );
    } else if (launch === 'landing') {
      cancelAnimation(pos);
      pos.set(Math.max(0, row.indexOf(pick)));
      if (!reduceMotion) z.set(withTiming(0, { duration: DEVICE.TOUR_SETTLE, easing: EASE_DISPLAY_FN }));
    }
  // `pick` is read once, as Use lands; a later pick can't happen (`choose` only takes `picking`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned, launch, pos, reduceMotion, z]);

  // The machine in the middle is the pick: each one passed clicks (the `reskin` thock).
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  }, [choose]);
  const pass = useCallback((index: number) => chooseRef.current(row[index]), [row]);
  useAnimatedReaction(
    () => Math.min(last, Math.max(0, Math.round(pos.get()))),
    (now, previous) => {
      if (previous != null && now !== previous) scheduleOnRN(pass, now);
    },
  );

  /** Bring machine `target` to the middle: a spring, or under Reduce Motion a crossfade. */
  const goTo = (target: number, velocity: number) => {
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
  };

  const band = (raw: number) => {
    'worklet';
    const give = (excess: number) => tourGeometry.swipeBandMax * (1 - 1 / (1 + (excess * tourGeometry.swipeBand) / tourGeometry.swipeBandMax));
    if (raw > last) return last + give(raw - last);
    if (raw < 0) return -give(-raw);
    return raw;
  };

  const { step } = frame;
  const pan = Gesture.Pan()
    .enabled(picking)
    .activeOffsetX([-space.related, space.related])
    // From activation, not touch-down: a tap (a neighbour) must not stop a row that's still settling.
    .onStart(() => {
      cancelAnimation(pos);
      start.set(pos.get());
    })
    .onUpdate((event) => {
      pos.set(band(start.get() - event.translationX / step));
    })
    .onEnd((event) => {
      const velocity = -event.velocityX / step;
      const target = Math.min(last, Math.max(0, Math.round(pos.get() + velocity * tourGeometry.swipeThrow)));
      goTo(target, velocity);
    });
  const tap = Gesture.Tap()
    .enabled(picking)
    .onEnd((event) => {
      const offset = Math.round((event.x - width / 2) / step);
      if (offset === 0) return;
      goTo(Math.min(last, Math.max(0, Math.round(pos.get()) + offset)), 0);
    });
  const gesture = Gesture.Race(pan, tap);

  const index = Math.max(0, row.indexOf(pick));
  const jump = (target: number) => goTo(target, 0);
  const onAction = (event: AccessibilityActionEvent) => {
    const next = event.nativeEvent.actionName === 'increment' ? index + 1 : event.nativeEvent.actionName === 'decrement' ? index - 1 : index;
    if (next >= 0 && next <= last && next !== index) jump(next);
  };

  const footStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (z.get() - tourGeometry.footFrom) / (1 - tourGeometry.footFrom)));
    return { opacity: t };
  });
  const rowStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const lock = finishLock(pick, { isPro, tourDone: true });
  const isNew = pick === EARNED_FINISH && pick !== before;
  const name = finishColors[pick].name;
  const label = isNew ? 'NEW SKIN UNLOCKED' : lock === 'pro' ? 'TRIM PRO SKIN' : 'YOUR SKIN';
  const hidden = !picking;

  return (
    <View
      pointerEvents={launch === 'drop' || picking ? 'auto' : 'none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.room]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, rowStyle]}>
        {row.map((id, i) => (
          <GiftCard key={id} id={id} index={i} lamps={lamps} z={z} pos={pos} frame={frame} />
        ))}
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Skin"
          accessibilityValue={{ text: `${pick}, ${name}${lock === 'pro' ? ', Trim Pro' : isNew ? ', new' : ''}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
          style={[styles.swipe, { top: insets.top, height: Math.max(0, footTop - insets.top) }]}
        />
      </GestureDetector>
      <Animated.View
        onLayout={onFoot}
        style={[styles.foot, { paddingBottom: Math.max(insets.bottom, sheetGeometry.bottomPad) }, footStyle]}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.sectionLabel, styles.label]}>
          {label}
        </Text>
        <View style={styles.dots}>
          {row.map((id, i) => (
            <SkinDot key={id} id={id} selected={id === pick} onPress={() => jump(i)} />
          ))}
        </View>
        <PillButton
          title={lock === 'pro' ? 'Comes with Trim Pro' : isNew ? `Use ${name}` : `Keep ${name}`}
          variant={lock === 'pro' ? 'dark' : 'light'}
          disabled={lock === 'pro'}
          onPress={keep}
          style={styles.pill}
          testID="tour-keep"
        />
      </Animated.View>
      {launch === 'drop' ? (
        // Nothing waits on the moment: a tap skips the rest of the fall.
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          onPress={() => {
            cancelAnimation(z);
            z.set(1);
            reveal();
          }}
        />
      ) : null}
    </View>
  );
});

/**
 * One machine in the row, drawn once in its own skin and never re-rendered by a pick: where it
 * sits, its size and how dim it is all come from `z` and `pos` on the UI thread. One bitmap
 * (`shouldRasterizeIOS`), so moving it composites instead of redrawing.
 */
const GiftCard = memo(function GiftCard({
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
        { translateY: cy - OBJECT_H / 2 },
        { scale: s * (1 - (1 - tourGeometry.sideScale) * near) },
      ],
    };
  });
  return (
    <Animated.View shouldRasterizeIOS style={[styles.card, style]}>
      <FinishProvider override={id}>
        <DeviceObject
          scale={1}
          displayKey={id}
          display={<SkinScreen id={id} />}
          lamps={lamps}
          accessibilityLabel={`Skin ${id}, ${finishColors[id].name}`}
        />
      </FinishProvider>
    </Animated.View>
  );
});

/** The machine's display in the row: its number, then its name. */
function SkinScreen({ id }: { id: Finish }) {
  const s = useScreenStyles(screenStyles);
  return (
    <View style={s.fill}>
      <LcdText lines={1} style={[gadgetType.lcdSmall, s.dim]}>
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

/** A skin dot under the row: the machine's body colours, ringed when it's in the middle. */
function SkinDot({ id, selected, onPress }: { id: Finish; selected: boolean; onPress: () => void }) {
  const colors = finishColors[id];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Skin ${id}, ${colors.name}`}
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
    </Pressable>
  );
}

const RING = tourGeometry.dotSize + (tourGeometry.dotRing + tourGeometry.dotRingGap) * 2;

const styles = StyleSheet.create({
  // Clipped: the row's far machines sit off screen.
  room: { backgroundColor: tourColors.roomGround, overflow: 'hidden' },
  card: { position: 'absolute', left: 0, top: 0, width: OBJECT_W, height: OBJECT_H },
  swipe: { position: 'absolute', left: 0, right: 0 },
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
    borderWidth: tourGeometry.dotRing,
    borderColor: tourColors.roomGround,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { borderColor: sheetColors.ring },
  pill: { alignSelf: 'stretch' },
  dot: { width: tourGeometry.dotSize, height: tourGeometry.dotSize, borderRadius: tourGeometry.dotSize / 2 },
});

const screenStyles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { color: lcd.amberDim },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
