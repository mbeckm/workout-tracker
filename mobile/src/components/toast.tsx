import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EASE_OUT } from '@/motion';
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

const ENTER = FadeInDown.duration(240).easing(EASE_OUT).withInitialValues({
  opacity: 0,
  transform: [{ translateY: 12 }],
});
const EXIT = FadeOutDown.duration(160).easing(EASE_OUT);

/** Mount once near the root. Sits above the tab bar, clear of the home indicator. */
export function ToastHost() {
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
        bottom: insets.bottom + 84,
        alignItems: 'center',
      }}>
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={reduceMotion ? FadeIn.duration(160) : ENTER}
          exiting={reduceMotion ? FadeOut.duration(120) : EXIT}>
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
        gap: 8,
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        borderCurve: 'continuous',
        backgroundColor: colors.label,
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      }}>
      <SymbolView
        name="checkmark.circle.fill"
        size={18}
        tintColor={colors.systemGreen}
        fallback={<Text style={{ color: colors.systemGreen, fontSize: 16 }}>✓</Text>}
      />
      <Text style={[type.body, { color: colors.onLabel, fontWeight: '600' }]}>{title}</Text>
    </Pressable>
  );
}
