import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { assemblyColors as C, assemblyGeometry as G, deviceObject } from '@/constants/theme';
import { DEVICE_OBJECT_ANCHORS, DEVICE_OBJECT_HEIGHT, type DeviceAssembly, type DevicePart } from '@/device/device-object';
import { useHaptics, useSounds, type DeviceSound, type SnapSound } from '@/device/haptics';
import { EmptySlot } from '@/device/home/home-display';
import { GridGround } from '@/device/moment/grid-ground';
import { ASSEMBLY as A, EASE_ARRIVE_FN, EASE_HIT_FN, EASE_SLAM_FN, LINEAR_FN } from '@/motion';

/**
 * First open (D74): the machine is born. It approaches out of space, its parts snap on faster and
 * faster, the Start key hovers and trembles while it charges and the camera pushes in, then it
 * slams home: the bang, a double shockwave, the shake, and the grid floor lights. From then on
 * it's yours.
 *
 * One clock (`ASSEMBLY`, 0 → END) drives everything, so a tap skips by jumping the clock to its
 * end. Every animated style rests at its React base at END (identity, or a base that matches),
 * and the layers that only exist during the scene unmount (trim-ui §8 rule 8).
 */

/** Progress of `t` through [start, start + duration], 0 to 1. */
function seg(t: number, start: number, duration: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (t - start) / duration));
}

type From = 'top' | 'left' | 'right';
const BEATS: readonly { part: DevicePart; at: number; from: From }[] = [
  { part: 'display', at: A.DISPLAY_AT, from: 'top' },
  { part: 'menu', at: A.MENU_AT, from: 'left' },
  { part: 'history', at: A.HISTORY_AT, from: 'right' },
  { part: 'rocker', at: A.ROCKER_AT, from: 'top' },
  { part: 'plus', at: A.PLUS_AT, from: 'left' },
  { part: 'minus', at: A.MINUS_AT, from: 'left' },
  { part: 'wheel', at: A.WHEEL_AT, from: 'right' },
];
const BEAT_TIMES = BEATS.map((beat) => beat.at);
const SNAPS: readonly SnapSound[] = ['snap-1', 'snap-2', 'snap-3', 'snap-4', 'snap-5', 'snap-6', 'snap-7'];

/** A part flies in from off the body and accelerates into its hit. */
function usePartStyle(clock: SharedValue<number>, at: number, from: From) {
  return useAnimatedStyle(() => {
    const p = seg(clock.get(), at - A.FLY, A.FLY);
    const away = 1 - EASE_HIT_FN(p);
    const side = from === 'left' ? -1 : from === 'right' ? 1 : 0;
    return {
      opacity: p > 0 ? 1 : 0,
      transform: [
        { translateX: side * G.fromSide * away },
        { translateY: from === 'top' ? G.fromTop * away : 0 },
        { rotate: `${side * G.fromSpin * away}deg` },
      ],
    };
  });
}

/** The haptics and sounds, on the frames the clock lands them (trim-ui §8 rule 3). */
function scheduleFeel(haptics: ReturnType<typeof useHaptics>, sound: (name: DeviceSound) => void) {
  const at = (ms: number, run: () => void) => setTimeout(run, ms);
  return [
    at(0, () => {
      haptics.startAssemblyApproach();
      sound('arrive');
    }),
    at(A.ARRIVE, haptics.assemblyArrive),
    ...BEATS.map((beat, index) =>
      at(beat.at, () => {
        haptics.assemblySnap();
        sound(SNAPS[index]);
      }),
    ),
    at(A.CHARGE_AT, () => {
      haptics.startAssemblyCharge();
      sound('charge');
    }),
    at(A.BANG, () => {
      haptics.assemblyBang();
      sound('bang');
    }),
    at(A.BOOT_AT, () => sound('boot')),
  ];
}

/**
 * The scene's clock, styles and layers. `enabled` false (Reduce Motion) starts at the end with no
 * assembly; the caller fades the device in instead.
 */
