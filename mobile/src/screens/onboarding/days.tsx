import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Pattern, Polygon, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { STARTER_DAY_COUNTS, type StarterDayCount } from '@/catalog/templates';
import { daysWheelColors, deviceObject, lcd, onboardingGeometry as G, onboardingType } from '@/constants/theme';
import { DeviceBody } from '@/device/parts';
import { useFinish } from '@/device/finish';
import { useHaptics } from '@/device/haptics';
import { DEVICE, EASE_DISPLAY_FN, SPRING } from '@/motion';

import { OnboardingFrame } from './frame';

const MIN = STARTER_DAY_COUNTS[0];
const MAX = STARTER_DAY_COUNTS[STARTER_DAY_COUNTS.length - 1];
const PERIOD = G.daysRidgeLight + G.daysRidgeDark;

const clampDays = (value: number): StarterDayCount => {
  'worklet';
  return Math.min(MAX, Math.max(MIN, Math.round(value))) as StarterDayCount;
};

/** Past 2 or 6 the wheel gives like a rubber band: `daysBand` of the finger at first, never more than `daysBandMax`. */
const give = (excess: number) => {
  'worklet';
  return G.daysBandMax * (1 - 1 / (1 + (excess * G.daysBand) / G.daysBandMax));
};
const band = (raw: number) => {
  'worklet';
  if (raw > MAX) return MAX + give(raw - MAX);
  if (raw < MIN) return MIN - give(MIN - raw);
  return raw;
};

/**
 * Step 4: the weekly target, which picks the split (D74). The wheel, Trim's standout control,
 * set to the days: a tall wheel on the right, a drum of numbers on the left riding it 1:1. A flick
 * carries on and clicks into a day; past 2 or 6 it gives and stops hard. No helper text.
 */
export function OnboardingDays() {
  const router = useRouter();
  const [days, setDays] = useState<StarterDayCount>(3);

  return (
    <OnboardingFrame
      title="Days a week"
      scroll={false}
      action={{
        title: 'Continue',
        onPress: () => router.push({ pathname: '/onboarding/plan', params: { days: String(days) } }),
      }}
      testID="onboarding-days">
      <DaysWheel value={days} onChange={setDays} />
    </OnboardingFrame>
  );
}

