import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PaperGrabber } from '@/components/paper';
import { radius } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

const SPRING_SHEET = { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } as const;
const SPRING_DISMISS = {
  duration: 280,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
} as const;

function snapHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function AnimatedSheet({
  visible,
  onClose,
  children,
  header,
  keyboardAccessory,
  hosted = false,
  dragFrom = 'sheet',
  expandable = false,
  expanded = false,
  onDragStart,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra drag surface under the grabber (title, etc.) when `dragFrom="grabber"`. */
  header?: ReactNode;
  /** Renders above the keyboard (e.g. Next / Done). */
  keyboardAccessory?: ReactNode;
  hosted?: boolean;
  dragFrom?: 'sheet' | 'grabber';
  /** Content-height + near-full detents; drag up to expand. */
  expandable?: boolean;
  /** Drive the large detent from outside (e.g. while typing). */
  expanded?: boolean;
  onDragStart?: () => void;
}) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const largeHeight = Math.round(windowHeight * 0.92);
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;

  const notifyDragStart = useMemo(
    () => () => {
      onDragStartRef.current?.();
    },
    [],
  );

  const translateY = useSharedValue(900);
  const dragOriginY = useSharedValue(0);
  const dragOriginHeight = useSharedValue(0);
  const sheetHeight = useSharedValue(640);
  const mediumHeight = useSharedValue(0);
  const entered = useSharedValue(0);
  /** 0 = medium (content), 1 = large */
  const snap = useSharedValue(0);
  const expandableSV = useSharedValue(expandable ? 1 : 0);

  useEffect(() => {
    expandableSV.set(expandable ? 1 : 0);
  }, [expandable, expandableSV]);

  useEffect(() => {
    if (!visible) {
      translateY.set(900);
      entered.set(0);
      snap.set(0);
    }
  }, [entered, snap, translateY, visible]);

  useEffect(() => {
    if (!visible || !expandable || entered.get() === 0) {
      return;
    }
    const next = expanded ? 1 : 0;
    if (snap.get() === next) {
      return;
    }
    snap.set(next);
    const medium = Math.max(mediumHeight.get(), 1);
    const target = next === 1 ? largeHeight : medium;
    translateY.set(withSpring(0, SPRING_SHEET));
    sheetHeight.set(withSpring(target, SPRING_SHEET));
  }, [expanded, expandable, entered, largeHeight, mediumHeight, sheetHeight, snap, translateY, visible]);

  const dismiss = () => {
    translateY.set(
      withSpring(sheetHeight.get(), SPRING_DISMISS, (finished) => {
        if (finished) {
          scheduleOnRN(onClose);
        }
      }),
    );
  };

  const tryEnter = (measured: number) => {
    if (!visible || measured <= 1) {
      return;
    }
    if (expandable) {
      const medium = Math.round(largeHeight * 0.58);
      mediumHeight.set(medium);
      if (entered.get() === 0) {
        entered.set(1);
        snap.set(expanded ? 1 : 0);
        const height = expanded ? largeHeight : medium;
        sheetHeight.set(height);
        translateY.set(largeHeight);
        translateY.set(withSpring(0, SPRING_SHEET));
      }
      return;
    }
    sheetHeight.set(measured);
    if (entered.get() === 0) {
      entered.set(1);
      translateY.set(measured);
      translateY.set(withSpring(0, SPRING_SHEET));
    }
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-24, 24])
        .onStart(() => {
          dragOriginY.set(translateY.get());
          dragOriginHeight.set(sheetHeight.get());
          scheduleOnRN(notifyDragStart);
        })
        .onUpdate((event) => {
          const medium = Math.max(mediumHeight.get(), 1);
          const large = largeHeight;

          if (expandableSV.get() === 1) {
            const nextHeight = dragOriginHeight.get() - event.translationY;
            if (nextHeight >= medium && nextHeight <= large) {
              sheetHeight.set(nextHeight);
              translateY.set(0);
              return;
            }
            if (nextHeight > large) {
              sheetHeight.set(large);
              translateY.set(rubberband(large - nextHeight, large));
              return;
            }
            sheetHeight.set(medium);
            translateY.set(medium - nextHeight);
            return;
          }

          const next = dragOriginY.get() + event.translationY;
          const size = sheetHeight.get();
          translateY.set(next >= 0 ? next : rubberband(next, size));
        })
        .onEnd((event) => {
          const medium = Math.max(mediumHeight.get(), 1);
          const large = largeHeight;
          const currentSnap = snap.get();

          if (expandableSV.get() === 1) {
            const projectedHeight =
              sheetHeight.get() - project(event.velocityY) - translateY.get();
            const dismissTravel = translateY.get() + project(event.velocityY);

            if (dismissTravel > medium * 0.28) {
              sheetHeight.set(medium);
              translateY.set(
                withSpring(
                  medium,
                  { ...SPRING_DISMISS, velocity: event.velocityY },
                  (finished) => {
                    if (finished) {
                      scheduleOnRN(onClose);
                    }
                  },
                ),
              );
              return;
            }

            let nextSnap = projectedHeight > (medium + large) * 0.5 ? 1 : 0;
            if (event.velocityY < -450) {
              nextSnap = 1;
            } else if (event.velocityY > 450) {
              nextSnap = 0;
            }

            const changed = nextSnap !== currentSnap;
            snap.set(nextSnap);
            const target = nextSnap === 1 ? large : medium;
            translateY.set(withSpring(0, { ...SPRING_SHEET, velocity: event.velocityY }));
            sheetHeight.set(
              withSpring(target, { ...SPRING_SHEET, velocity: -event.velocityY }, (finished) => {
                if (finished && changed) {
                  scheduleOnRN(snapHaptic);
                }
              }),
            );
            return;
          }

          const size = Math.max(sheetHeight.get(), 1);
          const projected = translateY.get() + project(event.velocityY);
          if (projected > size * 0.28) {
            translateY.set(
              withSpring(
                size,
                { ...SPRING_DISMISS, velocity: event.velocityY },
                (finished) => {
                  if (finished) {
                    scheduleOnRN(onClose);
                  }
                },
              ),
            );
            return;
          }

          translateY.set(
            withSpring(0, { ...SPRING_SHEET, velocity: event.velocityY }, (finished) => {
              if (finished) {
                scheduleOnRN(snapHaptic);
              }
            }),
          );
        }),
    [
      dragOriginHeight,
      dragOriginY,
      expandableSV,
      largeHeight,
      mediumHeight,
      notifyDragStart,
      onClose,
      sheetHeight,
      snap,
      translateY,
    ],
  );

  const sheetStyle = useAnimatedStyle(() => {
    const base = { transform: [{ translateY: translateY.get() }] };
    if (expandableSV.get() !== 1) {
      return { ...base, maxHeight: '92%' as const };
    }
    if (entered.get() === 0) {
      return { ...base, maxHeight: largeHeight };
    }
    return { ...base, height: sheetHeight.get(), maxHeight: largeHeight };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [0, Math.max(sheetHeight.get(), 1)],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const handle = (
    <View style={{ paddingBottom: header ? 12 : 0 }}>
      <PaperGrabber />
      {header != null ? header : null}
    </View>
  );

  const sheet = (
    <Animated.View
      onLayout={(event) => {
        if (expandable) {
          sheetHeight.set(snap.get() === 1 || expanded ? largeHeight : Math.round(largeHeight * 0.58));
          mediumHeight.set(Math.round(largeHeight * 0.58));
          if (entered.get() === 0) {
            tryEnter(Math.round(largeHeight * 0.58));
          }
          return;
        }
        tryEnter(event.nativeEvent.layout.height);
      }}
      style={[
        {
          backgroundColor: colors.secondarySystemBackground,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderCurve: 'continuous',
          paddingHorizontal: 24,
          paddingTop: 8,
          overflow: 'hidden',
        },
        sheetStyle,
      ]}>
      {dragFrom === 'grabber' ? <GestureDetector gesture={pan}>{handle}</GestureDetector> : handle}
      <View style={expandable ? { flex: 1, minHeight: 0 } : undefined}>{children}</View>
    </Animated.View>
  );

  const body = (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: '#00000047',
          },
          backdropStyle,
        ]}>
        <Pressable style={{ flex: 1 }} onPress={dismiss} accessibilityLabel="Dismiss" />
      </Animated.View>
      {dragFrom === 'sheet' ? <GestureDetector gesture={pan}>{sheet}</GestureDetector> : sheet}
      {keyboardAccessory}
    </View>
  );

  if (hosted) {
    return <View style={{ flex: 1 }}>{body}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>{body}</GestureHandlerRootView>
    </Modal>
  );
}
