import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { radius } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

/** SF Symbol crown; a glyph stands in where SF Symbols do not render (web QA). */
function CrownGlyph({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name="crown.fill"
      tintColor={colors.systemYellow}
      size={size}
      weight="medium"
      fallback={
        <Text
          style={{ color: colors.systemYellow, fontSize: size, lineHeight: size + 2 }}
          allowFontScaling={false}>
          ♛
        </Text>
      }
    />
  );
}

/**
 * Yellow crown for a personal best: next to a recap exercise (Done) or a set line
 * (Session detail). Announced as "Personal best" unless a parent reads the whole row.
 */
export function PrCrown({ size = 13 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Personal best"
      style={{ flexShrink: 0 }}>
      <CrownGlyph size={size} />
    </View>
  );
}

/** History row trailing: quiet grey pill with crown · n · PR / PRs. */
export function PrCrownCount({ count }: { count: number }) {
  const { colors, type } = useTheme();
  if (count <= 0) {
    return null;
  }
  const label = count === 1 ? 'PR' : 'PRs';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        backgroundColor: colors.secondarySystemBackground,
        borderRadius: radius.full,
        borderCurve: 'continuous',
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}>
      <CrownGlyph size={12} />
      <Text
        style={[
          type.kicker,
          {
            color: colors.secondaryLabel,
            lineHeight: 18,
            fontVariant: ['tabular-nums'],
          },
        ]}
        maxFontSizeMultiplier={1.4}>
        {count}
      </Text>
      <Text
        style={[type.kicker, { color: colors.secondaryLabel, lineHeight: 18 }]}
        maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}
