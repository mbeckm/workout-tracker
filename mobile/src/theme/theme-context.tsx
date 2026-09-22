import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Appearance, StyleSheet, View } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  colorsForScheme,
  makeType,
  type AppearancePreference,
  type ColorScheme,
  type ThemeColors,
  type ThemeType,
} from '@/constants/theme';
import { EASE_OUT } from '@/motion';

type ThemeContextValue = {
  appearance: AppearancePreference;
  scheme: ColorScheme;
  colors: ThemeColors;
  type: ThemeType;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_FADE_MS = 280;

function resolveScheme(
  appearance: AppearancePreference,
  systemScheme: ColorScheme,
): ColorScheme {
  if (appearance === 'light' || appearance === 'dark') {
    return appearance;
  }
  return systemScheme;
}

/**
 * Light/Dark are JS-only. Never force Appearance.setColorScheme('light'|'dark').
 * System uses a persisted OS scheme from the store (updated by Appearance listener).
 */
export function AppThemeProvider({
  appearance,
  systemScheme,
  onSystemSchemeChange,
  children,
}: {
  appearance: AppearancePreference;
  systemScheme: ColorScheme;
  onSystemSchemeChange: (scheme: ColorScheme) => void;
  children: ReactNode;
}) {
  const scheme = resolveScheme(appearance, systemScheme);
  const reduceMotionRef = useRef(false);
  const onSystemSchemeChangeRef = useRef(onSystemSchemeChange);
  onSystemSchemeChangeRef.current = onSystemSchemeChange;

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) {
        reduceMotionRef.current = enabled;
      }
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    // Clear leftover window override from older builds — boot only.
    try {
      Appearance.setColorScheme('unspecified');
    } catch {
      // Some runtimes reject 'unspecified'; safe to ignore.
    }

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme === 'light' || colorScheme === 'dark') {
        onSystemSchemeChangeRef.current(colorScheme);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const palette = colorsForScheme(scheme);
    void SystemUI.setBackgroundColorAsync(palette.systemBackground).catch(() => undefined);
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(() => {
    const colors = colorsForScheme(scheme);
    return {
      appearance,
      scheme,
      colors,
      type: makeType(colors),
    };
  }, [appearance, scheme]);

  return (
    <ThemeContext.Provider value={value}>
      <ThemeCrossfade scheme={scheme} reduceMotionRef={reduceMotionRef}>
        {children}
      </ThemeCrossfade>
    </ThemeContext.Provider>
  );
}

function ThemeCrossfade({
  scheme,
  reduceMotionRef,
  children,
}: {
  scheme: ColorScheme;
  reduceMotionRef: MutableRefObject<boolean>;
  children: ReactNode;
}) {
  const prevSchemeRef = useRef(scheme);
  const [coverColor, setCoverColor] = useState(() => colorsForScheme(scheme).systemBackground);
  const coverOpacity = useSharedValue(0);

  useEffect(() => {
    const previous = prevSchemeRef.current;
    if (previous === scheme) {
      return;
    }
    prevSchemeRef.current = scheme;

    if (reduceMotionRef.current) {
      cancelAnimation(coverOpacity);
      coverOpacity.value = 0;
      return;
    }

    // Paint the previous scheme over the new tree, then fade it out.
    // Keep this Animated.View mounted forever — unmounting it from a
    // withTiming completion callback crashed on Dark → System.
    setCoverColor(colorsForScheme(previous).systemBackground);
    cancelAnimation(coverOpacity);
    coverOpacity.value = 1;
    coverOpacity.value = withTiming(0, {
      duration: THEME_FADE_MS,
      easing: EASE_OUT,
    });
  }, [scheme, coverOpacity, reduceMotionRef]);

  const coverStyle = useAnimatedStyle(() => ({
    opacity: coverOpacity.value,
  }));

  return (
    <View style={styles.root}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: coverColor }, coverStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  cover: {
    zIndex: 999,
  },
});

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within AppThemeProvider');
  }
  return context;
}
