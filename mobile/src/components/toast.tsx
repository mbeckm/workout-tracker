import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOUCH_TARGET, iconSize, radius, space } from '@/constants/theme';
import { DURATION, EASE_OUT, ENTER_OFFSET } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/**
 * Confirmation for an action whose result isn't on screen yet (a sheet that just closed).
 * One toast at a time; a new one replaces the old. Not for errors: those stay in an alert
 * or next to the control that failed.
 */
export type ToastInput = { title: string };

type ToastState = ToastInput & { id: number };

const VISIBLE_MS = 2200;

let current: ToastState | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showToast(input: ToastInput) {
  current = { ...input, id: nextId++ };
  emit();
  AccessibilityInfo.announceForAccessibility(input.title);
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
    const timer = setTimeout(() => hideToast(toast.id), VISIBLE_MS);
    return () => clearTimeout(timer);
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
  // Keep the title while the exit animation runs after `current` is cleared.
  const [title] = useState(toast.title);
  const id = useRef(toast.id).current;
  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLabel={title}
      onPress={() => hideToast(id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.related,
        minHeight: TOUCH_TARGET,
        paddingHorizontal: space.inset,
        paddingVertical: space.related,
        borderRadius: radius.full,
        borderCurve: 'continuous',
        backgroundColor: colors.label,
      }}>
      <SymbolView
        name="checkmark"
        size={iconSize.row}
        weight="semibold"
        tintColor={colors.systemGreen}
        fallback={<Text style={[type.body, { color: colors.systemGreen }]}>✓</Text>}
      />
      <Text style={[type.body, { color: colors.onLabel, flexShrink: 1 }]}>{title}</Text>
    </Pressable>
  );
}
