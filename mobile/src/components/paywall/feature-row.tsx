import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Text, View } from 'react-native';

import { iconSize, radius, space } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

/** Same lane as the plan radios and trial nodes, so every text edge on the paywall lines up. */
export const FEATURE_TILE = 36;

/**
 * Icon tile + `row` title + one `caption` line: what the buyer gets (trim-ui §12 rule 8).
 */
export function FeatureRow({ title, detail, symbol }: { title: string; detail: string; symbol: string }) {
  const { colors, type } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${detail}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.inline }}>
      {/* Top-aligned, so at large text sizes the tile stays with the title instead of floating
          beside a tall block; `tight` centres it on the default two-line row
          ((22 + 2 + 20 − 36) / 2 = 4). */}
      <View
        style={{
          marginTop: space.tight,
          width: FEATURE_TILE,
          height: FEATURE_TILE,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondarySystemBackground,
        }}>
        <SymbolView name={symbol as SFSymbol} size={iconSize.row} weight="semibold" tintColor={colors.label} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
        <Text style={type.row}>{title}</Text>
        <Text style={type.caption}>{detail}</Text>
      </View>
    </View>
  );
}
