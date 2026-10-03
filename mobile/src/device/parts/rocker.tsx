import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { device, deviceColors, fontScaleCap, gadgetRadius, gadgetType } from '@/constants/theme';
import { useFinish } from '@/device/finish';
import { useHaptics } from '@/device/haptics';
import { DEVICE, EASE_KEY_FN } from '@/motion';

import { Lamp, type LampState } from './lamp';

/**
 * The strip holds what fits: regular lamps (10, gap 7) up to 6, compact (8, gap 4) up to 8,
 * then `n/m` text. PLAN §7's 12 / 16 thresholds don't fit the 106pt strip (7 lamps overflowed).
 */
const STRIP_ROOM = device.rockerWidth - device.rockerEnd * 2 - device.lampStripInset * 2;
const fits = (count: number, size: number, gap: number) => count * size + (count - 1) * gap <= STRIP_ROOM;

type RockerBase = {
  lamps: readonly LampState[];
  /** Index of a lamp that plays the turn-green flicker (a day just finished). */
  litIndex?: number;
  style?: StyleProp<ViewStyle>;
};

export type RockerProps =
  | (RockerBase & {
      /** Home: the week. The same body with no arrows; not interactive. */
      variant: 'week';
      /** VoiceOver summary, e.g. "Week 12, 2 of 4 days done". */
      accessibilityLabel: string;
    })
  | (RockerBase & {
      /** Logging and edit: ‹ › move between lifts; the middle opens Today (or returns to the plan). */
      variant: 'lifts';
      onPrev: () => void;
      onNext: () => void;
      onMiddle: () => void;
      prevDisabled?: boolean;
      nextDisabled?: boolean;
      prevLabel?: string;
      nextLabel?: string;
      middleLabel?: string;
    });

/**
 * The rocker (SPEC §4): a raised key 198 × 56 with 46pt ends and a recessed 30pt strip of lamps
 * in the middle. Pressing an end tilts the body ±10° (rotateY, 160 ms) and plays the rocker
 * haptic.
 */
export function Rocker(props: RockerProps) {
  const { palette } = useFinish();
  const haptics = useHaptics();
  const reduceMotion = useReducedMotion();
  const tilt = useSharedValue(0);
  // The tilt stays 2D. A rotateY with perspective (a 3D layer) left stale, uncomposited
  // rectangles over the display and the keys after a press on iOS (QA, Phase 4), whether the
  // perspective stayed on or came and went. 2D stand-in for rotateY ±10°: the body
  // foreshortens (cos 10°) and rocks a little toward the pressed end.
  const tiltStyle = useAnimatedStyle(() => {
    const t = tilt.get() / device.rockerTilt;
    return {
      transform: [
        { scaleX: 1 - Math.abs(t) * device.rockerTiltSqueeze },
        { rotate: `${t * device.rockerTiltRock}deg` },
      ],
    };
  });

  const rock = (direction: -1 | 1) => {
    haptics.rockerMove();
    if (reduceMotion) return;
    const timing = { duration: DEVICE.ROCKER_TILT, easing: EASE_KEY_FN };
    tilt.set(
      withSequence(
        withTiming(direction * device.rockerTilt, timing),
        withDelay(DEVICE.ROCKER - DEVICE.ROCKER_TILT, withTiming(0, timing)),
      ),
    );
  };

  const isWeek = props.variant === 'week';
  const shape = {
    width: device.rockerWidth,
    height: device.rockerHeight,
    borderRadius: gadgetRadius.key,
    borderCurve: 'continuous' as const,
  };

  const strip = <LampStrip lamps={props.lamps} litIndex={props.litIndex} />;

  return (
    <Animated.View
      accessible={isWeek}
      accessibilityLabel={isWeek ? props.accessibilityLabel : undefined}
      style={[shape, tiltStyle, props.style]}>
      <View
        pointerEvents="none"
        style={[
          styles.abs,
          shape,
          {
            top: device.keyLip,
            backgroundColor: palette.keyEdge,
            boxShadow: `0 ${6 - device.keyLip}px 10px ${palette.keyDrop}`,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          shape,
          styles.row,
          {
            backgroundColor: palette.key2,
            experimental_backgroundImage: `linear-gradient(180deg, ${palette.key1}, ${palette.key2})`,
            boxShadow: `inset 0 1px 0 ${palette.keyHighlight}`,
          },
        ]}>
        {props.variant === 'week' ? (
          <>
            <View style={styles.end} />
            <View style={[styles.mid, plateStyle]}>{strip}</View>
            <View style={styles.end} />
          </>
        ) : (
          <>
            <RockerEnd
              glyph="‹"
              label={props.prevLabel ?? 'Previous lift'}
              disabled={props.prevDisabled}
              onPress={() => {
                rock(-1);
                props.onPrev();
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.middleLabel ?? "Today's lifts"}
              onPressIn={() => haptics.key()}
              onPress={props.onMiddle}
              hitSlop={{ top: 13, bottom: 13 }}
              style={[styles.mid, plateStyle]}>
              {strip}
            </Pressable>
            <RockerEnd
              glyph="›"
              label={props.nextLabel ?? 'Next lift'}
              disabled={props.nextDisabled}
              onPress={() => {
                rock(1);
                props.onNext();
              }}
            />
          </>
        )}
      </View>
    </Animated.View>
  );
}

function RockerEnd({
  glyph,
  label,
  disabled = false,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.end, styles.center, { opacity: disabled ? device.rockerEndDisabledOpacity : 1 }]}>
      <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.bigKeyLabel, styles.endGlyph]}>
        {glyph}
      </Text>
    </Pressable>
  );
}

