import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { radius } from '@/constants/theme';
import { PROGRESS_WINDOWS, type ProgressWindow } from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';

const WINDOW_NAMES: Record<ProgressWindow, string> = {
  '3M': 'Last 3 months',
  '6M': 'Last 6 months',
  YTD: 'Year to date',
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

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {PROGRESS_WINDOWS.map((window) => {
        const isLocked = locked?.(window) ?? false;
        const selected = !isLocked && window === value;
        const ink = selected ? colors.systemBackground : colors.secondaryLabel;
        return (
          <Pressable
            key={window}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? `${WINDOW_NAMES[window]}, Trim Pro` : WINDOW_NAMES[window]}
            accessibilityHint={isLocked ? 'Opens Trim Pro' : undefined}
            accessibilityState={{ selected }}
            testID={`window-chip-${window}`}
            onPress={() => (isLocked ? onLockedPress?.(window) : onChange(window))}
            // Chips are 34pt tall; extend the touch target to 44pt.
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              minHeight: 34,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.full,
              borderCurve: 'continuous',
              backgroundColor: selected ? colors.label : colors.systemGray5,
              opacity: pressed ? 0.75 : 1,
            })}>
            <Text style={[type.subhead, { fontSize: 15, fontWeight: '500', color: ink }]}>
              {window}
            </Text>
            {isLocked ? (
              <SymbolView
                name="lock.fill"
                size={11}
                tintColor={colors.tertiaryLabel}
                fallback={<LockFallback color={colors.tertiaryLabel} />}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
