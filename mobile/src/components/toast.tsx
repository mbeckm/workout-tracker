import { SymbolView } from 'expo-symbols';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

import { PRESSED_OPACITY, TOUCH_TARGET, iconSize, radius, space } from '@/constants/theme';
import { DURATION, EASE_OUT, ENTER_OFFSET, SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/**
 * Confirm: a result that isn't on screen yet (a sheet that just closed), green check, ~2s.
 * Undo: something that just happened and can come back (`Plan deleted` + `Undo`), ~5s,
 * swipe down to dismiss (trim-ui §10 Toast, Forgiveness). One toast at a time; a new one
 * replaces the old. Not for errors: those stay in an alert or next to the control that failed.
 */
export type ToastInput = { title: string; onUndo?: () => void };

type ToastState = ToastInput & { id: number };

const VISIBLE_MS = 2200;
const UNDO_VISIBLE_MS = 5000;
/** VoiceOver needs time to reach `Undo`. */
const UNDO_VISIBLE_SCREEN_READER_MS = 10000;
/** A downward drag past this, or a flick, dismisses. */
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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Rises 8pt (trim-ui §8 Toast). */
const ENTER = FadeInUp.duration(DURATION.enter).easing(EASE_OUT).withInitialValues({
  opacity: 0,
  transform: [{ translateY: ENTER_OFFSET }],
});

/** Leaves the way it came: sinks 8pt as it fades. */
function exitDown() {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: DURATION.exit, easing: EASE_OUT }),
      transform: [{ translateY: withTiming(ENTER_OFFSET, { duration: DURATION.exit, easing: EASE_OUT }) }],
    },
  };
}

/** Clears the tab bar and the home indicator. */
const TAB_BAR_CLEARANCE = 84;

/**
 * Mount once near the root; it sits above the tab bar. A full-screen modal that needs toasts
 * (the paywall) mounts its own with `bottom`, because the root one is drawn underneath it.
 */
export function ToastHost({ bottom }: { bottom?: number } = {}) {
  const toast = useSyncExternalStore(subscribe, () => current, () => null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

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
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottom ?? insets.bottom + TAB_BAR_CLEARANCE,
        // The screen margin: at large Dynamic Type the pill wraps instead of touching the edges.
        paddingHorizontal: space.gutter,
        alignItems: 'center',
      }}>
      {toast ? (
        <Animated.View
          key={toast.id}
          style={{ maxWidth: '100%' }}
          entering={reduceMotion ? FadeIn.duration(DURATION.fade) : ENTER}
          exiting={reduceMotion ? FadeOut.duration(DURATION.fade) : exitDown}>
          <ToastPill toast={toast} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function ToastPill({ toast }: { toast: ToastState }) {
  const { colors, type } = useTheme();
  // Keep the toast's content while the exit animation runs after `current` is cleared.
  const [{ title, onUndo, id }] = useState(toast);
  const dragY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const undo = () => {
    hideToast(id);
    onUndo?.();
  };

  // Swipe down to dismiss: follows the finger 1:1 (never upward), then leaves downward with
  // the flick's velocity, or settles back.
  const swipe = Gesture.Pan()
    .enabled(onUndo != null)
    .activeOffsetY(8)
    .failOffsetY(-8)
    .onUpdate((event) => {
      dragY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        dragY.set(
          withSpring(dragY.get() + ENTER_OFFSET * 3, {
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
            paddingLeft: space.inset,
            paddingRight: onUndo ? space.related : space.inset,
            borderRadius: radius.full,
            borderCurve: 'continuous',
            backgroundColor: colors.label,
          },
          dragStyle,
        ]}>
        <Pressable
          onPress={() => hideToast(id)}
          accessibilityLabel={title}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.related, flexShrink: 1, paddingVertical: space.related }}>
          {onUndo == null ? (
            <SymbolView
              name="checkmark"
              size={iconSize.row}
              weight="semibold"
              tintColor={colors.systemGreen}
              fallback={<Text style={[type.body, { color: colors.systemGreen }]}>✓</Text>}
            />
          ) : null}
          <Text style={[type.body, { color: colors.onLabel, flexShrink: 1 }]}>{title}</Text>
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
            <Text style={[type.button, { color: colors.onLabel }]}>Undo</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
