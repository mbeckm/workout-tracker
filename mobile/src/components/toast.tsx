import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import {
  PRESSED_OPACITY,
  TOUCH_TARGET,
  gadgetRadius,
  gadgetType,
  sheetColors,
  sheetGeometry,
  signal,
  space,
} from '@/constants/theme';
import { fromReferenceTop } from '@/device/layout';
import { DURATION, EASE_OUT, ENTER_OFFSET, SPRING } from '@/motion';

/**
 * Confirm: a result that isn't on screen yet (a sheet that just closed), ~2s.
 * Undo: something that just happened and can come back (`Plan deleted` + `Undo`), ~5s,
 * swipe it away (trim-ui §10 Toast, Forgiveness). The gadget's toast is a dark pill near the
 * top (prototype `.toast`), above the device and any sheet. One toast at a time; a new one
 * replaces the old. Not for errors: those stay in an alert or next to the control that failed.
 */
export type ToastInput = { title: string; onUndo?: () => void };

type ToastState = ToastInput & { id: number };

const VISIBLE_MS = 2200;
const UNDO_VISIBLE_MS = 5000;
/** VoiceOver needs time to reach `Undo`. */
const UNDO_VISIBLE_SCREEN_READER_MS = 10000;
/** A drag back towards its edge past this, or a flick, dismisses. */
const DISMISS_DISTANCE = 24;
const DISMISS_VELOCITY = 500;

let current: ToastState | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showToast(input: ToastInput) {
  current = { ...input, id: nextId++ };
  emit();
  AccessibilityInfo.announceForAccessibility(input.onUndo ? `${input.title}. Undo available.` : input.title);
}

function hideToast(id: number) {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

/** How far above the window's bottom edge the toast sits while a screen asks (the paywall); null: the top. */
let bottomOffset: number | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Arrives 8pt from its edge (trim-ui §8 Toast): drops in at the top, rises at the bottom. */
function enterFrom(direction: 1 | -1) {
  return FadeInUp.duration(DURATION.enter).easing(EASE_OUT).withInitialValues({
    opacity: 0,
    transform: [{ translateY: ENTER_OFFSET * direction }],
  });
}
const ENTER_TOP = enterFrom(-1);
const ENTER_BOTTOM = enterFrom(1);

/** Leaves the way it came. */
function exitTowards(direction: 1 | -1) {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
      animations: {
        opacity: withTiming(0, { duration: DURATION.exit, easing: EASE_OUT }),
        transform: [
          { translateY: withTiming(ENTER_OFFSET * direction, { duration: DURATION.exit, easing: EASE_OUT }) },
        ],
      },
    };
  };
}
const EXIT_TOP = exitTowards(-1);
const EXIT_BOTTOM = exitTowards(1);

/**
 * A screen whose top is busy (the paywall, a full-screen modal) moves the toast to `bottom`
 * points above the window's bottom edge while it's mounted.
 */
export function useToastBottom(bottom: number) {
  useEffect(() => {
    bottomOffset = bottom;
    emit();
    return () => {
      bottomOffset = null;
      emit();
    };
  }, [bottom]);
}

