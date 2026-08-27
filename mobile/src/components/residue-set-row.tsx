import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type EntryOrExitLayoutType,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme/theme-context';

const DELETE_TRAVEL = 36;
const ROW_RUBBER_DIM = 120;

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

type ResidueSetRowProps = {
  label: string;
  reduceMotion: boolean;
  resetKey: number;
  entering?: EntryOrExitLayoutType;
  onRequestDelete: () => void;
};

export function ResidueSetRow({
  label,
  reduceMotion,
  resetKey,
  entering,
  onRequestDelete,
}: ResidueSetRowProps): ReactElement {
  const { colors, type } = useTheme();
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);
  const armed = useSharedValue(0);
  const onRequestDeleteRef = useRef(onRequestDelete);
  onRequestDeleteRef.current = onRequestDelete;

  useEffect(() => {
    if (reduceMotion) {
      translateX.set(0);
      armed.set(0);
      return;
    }
    armed.set(0);
    translateX.set(withSpring(0, { duration: 300, dampingRatio: 0.85 }));
  }, [armed, reduceMotion, resetKey, translateX]);

  const requestDelete = () => {
    onRequestDeleteRef.current();
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .enabled(!reduceMotion)
        .onStart(() => {
          contextX.set(translateX.get());
        })
        .onUpdate((event) => {
          const next = contextX.get() + event.translationX;
          if (next >= 0) {
            translateX.set(rubberband(next, ROW_RUBBER_DIM));
            return;
          }
          if (next > -DELETE_TRAVEL) {
            translateX.set(next);
            return;
          }
          const overshoot = next + DELETE_TRAVEL;
          translateX.set(-DELETE_TRAVEL + rubberband(overshoot, ROW_RUBBER_DIM));
        })
        .onEnd((event) => {
          const projected = translateX.get() + project(event.velocityX);
          if (projected < -DELETE_TRAVEL * 0.72 || translateX.get() < -DELETE_TRAVEL * 0.85) {
            armed.set(1);
            translateX.set(
              withSpring(-DELETE_TRAVEL, {
                duration: 280,
                dampingRatio: 0.9,
                velocity: event.velocityX,
              }),
            );
            scheduleOnRN(requestDelete);
            return;
          }
          armed.set(0);
          translateX.set(
            withSpring(0, {
              duration: 300,
              dampingRatio: 0.85,
              velocity: event.velocityX,
            }),
          );
        }),
    [contextX, reduceMotion, translateX],
  );

  const longPressDelete = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(reduceMotion)
        .minDuration(450)
        .onEnd((_event, success) => {
          if (success) {
            armed.set(1);
            scheduleOnRN(requestDelete);
          }
        }),
    [armed, reduceMotion],
  );

  const gesture = useMemo(
    () => Gesture.Exclusive(pan, longPressDelete),
    [longPressDelete, pan],
  );

  const rowStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ translateX: translateX.get() }],
  }));

  const labelStyle = useAnimatedStyle(() => {
    const progress = Math.max(
      armed.get(),
      reduceMotion
        ? 0
        : interpolate(translateX.get(), [0, -DELETE_TRAVEL], [0, 1], Extrapolation.CLAMP),
    );
    return {
      color: interpolateColor(progress, [0, 1], [colors.label, colors.systemRed]),
    };
  });

  const strikeStyle = useAnimatedStyle(() => {
    const progress = Math.max(
      armed.get(),
      reduceMotion
        ? 0
        : interpolate(translateX.get(), [0, -DELETE_TRAVEL], [0, 1], Extrapolation.CLAMP),
    );
    return {
      opacity: progress,
      transform: [{ scaleX: interpolate(progress, [0, 1], [0.2, 1], Extrapolation.CLAMP) }],
    };
  });

  const checkStyle = useAnimatedStyle(() => {
    const progress = Math.max(
      armed.get(),
      reduceMotion
        ? 0
        : interpolate(translateX.get(), [0, -DELETE_TRAVEL], [0, 1], Extrapolation.CLAMP),
    );
    return {
      opacity: interpolate(progress, [0, 1], [1, 0.35], Extrapolation.CLAMP),
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        entering={entering}
        layout={LinearTransition.duration(200)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          reduceMotion ? 'Double tap and hold to delete this set' : 'Swipe left to delete this set'
        }
        style={[styles.row, rowStyle]}>
        <Animated.View style={checkStyle}>
          <SymbolView name="checkmark" size={17} weight="bold" tintColor={colors.systemGreen} />
        </Animated.View>
        <View style={styles.labelWrap}>
          <Animated.Text
            style={[type.body, { fontVariant: ['tabular-nums'] }, labelStyle]}
            numberOfLines={1}>
            {label}
          </Animated.Text>
          <Animated.View
            pointerEvents="none"
            style={[styles.strike, { backgroundColor: colors.systemRed }, strikeStyle]}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 28,
  },
  labelWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  strike: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    borderRadius: 1,
  },
});
