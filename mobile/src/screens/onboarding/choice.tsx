import * as Haptics from 'expo-haptics';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-context';

export function selectionTick() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.selectionAsync();
  }
}

/**
 * A big-type radio: the chosen value is hero ink (64), the others are grey residue (28).
 * Used for units and days a week, where the value itself is the whole answer.
 */
export function BigChoice({
  label,
  accessibilityLabel,
  selected,
  onSelect,
  fixedHeight = false,
  style,
  testID,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onSelect: () => void;
  /** In a row, every cell keeps the hero's height so the baseline never moves. */
  fixedHeight?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        if (!selected) {
          selectionTick();
          onSelect();
        }
      }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: 44,
          minWidth: 44,
          justifyContent: 'flex-end',
          opacity: pressed && !selected ? 0.55 : 1,
        },
        style,
      ]}>
      <View style={fixedHeight ? { height: 68, justifyContent: 'flex-end' } : null}>
        <Text
          maxFontSizeMultiplier={1.2}
          style={
            selected
              ? [type.hero, { fontVariant: ['tabular-nums'] }]
              : [
                  type.residue,
                  {
                    color: colors.tertiaryLabel,
                    fontVariant: ['tabular-nums'],
                    // In a row, sit on the hero's baseline.
                    paddingBottom: fixedHeight ? 5 : 0,
                  },
                ]
          }>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
