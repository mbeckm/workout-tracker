import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { isDeviceLaunchAvailable } from '../../../modules/trim-device';
import { finishColors, fontScaleCap, gadgetRadius, gadgetType, insertGeometry, lcd, sheetColors, sheetGeometry, space, tourColors, tourGeometry, tourType } from '@/constants/theme';
import { EARNED_FINISH, FINISHES, FREE_FINISHES, finishLock, type Finish } from '@/domain/finish';
import type { DevicePalette } from '@/device/finish';
import { FinishSwatch } from '@/device/finish-swatch';
import { swatchWidth } from '@/device/sheets/finishes-sheet';
import { PillButton } from '@/device/sheets/primitives';
import { DEVICE, EASE_DISPLAY_FN, EASE_STAMP_FN, TOUR_POSE, TOUR_POSE_EASE, TOUR_POSE_HEIGHT } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { useSounds } from '@/device/haptics';

import { useTour, type TourLaunchPhase } from './tour-context';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The phases as numbers for worklets: 0 none, 1 in the air, 2 perched, 3 settling home. */
const PHASE = { none: 0, launch: 1, perched: 2, landing: 3 } as const;

type Pose = { y: number; sx: number; sy: number; turn: number };

/** The pose at `t` (0–1 of the launch), each segment eased as in the prototype. */
function poseAt(t: number): Pose {
  'worklet';
  const last = TOUR_POSE.length - 1;
  if (t <= 0) return TOUR_POSE[0];
  if (t >= 1) return TOUR_POSE[last];
  let i = 0;
  while (i < last - 1 && t > TOUR_POSE[i + 1].at) i += 1;
  const a = TOUR_POSE[i];
  const b = TOUR_POSE[i + 1];
  const local = TOUR_POSE_EASE[i]((t - a.at) / (b.at - a.at));
  return {
    y: a.y + (b.y - a.y) * local,
    sx: a.sx + (b.sx - a.sx) * local,
    sy: a.sy + (b.sy - a.sy) * local,
    turn: a.turn + (b.turn - a.turn) * local,
  };
}

const PERCH = TOUR_POSE[TOUR_POSE.length - 1];

export type TourMotion = {
  phase: SharedValue<number>;
  clock: SharedValue<number>;
  settle: SharedValue<number>;
  wiggle: SharedValue<number>;
  /** The screen's height over the pose's reference. */
  k: number;
};

/**
 * The launch's clocks (decision 85). In the air the device is a slab: the face squashes with the
 * cosine of the turn, the back shows past 90°, and the edge stands beside the face. Reduce Motion:
 * no flight, the device fades to the perch (the room and the picker still come).
 */
export function useTourMotion(): TourMotion {
  const { launch, ripple } = useTour();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue<number>(PHASE.none);
  const clock = useSharedValue(0);
  const settle = useSharedValue(0);
  const wiggle = useSharedValue(0);

  useEffect(() => {
    phase.set(launch ? PHASE[launch] : PHASE.none);
    if (launch === 'launch') {
      clock.set(0);
      settle.set(0);
      clock.set(withTiming(1, { duration: reduceMotion ? DEVICE.FINISH : DEVICE.TOUR_LAUNCH, easing: Easing.linear }));
    } else if (launch === 'perched') {
      clock.set(1);
    } else if (launch === 'landing') {
      settle.set(withTiming(1, { duration: DEVICE.TOUR_SETTLE, easing: EASE_DISPLAY_FN }));
    }
  }, [clock, launch, phase, reduceMotion, settle]);

  useEffect(() => {
    if (ripple === 0 || reduceMotion) return;
    const tilts = tourGeometry.wiggleTilts;
    const step = DEVICE.TOUR_WIGGLE / (tilts.length + 1);
    const direction = ripple % 2 === 0 ? -1 : 1;
    wiggle.set(
      withSequence(
        ...tilts.map((tilt) => withTiming(tilt * direction, { duration: step, easing: EASE_DISPLAY_FN })),
        withTiming(0, { duration: step, easing: EASE_DISPLAY_FN }),
      ),
    );
  }, [reduceMotion, ripple, wiggle]);

  return { phase, clock, settle, wiggle, k: height / TOUR_POSE_HEIGHT };
}

