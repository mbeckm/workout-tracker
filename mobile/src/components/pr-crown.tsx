import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { radius } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

/** Icon-only crown — mark a single PR set in session detail. */
export function PrCrown({ size = 13 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <SymbolView name="crown.fill" tintColor={colors.systemYellow} size={size} weight="medium" />
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        backgroundColor: colors.secondarySystemBackground,
        borderRadius: radius.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}>
      <SymbolView name="crown.fill" tintColor={colors.systemYellow} size={12} weight="medium" />
      <Text
        style={[
          type.kicker,
          {
            color: colors.secondaryLabel,
            lineHeight: 18,
            fontVariant: ['tabular-nums'],
          },
        ]}>
        {count}
      </Text>
      <Text style={[type.kicker, { color: colors.secondaryLabel, lineHeight: 18 }]}>{label}</Text>
    </View>
  );
}