/**
 * Mount once at the root, after the navigator. On iOS it draws in a `FullWindowOverlay`, above
 * every native-stack screen and modal (the device and its sheets, onboarding, the paywall): a
 * plain sibling of the navigator is painted under pushed screens.
 */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, () => current, () => null);
  const bottom = useSyncExternalStore(subscribe, () => bottomOffset, () => null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const atTop = bottom == null;

  useEffect(() => {
    if (!toast) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (ms: number) => {
      if (!cancelled) {
        timer = setTimeout(() => hideToast(toast.id), ms);
      }
    };
    if (toast.onUndo) {
      AccessibilityInfo.isScreenReaderEnabled()
        .then((on) => schedule(on ? UNDO_VISIBLE_SCREEN_READER_MS : UNDO_VISIBLE_MS))
        .catch(() => schedule(UNDO_VISIBLE_MS));
    } else {
      schedule(VISIBLE_MS);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [toast]);

  return (
    <ToastLayer>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          ...(atTop ? { top: fromReferenceTop(sheetGeometry.toastTop, insets.top) } : { bottom }),
          // The screen margin: at large Dynamic Type the pill wraps instead of touching the edges.
          paddingHorizontal: space.gutter,
          alignItems: 'center',
        }}>
        {toast ? (
          <Animated.View
            key={toast.id}
            style={{ maxWidth: '100%' }}
            entering={reduceMotion ? FadeIn.duration(DURATION.fade) : atTop ? ENTER_TOP : ENTER_BOTTOM}
            exiting={reduceMotion ? FadeOut.duration(DURATION.fade) : atTop ? EXIT_TOP : EXIT_BOTTOM}>
            <ToastPill toast={toast} direction={atTop ? -1 : 1} />
          </Animated.View>
        ) : null}
      </View>
    </ToastLayer>
  );
}

/**
 * iOS: a window-level overlay. Touches outside the pill pass through, it isn't a VoiceOver modal,
 * and it sits outside the app's gesture root, so it brings its own for the swipe to dismiss.
 */
function ToastLayer({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') {
    return children;
  }
  return (
    <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </GestureHandlerRootView>
    </FullWindowOverlay>
  );
}

function ToastPill({ toast, direction }: { toast: ToastState; direction: 1 | -1 }) {
  // Keep the toast's content while the exit animation runs after `current` is cleared.
  const [{ title, onUndo, id }] = useState(toast);
  const dragY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const undo = () => {
    hideToast(id);
    onUndo?.();
  };

  // Swipe towards its edge to dismiss (up at the top): follows the finger 1:1 (never the other
  // way), then leaves with the flick's velocity, or settles back.
  const swipe = Gesture.Pan()
    .enabled(onUndo != null)
    .activeOffsetY(ENTER_OFFSET * direction)
    .failOffsetY(-ENTER_OFFSET * direction)
    .onUpdate((event) => {
      dragY.set(direction * Math.max(0, event.translationY * direction));
    })
    .onEnd((event) => {
      if (
        event.translationY * direction > DISMISS_DISTANCE ||
        event.velocityY * direction > DISMISS_VELOCITY
      ) {
        dragY.set(
          withSpring(dragY.get() + ENTER_OFFSET * 3 * direction, {
            ...SPRING.fling,
            velocity: event.velocityY,
            reduceMotion: ReduceMotion.System,
          }),
        );
        opacity.set(
          withTiming(0, { duration: DURATION.exit, easing: EASE_OUT }, (finished) => {
            if (finished) {
              scheduleOnRN(hideToast, id);
            }
          }),
        );
      } else {
        dragY.set(withSpring(0, { ...SPRING.settle, reduceMotion: ReduceMotion.System }));
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: dragY.get() }],
  }));

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        accessible={onUndo == null}
        accessibilityRole={onUndo == null ? 'alert' : undefined}
        accessibilityLabel={onUndo == null ? title : undefined}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.inline,
            minHeight: TOUCH_TARGET,
            paddingLeft: sheetGeometry.toastPadX,
            paddingRight: onUndo ? space.related : sheetGeometry.toastPadX,
            borderRadius: gadgetRadius.toast,
            borderCurve: 'continuous',
            backgroundColor: sheetColors.toast,
          },
          dragStyle,
        ]}>
        <Pressable
          onPress={() => hideToast(id)}
          accessibilityLabel={title}
          style={{ flexShrink: 1, paddingVertical: sheetGeometry.toastPadY }}>
          <Text style={[gadgetType.toast, { flexShrink: 1 }]}>{title}</Text>
        </Pressable>
        {onUndo ? (
          <Pressable
            onPress={undo}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            testID="toast-undo"
            style={({ pressed }) => ({
              minHeight: TOUCH_TARGET,
              justifyContent: 'center',
              paddingHorizontal: space.related,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            <Text style={[gadgetType.toast, { color: signal.orange }]}>Undo</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