/**
 * The launch on the cartridge insert's SceneKit body (`DeviceLaunch`), when the build has it: the
 * same 44 pt deep slab the owner saw at the end of onboarding, from the throw through the perch
 * and the picks to the landing, rather than the 2D face, edge and back and a flat perched device.
 * `showing` once its first frame is up: the JS device, edge and back hide under it until the
 * landing is done. Reduce Motion keeps the 2D fade.
 */
export function useTourLaunch3d() {
  const { active, launch, ripple, dressEarly } = useTour();
  const reduceMotion = useReducedMotion();
  const enabled = isDeviceLaunchAvailable && !reduceMotion;
  const playing = enabled && launch != null;
  const [ready, setReady] = useState(false);
  // A new launch waits for its own first frame.
  const [wasPlaying, setWasPlaying] = useState(playing);
  if (wasPlaying !== playing) {
    setWasPlaying(playing);
    if (!playing) setReady(false);
  }
  const onSceneReady = useCallback(() => {
    setReady(true);
    dressEarly();
  }, [dressEarly]);
  return { phase: playing && launch ? launch : ('idle' as const), prepare: enabled && active, playing, showing: playing && ready, ripple, onSceneReady };
}

/** The pose for the frame: in the air, perched (with the wiggle), or settling home. */
function frame(motion: TourMotion): Pose & { tilt: number } {
  'worklet';
  const phase = motion.phase.get();
  if (phase === PHASE.launch) return { ...poseAt(motion.clock.get()), tilt: 0 };
  if (phase === PHASE.perched) return { ...PERCH, tilt: motion.wiggle.get() };
  if (phase === PHASE.landing) {
    const p = 1 - motion.settle.get();
    return { y: PERCH.y * p, sx: 1 + (PERCH.sx - 1) * p, sy: 1 + (PERCH.sy - 1) * p, turn: 0, tilt: 0 };
  }
  return { y: 0, sx: 1, sy: 1, turn: 0, tilt: 0 };
}

/** The device's transform while the tour launches it (face-on otherwise: no transform at all). */
export function useTourDeviceStyle(motion: TourMotion) {
  const { k } = motion;
  return useAnimatedStyle(() => {
    if (motion.phase.get() === PHASE.none) return { transform: [] };
    const f = frame(motion);
    const cos = Math.cos((f.turn * Math.PI) / 180);
    // A face exactly edge-on draws nothing; keep a sliver so the slab never blinks out.
    const squash = Math.sign(cos || 1) * Math.max(Math.abs(cos), 0.02);
    return {
      transform: [{ translateY: f.y * k }, { rotate: `${f.tilt}deg` }, { scaleX: f.sx * squash }, { scaleY: f.sy }],
    };
  });
}

/** The device's back: its body and the engraved TRIM, shown while the turn faces it away. */
export function TourBack({ motion, palette }: { motion: TourMotion; palette: DevicePalette }) {
  const style = useAnimatedStyle(() => {
    if (motion.phase.get() !== PHASE.launch) return { opacity: 0 };
    const cos = Math.cos((poseAt(motion.clock.get()).turn * Math.PI) / 180);
    return { opacity: cos < 0 ? 1 : 0 };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.back, { backgroundColor: palette.body2, experimental_backgroundImage: `linear-gradient(180deg, ${palette.body1}, ${palette.body2})` }, style]}>
      <Text
        maxFontSizeMultiplier={fontScaleCap.display}
        style={[gadgetType.engraved, styles.backMark, { color: palette.label, textShadowColor: palette.labelShadow }]}>
        TRIM
      </Text>
    </Animated.View>
  );
}

