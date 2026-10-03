import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { gadgetRadius, sheetColors, sheetGeometry } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import { sheetTop, type OpenSheet } from '@/device/device-state';
import { fromReferenceTop } from '@/device/layout';
import { useReanimatedKeyboardAnimation } from '@/keyboard';
import { DEVICE, EASE_SHEET_GADGET_FN, SPRING } from '@/motion';

import { SheetChromeContext, type SheetChrome } from './sheet-context';
import { SheetContent, sheetUsesKeyboard } from './registry';

/** Pan, rubber band and projection: the math from `components/animated-sheet.tsx`. */
function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** A drag (or a flick projected) past this share of the sheet dismisses it. */
const DISMISS_SHARE = 0.28;
/** Off-screen by a little more than its height (prototype `translateY(105%)`). */
const HIDDEN_SHARE = 1.05;

const SLIDE = { duration: DEVICE.SHEET, easing: EASE_SHEET_GADGET_FN } as const;
const SCRIM_FADE = { duration: DEVICE.SCRIM, easing: EASE_SHEET_GADGET_FN } as const;
const SPRING_BACK = { ...SPRING.fling, reduceMotion: ReduceMotion.System } as const;
const SPRING_AWAY = { ...SPRING.settle, overshootClamping: true, reduceMotion: ReduceMotion.System } as const;

/**
 * The one sheet controller (PLAN §4.1): a single visible sheet over the device, its content
 * swapped in place. Rendered in the device screen's own view tree (never a `Modal` or a native
 * formSheet), so the toast sits above it and the paywall modal presents over it.
 * Slides in and out over 380 ms; the scrim fades over 300. Dismissed by a swipe down, a tap on
 * the scrim, ✕ / Done, or VoiceOver's escape.
 */
export function SheetHost() {
  const { state, closeSheet } = useDevice();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const open = state.sheet;

  // The content stays mounted while the sheet slides away.
  const [shown, setShown] = useState<OpenSheet | null>(open);
  if (open && open !== shown) {
    // Adopt a new open or swap during render, so its content shows in the same frame.
    setShown(open);
  }
  const kind = open?.kind ?? shown?.kind ?? null;
  const top = kind ? fromReferenceTop(sheetGeometry.tops[sheetTop(kind)], insets.top) : 0;
  const sheetHeight = Math.max(1, windowHeight - top);

  /** 0 hidden, 1 up. */
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const scrim = useSharedValue(0);
  const height = useSharedValue(sheetHeight);
  const topY = useSharedValue(top);
  const scrollY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragOrigin = useSharedValue(0);
  /** The finger threw the sheet off-screen; closing needn't slide it again. */
  const swipedAway = useSharedValue(false);

  useEffect(() => {
    height.set(sheetHeight);
  }, [height, sheetHeight]);

  // A swap to a sheet with another top edge glides there with the sheet's curve.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && open) {
      topY.set(reduceMotion ? top : withTiming(top, SLIDE));
    } else {
      topY.set(top);
    }
  }, [open, reduceMotion, top, topY]);

  useEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        wasOpen.current = true;
        drag.set(0);
        scrollY.set(0);
        progress.set(withTiming(1, SLIDE));
        scrim.set(withTiming(1, SCRIM_FADE));
      }
      return;
    }
    if (!wasOpen.current) {
      return;
    }
    wasOpen.current = false;
    scrim.set(withTiming(0, SCRIM_FADE));
    if (swipedAway.get()) {
      // Already off-screen under the finger's momentum (and unmounted by `finishSwipe`).
      swipedAway.set(false);
      progress.set(0);
      drag.set(0);
      return;
    }
    progress.set(
      withTiming(0, SLIDE, (finished) => {
        if (finished) {
          drag.set(0);
          scheduleOnRN(setShown, null);
        }
      }),
    );
  }, [drag, open, progress, scrim, scrollY, swipedAway]);

  const finishSwipe = () => {
    setShown(null);
    closeSheet();
  };

  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-24, 24])
        .simultaneousWithExternalGesture(scrollGesture)
        .onStart(() => {
          dragging.set(false);
        })
        .onUpdate((event) => {
          const size = height.get();
          if (!dragging.get()) {
            // Only take over from the content at its top, pulling down (or up from rest).
            if (scrollY.get() > 0) {
              return;
            }
            dragging.set(true);
            dragOrigin.set(event.translationY - drag.get());
          }
          const next = event.translationY - dragOrigin.get();
          drag.set(next >= 0 ? next : rubberband(next, size));
        })
        .onEnd((event) => {
          if (!dragging.get()) {
            return;
          }
          dragging.set(false);
          const size = height.get();
          const projected = drag.get() + project(event.velocityY);
          if (projected > size * DISMISS_SHARE) {
            scrim.set(withTiming(0, SCRIM_FADE));
            swipedAway.set(true);
            drag.set(
              withSpring(size * HIDDEN_SHARE, { ...SPRING_AWAY, velocity: event.velocityY }, (finished) => {
                if (finished) {
                  scheduleOnRN(finishSwipe);
                }
              }),
            );
            return;
          }
          drag.set(withSpring(0, { ...SPRING_BACK, velocity: event.velocityY }));
        }),
    // finishSwipe only clears and closes the open sheet; a stale copy does the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drag, dragOrigin, dragging, height, scrim, scrollGesture, scrollY, swipedAway],
  );

  const keyboard = useReanimatedKeyboardAnimation();
  const usesKeyboard = kind ? sheetUsesKeyboard(kind) : false;

  const sheetStyle = useAnimatedStyle(() => {
    const size = height.get();
    const hidden = reduceMotion ? 0 : (1 - progress.get()) * size * HIDDEN_SHARE;
    return {
      top: topY.get(),
      opacity: reduceMotion ? progress.get() : 1,
      transform: [{ translateY: hidden + drag.get() }],
    };
  });

  const scrimStyle = useAnimatedStyle(() => {
    const size = Math.max(height.get(), 1);
    const follow = interpolate(drag.get(), [0, size], [1, 0], Extrapolation.CLAMP);
    return { opacity: scrim.get() * follow };
  });

  // The content ends above the keyboard while one is up (keyboard-aware sheets only).
  const bodyStyle = useAnimatedStyle(() => ({
    bottom: usesKeyboard ? -keyboard.height.get() : 0,
  }));

  const chrome = useMemo<SheetChrome>(
    () => ({
      scrollY,
      scrollGesture,
      focusKey: shown?.key ?? 0,
      close: closeSheet,
      keyboard: usesKeyboard,
    }),
    [closeSheet, scrollGesture, scrollY, shown?.key, usesKeyboard],
  );

  if (!shown) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'box-none' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSheet}
          accessible={false}
          importantForAccessibility="no"
        />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={closeSheet}
          style={[styles.sheet, sheetStyle]}>
          <Animated.View style={[styles.body, bodyStyle]}>
            <SheetChromeContext.Provider value={chrome}>
              <SheetContent sheet={shown} />
            </SheetChromeContext.Provider>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: sheetColors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: gadgetRadius.sheet,
    borderTopRightRadius: gadgetRadius.sheet,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.sheet,
    boxShadow: `0 -10px 30px ${sheetColors.shadow}`,
    overflow: 'hidden',
  },
  body: { position: 'absolute', left: 0, right: 0, top: 0 },
});
