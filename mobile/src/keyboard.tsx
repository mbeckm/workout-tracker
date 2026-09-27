import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import {
  Keyboard,
  Platform,
  TurboModuleRegistry,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { isExpoGo } from '@/purchases/purchases';

type KeyboardModule = typeof import('react-native-keyboard-controller');

type KeyboardMotion = {
  height: SharedValue<number>;
  progress: SharedValue<number>;
};

function loadKeyboard(): KeyboardModule | null {
  if (isExpoGo) {
    return null;
  }
  // The JS package can be present while the native module isn't (a dev build older than the
  // dependency). Using it then breaks sticky footers, so fall back to plain RN events.
  if (Platform.OS === 'web' || TurboModuleRegistry?.get?.('KeyboardController') == null) {
    return null;
  }
  try {
    return require('react-native-keyboard-controller') as KeyboardModule;
  } catch {
    return null;
  }
}

const keyboard = loadKeyboard();

let fallbackVisible = false;
const fallbackListeners = new Set<() => void>();

function setFallbackVisible(next: boolean) {
  if (fallbackVisible === next) {
    return;
  }
  fallbackVisible = next;
  fallbackListeners.forEach((listener) => listener());
}

function subscribeFallbackVisible(listener: () => void) {
  fallbackListeners.add(listener);
  return () => {
    fallbackListeners.delete(listener);
  };
}

if (!keyboard) {
  const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
  Keyboard.addListener(showEvent, () => setFallbackVisible(true));
  Keyboard.addListener(hideEvent, () => setFallbackVisible(false));
}

/** Matches react-native-keyboard-controller: height is 0 closed, −keyboardHeight open. */
function useFallbackKeyboardMotion(): KeyboardMotion {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    const animate = (event: KeyboardEvent, open: boolean) => {
      const nextHeight = open ? -event.endCoordinates.height : 0;
      const duration = Platform.OS === 'ios' ? Math.max(event.duration, 1) : 250;
      height.set(withTiming(nextHeight, { duration }));
      progress.set(withTiming(open ? 1 : 0, { duration }));
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => animate(event, true));
    const hide = Keyboard.addListener(hideEvent, (event) => animate(event, false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [height, progress]);

  return { height, progress };
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  if (!keyboard) {
    return children;
  }
  const Provider = keyboard.KeyboardProvider;
  return <Provider>{children}</Provider>;
}

export function KeyboardStickyView({
  children,
  offset,
  style,
}: {
  children: ReactNode;
  offset?: { closed?: number; opened?: number };
  style?: StyleProp<ViewStyle>;
}) {
  if (keyboard) {
    const Sticky = keyboard.KeyboardStickyView;
    return (
      <Sticky offset={offset} style={style}>
        {children}
      </Sticky>
    );
  }

  return (
    <FallbackKeyboardStickyView offset={offset} style={style}>
      {children}
    </FallbackKeyboardStickyView>
  );
}

function FallbackKeyboardStickyView({
  children,
  offset,
  style,
}: {
  children: ReactNode;
  offset?: { closed?: number; opened?: number };
  style?: StyleProp<ViewStyle>;
}) {
  const closed = offset?.closed ?? 0;
  const opened = offset?.opened ?? 0;
  const { height, progress } = useFallbackKeyboardMotion();
  const stickyStyle = useAnimatedStyle(() => {
    const extra = closed + (opened - closed) * progress.get();
    return {
      transform: [{ translateY: height.get() + extra }],
    };
  });

  return <Animated.View style={[style, stickyStyle]}>{children}</Animated.View>;
}

export const useKeyboardState = keyboard
  ? keyboard.useKeyboardState
  : function useKeyboardStateFallback<T>(selector: (state: { isVisible: boolean }) => T): T {
      const isVisible = useSyncExternalStore(
        subscribeFallbackVisible,
        () => fallbackVisible,
        () => false,
      );
      return selector({ isVisible });
    };

export const useReanimatedKeyboardAnimation = keyboard
  ? keyboard.useReanimatedKeyboardAnimation
  : useFallbackKeyboardMotion;