/** The body's edge beside the squashed face, as wide as the turn shows it. */
export function TourEdge({ motion, palette }: { motion: TourMotion; palette: DevicePalette }) {
  const { width, height } = useWindowDimensions();
  const { k } = motion;
  const style = useAnimatedStyle(() => {
    if (motion.phase.get() !== PHASE.launch) return { opacity: 0 };
    const f = frame(motion);
    const rad = (f.turn * Math.PI) / 180;
    const face = (width / 2) * Math.abs(Math.cos(rad)) * f.sx;
    const depth = tourGeometry.depth * Math.abs(Math.sin(rad)) * f.sx;
    const side = Math.sin(rad) * Math.cos(rad) >= 0 ? 1 : -1;
    return {
      opacity: depth > 1 ? 1 : 0,
      width: depth,
      height: height * f.sy,
      transform: [
        { translateX: width / 2 + side * (face + depth / 2) - depth / 2 },
        { translateY: f.y * k + (height * (1 - f.sy)) / 2 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.edge, { backgroundColor: palette.body2, borderColor: palette.keyEdge }, style]}
    />
  );
}

/**
 * Trim's dot-matrix room behind the launch: unlit dots on the dark ground, a vignette, the
 * device's shadow, and a ring of lit dots that ripples out from the device when it lands and on
 * every finish picked.
 */
export function TourRoom({ motion }: { motion: TourMotion }) {
  const { launch, ripple } = useTour();
  const sound = useSounds();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const room = useSharedValue(0);
  const ring = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const centerY = height / 2 + PERCH.y * motion.k;

  useEffect(() => {
    room.set(withTiming(launch && launch !== 'landing' ? 1 : 0, { duration: DEVICE.TOUR_ROOM }));
  }, [launch, room]);

  // The landing's ring with its pulse, then a silent one per pick (the pick has its own `reskin`).
  useEffect(() => {
    if (launch !== 'launch' || reduceMotion) return;
    ring.set(0);
    ringOpacity.set(0);
    const land = DEVICE.TOUR_LAUNCH - DEVICE.TOUR_PICKER;
    const pulse = setTimeout(() => sound('pulse'), land);
    ring.set(withDelay(land, withTiming(1, { duration: DEVICE.TOUR_LAND_RIPPLE, easing: EASE_DISPLAY_FN })));
    ringOpacity.set(withDelay(land, withSequence(withTiming(1, { duration: DEVICE.SNAP }), withTiming(0, { duration: DEVICE.TOUR_LAND_RIPPLE }))));
    return () => clearTimeout(pulse);
  }, [launch, reduceMotion, ring, ringOpacity, sound]);
  useEffect(() => {
    if (ripple === 0 || reduceMotion) return;
    ring.set(0);
    ring.set(withTiming(1, { duration: DEVICE.TOUR_RIPPLE, easing: EASE_DISPLAY_FN }));
    ringOpacity.set(withSequence(withTiming(1, { duration: DEVICE.SNAP }), withTiming(0, { duration: DEVICE.TOUR_RIPPLE })));
  }, [reduceMotion, ring, ringOpacity, ripple]);

  const roomStyle = useAnimatedStyle(() => ({ opacity: room.get() }));
  const ringProps = useAnimatedProps(() => ({
    r: Math.max(0, interpolate(ring.get(), [0, 1], [tourGeometry.rippleStart, tourGeometry.rippleEnd])),
    opacity: ringOpacity.get(),
  }));
  const shadowStyle = useAnimatedStyle(() => {
    const f = frame(motion);
    const lift = Math.min(1, Math.max(0, (PERCH.y - f.y) / Math.abs(PERCH.y)));
    return { opacity: motion.phase.get() === PHASE.none ? 0 : 1 - lift * 0.8, transform: [{ scale: 1 - lift * 0.55 }] };
  });

  const pitch = tourGeometry.dotPitch;
  const dot = tourGeometry.dotRadius;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.room, roomStyle]}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="tourDotsOff" patternUnits="userSpaceOnUse" width={pitch} height={pitch}>
            <Circle cx={pitch / 2} cy={pitch / 2} r={dot} fill={tourColors.roomDotOff} />
          </Pattern>
          <Pattern id="tourDotsOn" patternUnits="userSpaceOnUse" width={pitch} height={pitch}>
            <Circle cx={pitch / 2} cy={pitch / 2} r={dot} fill={tourColors.roomDotOn} />
          </Pattern>
          <RadialGradient id="tourVignette" cx="50%" cy="45%" r="70%">
            <Stop offset="0.55" stopColor={tourColors.vignette} stopOpacity={0} />
            <Stop offset="1" stopColor={tourColors.vignette} stopOpacity={tourColors.vignetteOpacity} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#tourDotsOff)" />
        <AnimatedCircle cx={width / 2} cy={centerY} fill="none" stroke="url(#tourDotsOn)" strokeWidth={tourGeometry.rippleWidth} animatedProps={ringProps} />
        <Rect width={width} height={height} fill="url(#tourVignette)" />
      </Svg>
      <Animated.View
        style={[
          styles.shadow,
          { left: (width - tourGeometry.shadowWidth) / 2, top: centerY + (height * PERCH.sy) / 2 - tourGeometry.shadowHeight / 2 },
          shadowStyle,
        ]}
      />
    </Animated.View>
  );
}