function LampStrip({ lamps, litIndex }: { lamps: readonly LampState[]; litIndex?: number }) {
  const regular = fits(lamps.length, device.lamp, device.lampGap);
  const compact = !regular && fits(lamps.length, device.lampCompact, device.lampGapCompact);
  if (!regular && !compact) {
    const current = lamps.findIndex((lamp) => lamp === 'on');
    return (
      <Text maxFontSizeMultiplier={1} style={gadgetType.keyWordSmall}>
        {`${current < 0 ? lamps.filter((lamp) => lamp === 'done').length : current + 1}/${lamps.length}`}
      </Text>
    );
  }
  return (
    <View style={[styles.row, { gap: compact ? device.lampGapCompact : device.lampGap }]}>
      {lamps.map((state, index) => (
        <Lamp key={index} state={state} compact={compact} lit={index === litIndex} />
      ))}
    </View>
  );
}

/**
 * The recessed lamp plate (finish mode, `.plate`): 190 × 44, a dark well in the body with 12pt
 * lamps, one per lift (green when that lift is done).
 */
export function LampPlate({
  lamps,
  accessibilityLabel,
  style,
}: {
  lamps: readonly LampState[];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useFinish();
  return (
    <View
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        styles.center,
        {
          width: device.plateWidth,
          height: device.plateHeight,
          borderRadius: device.plateHeight / 2,
          gap: device.plateLampGap,
          backgroundColor: palette.recessedPlate,
          boxShadow: `inset 0 2px 5px ${palette.plateShade}, 0 1px 0 ${palette.recessRimStrong}`,
        },
        style,
      ]}>
      {lamps.map((state, index) => (
        <Lamp key={index} state={state} surface="plate" />
      ))}
    </View>
  );
}

const plateStyle = {
  backgroundColor: deviceColors.plate,
  boxShadow: `inset 0 2px 4px ${deviceColors.plateShade}`,
};

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  end: { width: device.rockerEnd, height: device.rockerHeight },
  mid: {
    flex: 1,
    height: device.rockerStrip,
    borderRadius: device.rockerStrip / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endGlyph: { color: deviceColors.keyInk },
});
