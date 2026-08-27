import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

/** Shared plan / day editor rhythm: list hangs 32 under the hero; destructive group at 48. */
export const EDITOR_LIST_TOP = 32;
export const EDITOR_ACTIONS_TOP = 48;

const ICON_SLOT = 22;

type ActionTone = 'quiet' | 'default' | 'destructive';

export function EditorActionRow({
  title,
  symbol,
  onPress,
  tone = 'default',
  testID,
}: {
  title: string;
  symbol: SFSymbol;
  onPress: () => void;
  tone?: ActionTone;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const color =
    tone === 'destructive'
      ? colors.systemRed
      : tone === 'quiet'
        ? colors.tertiaryLabel
        : colors.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        paddingVertical: 14,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View
        style={{
          width: ICON_SLOT,
          height: ICON_SLOT,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
        <SymbolView name={symbol} tintColor={color} size={18} weight="medium" />
      </View>
      <Text style={[type.row, { color, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}