export function useAssembly(enabled: boolean) {
  const clock = useSharedValue(enabled ? 0 : A.END);
  const [playing, setPlaying] = useState(enabled);
  const [skipped, setSkipped] = useState(false);
  const haptics = useHaptics();
  const sound = useSounds();
  // The Sounds setting can change mid-scene; the timers read the latest.
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!enabled) return undefined;
    clock.set(withTiming(A.END, { duration: A.END, easing: LINEAR_FN }));
    timers.current = [
      ...scheduleFeel(haptics, (name) => soundRef.current(name)),
      setTimeout(() => setPlaying(false), A.END),
    ];
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, [clock, enabled, haptics]);

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    haptics.stopAssemblyCharge();
    cancelAnimation(clock);
    clock.set(A.END);
    setSkipped(true);
    setPlaying(false);
  }, [clock, haptics]);

  const body = useAnimatedStyle(() => {
    const p = seg(clock.get(), 0, A.ARRIVE);
    const eased = EASE_ARRIVE_FN(p);
    const away = 1 - eased;
    return {
      opacity: Math.min(1, p / G.arriveFade),
      transform: [
        { perspective: G.perspective },
        { translateY: G.arriveY * away },
        { rotateX: `${G.arriveTilt * away}deg` },
        { rotateZ: `${G.arriveTurn * away}deg` },
        { scale: G.arriveScale + (1 - G.arriveScale) * eased },
      ],
    };
  });

  const display = usePartStyle(clock, A.DISPLAY_AT, 'top');
  const menu = usePartStyle(clock, A.MENU_AT, 'left');
  const history = usePartStyle(clock, A.HISTORY_AT, 'right');
  const rocker = usePartStyle(clock, A.ROCKER_AT, 'top');
  const plus = usePartStyle(clock, A.PLUS_AT, 'left');
  const minus = usePartStyle(clock, A.MINUS_AT, 'left');
  const wheel = usePartStyle(clock, A.WHEEL_AT, 'right');

  const well = useAnimatedStyle(() => {
    const p = seg(clock.get(), A.WELL_AT, A.WELL);
    return { opacity: p, transform: [{ scale: 0.8 + 0.2 * p }] };
  });

  // Hover huge, tremble harder and harder, then slam in the last stretch.
  const bigKey = useAnimatedStyle(() => {
    const p = seg(clock.get(), A.CHARGE_AT, A.BANG - A.CHARGE_AT);
    if (p >= A.HOVER_SHARE) {
      const slam = EASE_SLAM_FN((p - A.HOVER_SHARE) / (1 - A.HOVER_SHARE));
      return { opacity: 1, transform: [{ rotate: '0deg' }, { scale: G.keyLast + (1 - G.keyLast) * slam }] };
    }
    const hover = p / A.HOVER_SHARE;
    const settle = Math.min(1, hover / G.keyFade);
    const scale =
      G.keyHover + (G.keyHold - G.keyHover) * settle + (G.keyLast - G.keyHold) * Math.max(0, hover - G.keyFade);
    const step = Math.min(G.tremble.length - 1, Math.floor(hover * G.tremble.length));
    const rotate = hover > G.keyFade * 2 ? G.tremble[step] : 0;
    return { opacity: p > 0 ? settle : 0, transform: [{ rotate: `${rotate}deg` }, { scale }] };
  });

  // The whole stage recoils on every hit, pushes in while the key charges, and shakes at the bang.
  const stage = useAnimatedStyle(() => {
    const t = clock.get();
    const push = t >= A.CHARGE_AT && t < A.BANG ? 1 + (G.pushIn - 1) * ((t - A.CHARGE_AT) / (A.BANG - A.CHARGE_AT)) ** 2 : 1;
    let kick = push;
    for (let i = 0; i < BEAT_TIMES.length; i++) {
      const since = t - BEAT_TIMES[i];
      if (since >= 0 && since < A.KICK) kick = push * (1 + (G.kick - 1) * (1 - since / A.KICK));
    }
    const shake = seg(t, A.BANG, A.SHAKE);
    const step = shake > 0 && shake < 1 ? G.shake[Math.min(G.shake.length - 1, Math.floor(shake * G.shake.length))] : null;
    return { transform: [{ translateX: step ? step[0] : 0 }, { translateY: step ? step[1] : 0 }, { scale: kick }] };
  });

  const assembly: DeviceAssembly = {
    body,
    parts: { display, menu, history, rocker, plus, minus, wheel, well, bigKey },
    underlay: playing ? (
      <>
        <Trace clock={clock} />
        <ChargeGlow clock={clock} />
      </>
    ) : null,
    overlay: playing ? (
      <>
        {BEATS.map((beat) => (
          <Spark key={beat.part} clock={clock} at={beat.at} {...DEVICE_OBJECT_ANCHORS[beat.part]} />
        ))}
        <Shockwave clock={clock} at={A.BANG} />
        <Shockwave clock={clock} at={A.BANG + A.RING_2_DELAY} />
      </>
    ) : null,
  };

  return { clock, playing, skipped, skip, assembly, stage };
}

