import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

/** Same lane as the plan radios and trial nodes, so every text edge on the paywall lines up. */
export const FEATURE_TILE = 36;
/** (title 22 + 1 + detail 20 − tile 36) / 2 at the default text size. */
const TILE_INSET = 3.5;

/**
 * Icon tile + title 17 + one 15 line. The tile gives each benefit a scannable anchor.
 * The offer shows what the feature does; the success state shows where it lives.
 */
export function FeatureRow({
  title,
  detail,
  symbol,
  spokenDetail,
}: {
  title: string;
  detail: string;
  symbol: string;
  /** VoiceOver wording for `detail`, when the visible line uses glyphs. */
  spokenDetail?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${spokenDetail ?? detail}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      {/* Top-aligned, so at large text sizes the tile stays with the title instead of floating
          beside a tall block; the inset centres it on the default two-line row (43pt). */}
      <View
        style={{
          marginTop: TILE_INSET,
          width: FEATURE_TILE,
          height: FEATURE_TILE,
          borderRadius: 10,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondarySystemBackground,
        }}>
        <SymbolView name={symbol as SFSymbol} size={18} weight="semibold" tintColor={colors.label} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={[type.row, { fontWeight: '600' }]}>{title}</Text>
        <Text style={type.kicker}>{detail}</Text>
      </View>
    </View>
  );
}
