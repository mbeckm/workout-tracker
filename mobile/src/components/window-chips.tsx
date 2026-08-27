import { Pressable, Text, View } from 'react-native';

import { radius } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';
import type { ProgressWindow } from '@/domain/progress';

const WINDOWS: ProgressWindow[] = ['3M', '6M', 'YTD', 'All'];

export function WindowChips({
  value,
  onChange,
}: {
  value: ProgressWindow;
  onChange: (window: ProgressWindow) => void;
}) {
  const { colors, type } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {WINDOWS.map((window) => {
        const selected = window === value;
        return (
          <Pressable
            key={window}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(window)}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.full,
              borderCurve: 'continuous',
              backgroundColor: selected ? colors.label : colors.systemGray5,
              opacity: pressed ? 0.75 : 1,
            })}>
            <Text
              style={[
                type.subhead,
                {
                  fontSize: 15,
                  fontWeight: '500',
                  color: selected ? colors.systemBackground : colors.secondaryLabel,
                },
              ]}>
              {window}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