/** The swatches the reward offers: the finish the owner had, Graphite (NEW), then Trim Pro's. */
function rewardFinishes(before: Finish, earned: Finish): Finish[] {
  const order = [before, earned, ...FINISHES.filter((id) => !FREE_FINISHES.includes(id))];
  return order.filter((id, index) => order.indexOf(id) === index && FINISHES.includes(id));
}

/**
 * The reward (decision 85): `UNLOCKED` stamps onto the perched device, then the picker rises with
 * the finish the owner had, the new one (picked, `NEW`) and Trim Pro's (locked, preview only).
 * Each pick re-dresses the device with the room's ripple and a wiggle. Use or Keep settles it home.
 */
export function TourReward() {
  const tour = useTour();
  const { isPro } = useWorkoutStore();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { launch, pick, before } = tour;
  const showing = launch === 'launch' || launch === 'perched';
  const lock = finishLock(pick, { isPro, tourDone: true });
  const isNew = pick === EARNED_FINISH && pick !== before;
  const finishes = useMemo(() => rewardFinishes(before, EARNED_FINISH), [before]);
  // The finishes sheet's swatch size, so the reward looks like the picker it previews.
  const swatchW = swatchWidth(useWindowDimensions().width);

  const stamp = useSharedValue(0);
  const rise = useSharedValue(0);
  useEffect(() => {
    if (launch !== 'launch') return;
    stamp.set(0);
    rise.set(0);
    const stampDelay = reduceMotion ? DEVICE.FINISH : DEVICE.TOUR_STAMP_DELAY;
    const riseDelay = reduceMotion ? DEVICE.FINISH : DEVICE.TOUR_PICKER_DELAY;
    stamp.set(withDelay(stampDelay, withTiming(1, { duration: DEVICE.STAMP, easing: EASE_STAMP_FN })));
    rise.set(withDelay(riseDelay, withTiming(1, { duration: DEVICE.TOUR_PICKER, easing: EASE_DISPLAY_FN })));
  }, [launch, reduceMotion, rise, stamp]);
  // A pick back to the new finish slams the stamp again.
  useEffect(() => {
    if (launch !== 'perched' || pick === before) return;
    stamp.set(0);
    stamp.set(withTiming(1, { duration: DEVICE.STAMP, easing: EASE_STAMP_FN }));
  }, [before, launch, pick, stamp]);

  const stampStyle = useAnimatedStyle(() => {
    const t = stamp.get();
    return {
      opacity: Math.min(1, t * 2),
      transform: [{ scale: interpolate(t, [0, 1], [2.6, 1]) }, { rotate: `${interpolate(t, [0, 1], [-22, tourGeometry.stampTilt])}deg` }],
    };
  });
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(rise.get(), [0, 1], [sheetGeometry.swatchH * 6, 0]) }] }));

  if (!showing) return null;
  const name = finishColors[pick].name;
  const title = `${pick} ${name}`;
  const label = isNew ? 'NEW SKIN UNLOCKED' : lock === 'pro' ? 'TRIM PRO SKIN' : 'YOUR SKIN';
  const sub = isNew ? 'Yours for finishing the tour.' : lock === 'pro' ? 'Locked. Comes with Trim Pro.' : 'The one you have now.';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {pick !== before ? (
        <Animated.View pointerEvents="none" style={[styles.stamp, lock === 'pro' && styles.stampLocked, stampStyle]}>
          <Text maxFontSizeMultiplier={1} style={[tourType.stamp, lock === 'pro' ? styles.stampLockedText : styles.stampText]}>
            {lock === 'pro' ? 'LOCKED' : 'UNLOCKED'}
          </Text>
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.picker, { paddingBottom: Math.max(insets.bottom, sheetGeometry.bottomPad) }, riseStyle]}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.sectionLabel, styles.pickerLabel]}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={gadgetType.sheetHero}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.pickerSub]}>
          {sub}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          accessibilityLabel="Skin"
          style={styles.swatchRow}
          contentContainerStyle={styles.swatches}>
          {finishes.map((id) => (
            <FinishSwatch
              key={id}
              id={id}
              width={swatchW}
              selected={id === pick}
              lock={finishLock(id, { isPro, tourDone: true })}
              tag={id === EARNED_FINISH && id !== before ? 'NEW' : undefined}
              onPress={() => tour.choose(id)}
            />
          ))}
        </ScrollView>
        <PillButton
          title={lock === 'pro' ? 'Comes with Trim Pro' : isNew ? `Use ${name}` : `Keep ${name}`}
          variant={lock === 'pro' ? 'dark' : 'light'}
          disabled={lock === 'pro'}
          onPress={tour.keep}
          testID="tour-keep"
        />
      </Animated.View>
    </View>
  );
}