/** Space, then (at the bang) the moments' grid floor over it. */
export function AssemblyGround({ clock, playing }: { clock: SharedValue<number>; playing: boolean }) {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => starField(width, height), [height, width]);
  const small = useAnimatedStyle(() => ({ transform: [{ translateY: -G.starDrift * seg(clock.get(), 0, A.END) }] }));
  const large = useAnimatedStyle(() => ({ transform: [{ translateY: -G.starLargeDrift * seg(clock.get(), 0, A.END) }] }));
  const grid = useAnimatedStyle(() => ({ opacity: seg(clock.get(), A.BANG, A.GRID) }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.space]} pointerEvents="none">
      <Haze />
      <Animated.View style={[StyleSheet.absoluteFill, styles.restSmall, small]}>
        {stars.small.map((star, index) => (
          <View key={index} style={[styles.star, { left: star.x, top: star.y, backgroundColor: star.warm ? C.starWarm : C.star }]} />
        ))}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.restLarge, large]}>
        {stars.large.map((star, index) => (
          <View key={index} style={[styles.starLarge, { left: star.x, top: star.y }]} />
        ))}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, grid]}>
        <GridGround />
      </Animated.View>
      {playing ? <Burst clock={clock} /> : null}
    </View>
  );
}

/** The light behind the body, so its edges glow while it floats in and when it slams. */
export function RimLight({ clock, width, height }: { clock: SharedValue<number>; width: number; height: number }) {
  const style = useAnimatedStyle(() => {
    const t = clock.get();
    const arrive = seg(t, 0, A.ARRIVE);
    const bang = seg(t, A.BANG, A.RING);
    const before = G.rimArrive * arrive;
    return { opacity: t < A.BANG ? before : 1 - (1 - G.rimRest) * bang };
  });
  const w = width * G.rimOverhang;
  const h = height * G.rimOverhang;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.rim, { width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 }, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="assemblyRim" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.rim} stopOpacity={C.rimOpacity} />
            <Stop offset="0.55" stopColor={C.rimOuter} stopOpacity={C.rimOpacity / 2} />
            <Stop offset="1" stopColor={C.rimOuter} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#assemblyRim)" />
      </Svg>
    </Animated.View>
  );
}

/** The display's content during the scene: dark until the boot, then SLOT EMPTY flickers on under a scan line. */
export function BootingSlot({ clock }: { clock: SharedValue<number> }) {
  const content = useAnimatedStyle(() => {
    const s = seg(clock.get(), A.BOOT_AT, A.BOOT);
    let opacity = 0;
    if (s >= 1) opacity = 1;
    else if (s > 0) for (const [from, value] of G.bootSteps) if (s >= from) opacity = value;
    return { opacity };
  });
  const scan = useAnimatedStyle(() => {
    const s = seg(clock.get(), A.SCAN_AT, A.SCAN);
    return {
      opacity: s > 0 && s < 1 ? 1 : 0,
      transform: [{ translateY: -G.scan + (deviceObject.displayHeight + G.scan) * s }],
    };
  });
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, content]}>
        <EmptySlot />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.scan, scan]}>
        <Svg width="100%" height={G.scan}>
          <Defs>
            <LinearGradient id="assemblyScan" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.amber} stopOpacity={0} />
              <Stop offset="0.5" stopColor={C.amber} stopOpacity={G.scanOpacity} />
              <Stop offset="1" stopColor={C.amber} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={G.scan} fill="url(#assemblyScan)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Haze() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="assemblyHazeWarm" cx="30%" cy="40%" r="45%">
          <Stop offset="0" stopColor={C.haze} stopOpacity={C.hazeOpacity} />
          <Stop offset="1" stopColor={C.haze} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="assemblyHazeCool" cx="75%" cy="70%" r="40%">
          <Stop offset="0" stopColor={C.hazeCool} stopOpacity={C.hazeCoolOpacity} />
          <Stop offset="1" stopColor={C.hazeCool} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#assemblyHazeWarm)" />
      <Rect width={width} height={height} fill="url(#assemblyHazeCool)" />
    </Svg>
  );
}

/** The amber outline flash as the body lands. */
function Trace({ clock }: { clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const x = seg(clock.get(), A.TRACE_AT, A.TRACE);
    const opacity = x <= 0 || x >= 1 ? 0 : x < G.traceUp ? x / G.traceUp : 1 - (x - G.traceUp) / (1 - G.traceUp);
    return { opacity };
  });
  return <Animated.View pointerEvents="none" style={[styles.trace, style]} />;
}

/** The glow building behind the Start key while it charges; it flashes out at the bang. */
function ChargeGlow({ clock }: { clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = clock.get();
    if (t < A.CHARGE_AT) return { opacity: 0, transform: [{ scale: G.chargeFrom }] };
    if (t < A.BANG) {
      const q = (t - A.CHARGE_AT) / (A.BANG - A.CHARGE_AT);
      return { opacity: 0.35 + 0.65 * q, transform: [{ scale: G.chargeFrom + (G.chargePeak - G.chargeFrom) * q }] };
    }
    const out = seg(t, A.BANG, G.chargeOut);
    return { opacity: 1 - out, transform: [{ scale: G.chargePeak + (G.chargeGrow - G.chargePeak) * out }] };
  });
  const { x, y } = DEVICE_OBJECT_ANCHORS.bigKey;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.glow, { left: x - G.chargeGlow / 2, top: y - G.chargeGlow / 2 }, style]}>
      <AmberDot id="assemblyCharge" size={G.chargeGlow} />
    </Animated.View>
  );
}

