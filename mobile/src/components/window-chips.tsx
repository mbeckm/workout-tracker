import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { iconSize, PRESSED_OPACITY, radius, space } from '@/constants/theme';
import { DURATION, EASE_OUT } from '@/motion';
import {
  defaultProgressWindow,
  isProgressWindowLocked,
  PROGRESS_WINDOWS,
  type ProgressWindow,
} from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';

const WINDOW_NAMES: Record<ProgressWindow, string> = {
  '1M': 'Last month',
  '3M': 'Last 3 months',
  '6M': 'Last 6 months',
  '1Y': 'Last year',
  All: 'All time',
};

/** Drawn lock for platforms without SF Symbols (web / Android). Same size and ink. */
function LockFallback({ color }: { color: string }) {
  return (
    <View style={{ width: 9, height: 11, alignItems: 'center' }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderWidth: 1.5,
          borderBottomWidth: 0,
          borderColor: color,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
        }}
      />
      <View style={{ width: 9, height: 6, borderRadius: 1.5, backgroundColor: color }} />
    </View>
  );
}

/**
 * Window picker for Progress charts.
 * Gating hook (unused for now): chips where `locked(window)` is true stay visible with a quiet
 * SF Symbol lock, are never shown selected, and call `onLockedPress` (e.g. the Pro gate)
 * instead of `onChange`.
 */
export function WindowChips({
  value,
  onChange,
  locked,
  onLockedPress,
}: {
  /** `null` when no window is open (every chip locked). */
  value: ProgressWindow | null;
  onChange: (window: ProgressWindow) => void;
  locked?: (window: ProgressWindow) => boolean;
  onLockedPress?: (window: ProgressWindow) => void;
}) {
  const { colors, type } = useTheme();
  const opening = useOpeningLocks(locked);

  // Picking a range ticks like a scrub does, on the same frame the delta starts rolling and
  // the line starts morphing (trim-ui → Haptics). The selected chip and a locked one (it opens
  // the paywall: navigation) stay quiet.
  const pick = (window: ProgressWindow) => {
    if (window === value) {
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    onChange(window);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.related }}>
      {PROGRESS_WINDOWS.map((window) => {
        const isLocked = locked?.(window) ?? false;
        const selected = !isLocked && window === value;
        const ink = selected ? colors.onBrand : colors.secondaryLabel;
        return (
          <Pressable
            key={window}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? `${WINDOW_NAMES[window]}, Trim Pro` : WINDOW_NAMES[window]}
            accessibilityHint={isLocked ? 'Opens Trim Pro' : undefined}
            accessibilityState={{ selected }}
            testID={`window-chip-${window}`}
            onPress={() => (isLocked ? onLockedPress?.(window) : pick(window))}
            // Chips are 34pt tall; extend the touch target to 44pt.
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.tight,
              minHeight: 34,
              paddingHorizontal: space.inline,
              paddingVertical: space.related,
              borderRadius: radius.full,
              borderCurve: 'continuous',
              backgroundColor: selected ? colors.brand : colors.systemGray5,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            <Text style={[type.caption, { color: ink }]}>{window}</Text>
            {isLocked ? (
              <SymbolView
                name="lock.fill"
                size={iconSize.caption}
                tintColor={colors.tertiaryLabel}
                fallback={<LockFallback color={colors.tertiaryLabel} />}
              />
            ) : opening.includes(window) ? (
              // The purchase moment (trim-ui §12): the lock they tapped opens, then fades.
              <Animated.View exiting={FadeOut.duration(DURATION.exit).easing(EASE_OUT)}>
                <SymbolView
                  name="lock.open.fill"
                  size={iconSize.caption}
                  tintColor={selected ? colors.onBrand : colors.tertiaryLabel}
                  fallback={<LockFallback color={colors.tertiaryLabel} />}
                />
              </Animated.View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** How long an opened lock stays before it fades (the toast is rising meanwhile). */
const OPEN_LOCK_HOLD_MS = 900;

/** Chips that were locked on the previous render and aren't now: their lock opens once. */
function useOpeningLocks(locked: ((window: ProgressWindow) => boolean) | undefined): ProgressWindow[] {
  const lockedNow = PROGRESS_WINDOWS.filter((window) => locked?.(window) ?? false).join(',');
  const previous = useRef(lockedNow);
  const [opening, setOpening] = useState<ProgressWindow[]>([]);

  useEffect(() => {
    const before = previous.current.split(',').filter(Boolean) as ProgressWindow[];
    previous.current = lockedNow;
    const opened = before.filter((window) => !lockedNow.split(',').includes(window));
    if (opened.length === 0) {
      return;
    }
    setOpening(opened);
    const timer = setTimeout(() => setOpening([]), OPEN_LOCK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [lockedNow]);

  return opening;
}

/** The range picked on a detail screen, carried over to the next lift or body metric this session. */
let rememberedWindow: ProgressWindow | null = null;

/**
 * The detail screens' range (PRODUCT-DECISIONS 63: the range chosen carries over between
 * lifts). A picked range counts only while it's open to this user; otherwise the default.
 */
export function useProgressWindow(isPro: boolean): [ProgressWindow, (window: ProgressWindow) => void] {
  const [picked, setPicked] = useState<ProgressWindow | null>(rememberedWindow);
  const window = picked != null && !isProgressWindowLocked(picked, isPro) ? picked : defaultProgressWindow(isPro);
  const pick = (next: ProgressWindow) => {
    rememberedWindow = next;
    setPicked(next);
  };
  return [window, pick];
}