/** Whether the tour's launch owns the screen (the device's own keys don't take touches). */
export function launching(phase: TourLaunchPhase | null): boolean {
  return phase != null;
}

/** The picker's text and its first swatch share one column, as a sheet's section labels do. */
const PICKER_X = sheetGeometry.sidePad + sheetGeometry.sectionX;

const styles = StyleSheet.create({
  room: { backgroundColor: tourColors.roomGround },
  back: { alignItems: 'center', justifyContent: 'center', borderRadius: insertGeometry.bodyRadius, borderCurve: 'continuous' },
  backMark: { transform: [{ scaleX: -1 }], letterSpacing: space.related },
  edge: { position: 'absolute', left: 0, top: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  shadow: {
    position: 'absolute',
    width: tourGeometry.shadowWidth,
    height: tourGeometry.shadowHeight,
    borderRadius: tourGeometry.shadowWidth / 2,
    backgroundColor: tourColors.shadow,
    boxShadow: `0 0 18px 12px ${tourColors.shadow}`,
  },
  stamp: {
    position: 'absolute',
    alignSelf: 'center',
    top: tourGeometry.stampY,
    width: tourGeometry.stampWidth,
    alignItems: 'center',
    paddingVertical: space.pair,
    borderWidth: tourGeometry.stampBorder,
    borderRadius: tourGeometry.stampRadius,
    borderColor: lcd.amber,
    backgroundColor: tourColors.stampGround,
  },
  stampLocked: { borderColor: tourColors.stampLocked },
  stampText: { color: lcd.amber },
  stampLockedText: { color: tourColors.stampLocked },
  picker: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: sheetColors.sheet,
    borderTopLeftRadius: gadgetRadius.sheet,
    borderTopRightRadius: gadgetRadius.sheet,
    borderCurve: 'continuous',
    paddingTop: sheetGeometry.sectionX,
    paddingHorizontal: PICKER_X,
  },
  pickerLabel: { color: lcd.amber },
  pickerSub: { marginTop: space.pair },
  swatchRow: { marginHorizontal: -PICKER_X },
  swatches: {
    paddingHorizontal: PICKER_X,
    flexDirection: 'row',
    gap: sheetGeometry.swatchGap,
    paddingTop: space.related + sheetGeometry.swatchLift,
    paddingBottom: space.inset,
  },
});