/** A spark where a part lands: a hot dot that grows and fades. */
function Spark({ clock, at, x, y }: { clock: SharedValue<number>; at: number; x: number; y: number }) {
  const style = useAnimatedStyle(() => {
    const s = seg(clock.get(), at, A.SPARK);
    return {
      opacity: s > 0 && s < 1 ? 1 - s : 0,
      transform: [{ scale: 0.2 + (G.sparkGrow - 0.2) * s }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.spark, { left: x - G.spark / 2, top: y - G.spark / 2 }, style]}>
      <AmberDot id={`assemblySpark${at}`} size={G.spark} hot />
    </Animated.View>
  );
}

/** The shockwave ring around the device at the bang. */
function Shockwave({ clock, at }: { clock: SharedValue<number>; at: number }) {
  const style = useAnimatedStyle(() => {
    const s = seg(clock.get(), at, A.RING);
    return {
      opacity: s > 0 && s < 1 ? 1 - s : 0,
      transform: [{ scale: G.ringFrom + (G.ringTo - G.ringFrom) * s }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { left: deviceObject.width / 2 - G.ring / 2, top: DEVICE_OBJECT_HEIGHT / 2 - G.ring / 2 },
        style,
      ]}
    />
  );
}

/** The amber flash over the whole screen at the bang. */
function Burst({ clock }: { clock: SharedValue<number> }) {
  const { width, height } = useWindowDimensions();
  const style = useAnimatedStyle(() => {
    const s = seg(clock.get(), A.BANG, A.BURST);
    return { opacity: s > 0 && s < 1 ? 1 - s : 0 };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.hidden, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="assemblyBurst" cx="50%" cy="40%" r="60%">
            <Stop offset="0" stopColor={C.amber} stopOpacity={G.burstOpacity} />
            <Stop offset="1" stopColor={C.amber} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#assemblyBurst)" />
      </Svg>
    </Animated.View>
  );
}

function AmberDot({ id, size, hot = false }: { id: string; size: number; hot?: boolean }): ReactNode {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={hot ? C.spark : C.amber} stopOpacity={1} />
          <Stop offset="0.4" stopColor={C.amber} stopOpacity={hot ? 0.8 : 0.6} />
          <Stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Seeded, so the sky is the same on every first open. Twice the screen's height: the layers drift up. */
function starField(width: number, height: number) {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const place = () => ({ x: random() * width, y: random() * height * 2, warm: random() < 0.3 });
  return {
    small: Array.from({ length: G.starCount }, place),
    large: Array.from({ length: G.starLargeCount }, place),
  };
}

const styles = StyleSheet.create({
  space: { backgroundColor: C.ground, overflow: 'hidden' },
  // React holds where the stars come to rest (rule 8); the clock only moves them there.
  restSmall: { transform: [{ translateY: -G.starDrift }] },
  restLarge: { transform: [{ translateY: -G.starLargeDrift }] },
  star: {
    position: 'absolute',
    width: G.starSize,
    height: G.starSize,
    borderRadius: G.starSize / 2,
    opacity: C.starOpacity,
  },
  starLarge: {
    position: 'absolute',
    width: G.starLargeSize,
    height: G.starLargeSize,
    borderRadius: G.starLargeSize / 2,
    backgroundColor: C.starWarm,
    opacity: C.starLargeOpacity,
  },
  rim: { position: 'absolute', opacity: G.rimRest },
  hidden: { opacity: 0 },
  trace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    borderRadius: deviceObject.radius,
    borderCurve: 'continuous',
    borderWidth: G.traceWidth,
    borderColor: C.amber,
    boxShadow: `0 0 ${G.traceGlow}px ${C.amber}`,
  },
  glow: { position: 'absolute', width: G.chargeGlow, height: G.chargeGlow, opacity: 0 },
  spark: { position: 'absolute', width: G.spark, height: G.spark, opacity: 0 },
  ring: {
    position: 'absolute',
    width: G.ring,
    height: G.ring,
    borderRadius: G.ring / 2,
    borderWidth: G.ringWidth,
    borderColor: C.ring,
    opacity: 0,
  },
  scan: { position: 'absolute', left: 0, right: 0, top: 0, height: G.scan, opacity: 0 },
});