function DaysWheel({ value, onChange }: { value: StarterDayCount; onChange: (days: StarterDayCount) => void }) {
  const haptics = useHaptics();
  const [height, setHeight] = useState(0);
  const wheelHeight = Math.min(G.daysWheelMaxHeight, height);

  // Where the wheel is, in days (fractional while it moves).
  const pos = useSharedValue<number>(value);
  const start = useSharedValue<number>(value);

  const notch = useCallback(
    (day: number) => (day === MAX ? haptics.wheelNotchMajor() : haptics.wheelNotch()),
    [haptics],
  );
  const commit = useCallback((day: StarterDayCount) => onChange(day), [onChange]);

  // Every day the wheel passes clicks, while dragging and while it settles; past an end it stops hard.
  useAnimatedReaction(
    () => ({ day: clampDays(pos.get()), out: pos.get() > MAX + G.daysStopAt || pos.get() < MIN - G.daysStopAt }),
    (now, before) => {
      if (!before) return;
      if (now.day !== before.day) scheduleOnRN(notch, now.day);
      if (now.out && !before.out) scheduleOnRN(haptics.wheelStop);
    },
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      cancelAnimation(pos);
      start.set(pos.get());
    })
    .onUpdate((event) => {
      pos.set(band(start.get() - event.translationY / G.daysStep));
    })
    .onEnd((event) => {
      const velocity = -event.velocityY / G.daysStep;
      const target = clampDays(pos.get() + velocity * G.daysThrow);
      pos.set(withSpring(target, { ...SPRING.fling, velocity }));
      scheduleOnRN(commit, target);
    });

  const step = (direction: 1 | -1) => {
    const target = clampDays(value + direction);
    pos.set(withTiming(target, { duration: DEVICE.DRUM, easing: EASE_DISPLAY_FN }));
    onChange(target);
  };

  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);

  return (
    <View style={styles.stage} onLayout={onLayout}>
      {wheelHeight > 0 ? (
        <View style={[styles.row, { height: wheelHeight }]}>
          <View style={styles.drum} aria-hidden importantForAccessibility="no-hide-descendants">
            {STARTER_DAY_COUNTS.map((day) => (
              <DrumNumber key={day} day={day} pos={pos} value={value} top={(wheelHeight - onboardingType.wheelNumber.lineHeight) / 2} />
            ))}
          </View>
          <Svg width={G.daysNotch} height={G.daysNotch * 2} style={styles.notch}>
            <Polygon points={`${G.daysNotch},0 0,${G.daysNotch} ${G.daysNotch},${G.daysNotch * 2}`} fill={lcd.amber} />
          </Svg>
          <GestureDetector gesture={pan}>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Days a week"
              accessibilityValue={{ text: `${value} days` }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
              testID="onboarding-days-wheel">
              <TallWheel pos={pos} height={wheelHeight} />
            </View>
          </GestureDetector>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One number on the drum. React holds its resting place for `value` and the wheel's position
 * moves it from there (trim-ui §8 rule 8): if Reanimated ever drops the hand-over, the drum
 * still shows the day that was picked.
 */
function DrumNumber({ day, pos, value, top }: { day: number; pos: SharedValue<number>; value: number; top: number }) {
  const place = (at: number) => {
    'worklet';
    // Two steps away it's gone: the fade isn't capped, the shrink is.
    const distance = Math.abs(day - at);
    return {
      opacity: Math.max(0, 1 - distance * G.daysStepFade),
      transform: [{ translateY: (day - at) * G.daysRow }, { scale: 1 - Math.min(distance, 1) * G.daysStepScale }],
    };
  };
  const moving = useAnimatedStyle(() => place(pos.get()));
  return (
    <Animated.View style={[styles.number, { top }, place(value), moving]}>
      <Text maxFontSizeMultiplier={1} style={[onboardingType.wheelNumber, styles.center]}>
        {day}
      </Text>
    </Animated.View>
  );
}

/** The tall wheel in its metal bezel: ridges that follow the finger 1:1, shaded like a cylinder. */
function TallWheel({ pos, height }: { pos: SharedValue<number>; height: number }) {
  const { palette } = useFinish();
  const inner = height - G.daysWheelBezel * 2;
  const width = G.daysWheelWidth;
  const ridges = useAnimatedStyle(() => {
    const travel = -pos.get() * G.daysStep;
    const phase = ((travel % PERIOD) + PERIOD) % PERIOD;
    return { transform: [{ translateY: phase - PERIOD }] };
  });
  return (
    <View style={[styles.bezel, { width: width + G.daysWheelBezel * 2, height }]}>
      <View style={styles.bezelClip}>
        <DeviceBody rim rimRadius={G.daysWheelRadius + G.daysWheelBezel} />
      </View>
      <View style={[styles.cylinder, { width, height: inner, backgroundColor: palette.wheelLight }]}>
        <Animated.View style={[styles.ridges, ridges]}>
          <Svg width={width} height={inner + PERIOD * 2}>
            <Defs>
              <Pattern id="daysRidge" width={width} height={PERIOD} patternUnits="userSpaceOnUse">
                <Rect x={0} y={0} width={width} height={G.daysRidgeLight} fill={palette.wheelLight} />
                <Rect x={0} y={G.daysRidgeLight} width={width} height={G.daysRidgeDark} fill={palette.wheelDark} />
              </Pattern>
            </Defs>
            <Rect width={width} height={inner + PERIOD * 2} fill="url(#daysRidge)" />
          </Svg>
        </Animated.View>
        <Svg width={width} height={inner} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="daysCylinder" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={daysWheelColors.shade} stopOpacity={daysWheelColors.shadeOpacity} />
              <Stop offset="0.32" stopColor={daysWheelColors.shade} stopOpacity={0} />
              <Stop offset="0.5" stopColor={daysWheelColors.glint} stopOpacity={daysWheelColors.glintOpacity} />
              <Stop offset="0.68" stopColor={daysWheelColors.shade} stopOpacity={0} />
              <Stop offset="1" stopColor={daysWheelColors.shade} stopOpacity={daysWheelColors.shadeOpacity} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={inner} fill="url(#daysCylinder)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, justifyContent: 'center', paddingVertical: G.titleTop },
  row: { flexDirection: 'row', alignItems: 'center' },
  drum: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', overflow: 'hidden' },
  number: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  center: { textAlign: 'center' },
  notch: { marginRight: G.daysNotch },
  bezel: {
    borderRadius: G.daysWheelRadius + G.daysWheelBezel,
    borderCurve: 'continuous',
    boxShadow: `0 ${deviceObject.shadowY}px ${deviceObject.shadowBlur}px ${deviceObject.shadow}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bezelClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: G.daysWheelRadius + G.daysWheelBezel,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cylinder: { borderRadius: G.daysWheelRadius, borderCurve: 'continuous', overflow: 'hidden' },
  ridges: { position: 'absolute', left: 0, top: 0 },
});
