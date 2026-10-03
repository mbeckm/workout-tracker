import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import {
  objectColors,
  onboardingType,
  paywallColors,
  paywallGeometry as geo,
  sheetColors,
  signal,
} from '@/constants/theme';
import { haptics } from '@/device/haptics';
import { DEVICE, EASE_KNOB_FN } from '@/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Room around the knob for the arc and the FREE mark. */
const SIDE = geo.arcGap + 44;
const MARK_ROW = onboardingType.knobMark.lineHeight + geo.markGap;
const WIDTH = geo.knob + SIDE * 2;
const HEIGHT = MARK_ROW + geo.arcGap + geo.knob + geo.knobLip;
const CX = WIDTH / 2;
const CY = MARK_ROW + geo.arcGap + geo.knob / 2;
const ARC_R = geo.knob / 2 + geo.arcGap;
const SWEEP = geo.proAngle - geo.freeAngle;
const ARC_LENGTH = (ARC_R * SWEEP * Math.PI) / 180;

/** A point on a circle around the knob's centre; 0° points up, angles grow clockwise. */
function polar(radius: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

const ARC_FROM = polar(ARC_R, geo.freeAngle);
const ARC_TO = polar(ARC_R, geo.proAngle);
const ARC = `M ${ARC_FROM.x} ${ARC_FROM.y} A ${ARC_R} ${ARC_R} 0 0 1 ${ARC_TO.x} ${ARC_TO.y}`;
const FREE_AT = polar(ARC_R + geo.arcGap + geo.markGap, geo.freeAngle);

/** 0 at FREE, 1 at PRO. */
function progressOf(angle: number) {
  'worklet';
  return (angle - geo.freeAngle) / SWEEP;
}

/**
 * The paywall's hero (N9, D13, trim-ui §12 rule 15): a metal knob with a ridged rim, a light cap
 * and an orange pointer, on a dial from FREE to PRO. On appear it turns once from FREE to PRO
 * (a detent tick on the way, a firmer one at PRO), lighting the arc behind it; then it rests.
 * Reduce Motion: it's simply at PRO. `turned` reports the knob reaching PRO, for the feature lamps.
 */
export function KnobHero({ turned }: { turned: SharedValue<number> }) {
  const reduceMotion = Boolean(useReducedMotion());
  const angle = useSharedValue<number>(reduceMotion ? geo.proAngle : geo.freeAngle);

  useEffect(() => {
    if (reduceMotion) {
      angle.set(geo.proAngle);
      turned.set(1);
      return;
    }
    angle.set(
      withDelay(
        DEVICE.KNOB_DELAY,
        withTiming(geo.proAngle, { duration: DEVICE.KNOB_TURN, easing: EASE_KNOB_FN, reduceMotion: ReduceMotion.Never }),
      ),
    );
  }, [angle, reduceMotion, turned]);

  // A detent per ridge step as it turns, a firmer one landing on PRO.
  useAnimatedReaction(
    () => Math.round(progressOf(angle.get()) * geo.detents),
    (step, previous) => {
      if (previous == null || step === previous) {
        return;
      }
      if (step >= geo.detents) {
        turned.set(1);
        scheduleOnRN(haptics.wheelNotchMajor);
      } else {
        scheduleOnRN(haptics.wheelNotch);
      }
    },
  );

  const turnStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - Math.min(1, Math.max(0, progressOf(angle.get())))),
  }));
  const proStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * Math.min(1, Math.max(0, progressOf(angle.get()))) }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="A knob turned from Free to Pro"
      style={styles.hero}>
      <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Path d={ARC} stroke={paywallColors.arcOff} strokeWidth={geo.arcStroke - 1} fill="none" strokeLinecap="round" />
        <AnimatedPath
          d={ARC}
          stroke={signal.orange}
          strokeWidth={geo.arcStroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={[ARC_LENGTH, ARC_LENGTH]}
          animatedProps={arcProps}
        />
      </Svg>
      <Animated.Text maxFontSizeMultiplier={1} style={[onboardingType.knobMark, styles.pro, proStyle]}>
        PRO
      </Animated.Text>
      <Text
        maxFontSizeMultiplier={1}
        style={[
          onboardingType.knobMark,
          styles.free,
          { left: FREE_AT.x - FREE_W / 2, top: FREE_AT.y - onboardingType.knobMark.lineHeight / 2 },
        ]}>
        FREE
      </Text>
      <View style={styles.lip} />
      <Animated.View style={[styles.knob, turnStyle]}>
        <Ridges />
        <View style={styles.cap}>
          <View style={styles.pointer} />
        </View>
      </Animated.View>
    </View>
  );
}

/** The ridged rim: light, with a dark 2° ridge every 4° (N9 `repeating-conic-gradient`). */
function Ridges() {
  const paths = useMemo(() => {
    const r = geo.knob / 2;
    const step = 360 / geo.knobRidges;
    return Array.from({ length: geo.knobRidges }, (_, index) => {
      const a0 = ((index * step) * Math.PI) / 180;
      const a1 = ((index * step + step / 2) * Math.PI) / 180;
      const x0 = r + r * Math.sin(a0);
      const y0 = r - r * Math.cos(a0);
      const x1 = r + r * Math.sin(a1);
      const y1 = r - r * Math.cos(a1);
      return `M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
    });
  }, []);
  return (
    <Svg width={geo.knob} height={geo.knob} style={StyleSheet.absoluteFill}>
      <Circle cx={geo.knob / 2} cy={geo.knob / 2} r={geo.knob / 2} fill={objectColors.ridgeLight} />
      {paths.map((d, index) => (
        <Path key={index} d={d} fill={objectColors.ridgeDark} />
      ))}
    </Svg>
  );
}

/** FREE's box, so it centres on its point on the dial. */
const FREE_W = 44;
const KNOB_TOP = MARK_ROW + geo.arcGap;

const styles = StyleSheet.create({
  hero: { width: WIDTH, height: HEIGHT, alignSelf: 'center' },
  pro: { position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', color: signal.orange },
  free: {
    position: 'absolute',
    width: FREE_W,
    textAlign: 'center',
    color: paywallColors.arcOff,
    transform: [{ rotate: `${geo.freeAngle / 2}deg` }],
  },
  lip: {
    position: 'absolute',
    left: SIDE,
    top: KNOB_TOP + geo.knobLip,
    width: geo.knob,
    height: geo.knob,
    borderRadius: geo.knob / 2,
    backgroundColor: objectColors.lip,
    boxShadow: `0 20px 40px ${paywallColors.knobShadow}`,
  },
  knob: {
    position: 'absolute',
    left: SIDE,
    top: KNOB_TOP,
    width: geo.knob,
    height: geo.knob,
    borderRadius: geo.knob / 2,
    overflow: 'hidden',
  },
  cap: {
    position: 'absolute',
    top: geo.knobCapInset,
    left: geo.knobCapInset,
    right: geo.knobCapInset,
    bottom: geo.knobCapInset,
    borderRadius: geo.knob / 2,
    backgroundColor: objectColors.capLo,
    experimental_backgroundImage: `radial-gradient(circle at 40% 30%, ${objectColors.capHi}, ${objectColors.capLo})`,
    boxShadow: `inset 0 2px 0 ${objectColors.paper}, 0 4px 8px ${sheetColors.shadow}`,
    alignItems: 'center',
  },
  pointer: {
    marginTop: geo.pointerTop,
    width: geo.pointerW,
    height: geo.pointerH,
    borderRadius: geo.pointerW / 2,
    backgroundColor: signal.orange,
    boxShadow: `0 0 10px ${paywallColors.pointerGlow}`,
  },
});
