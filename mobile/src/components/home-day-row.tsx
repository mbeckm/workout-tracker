import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { MetaRow, spokenMeta, type MetaItem } from '@/components/meta-row';
import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

/**
 * Third tier on Home: stops growing at 1.35× (title ~23pt, meta ~20pt) so it stays under the
 * week amount (30pt max) and the day title (48pt max) at every Dynamic Type size.
 */
const OTHER_DAYS_MAX_SCALE = 1.35;

/**
 * One of the plan's other days on Home: title 17 regular + the meta row (`5 exercises · ~45 min`,
 * or `Done Fri 25` once it's done this week), the same grey line as every other meta row. The
 * third tier under Start: nothing here is ink except an open day's title. A day done this week
 * steps back (grey title, green check), so the days still open carry the list. Tap opens the
 * preview, where it can be started.
 */
export function HomeDayRow({
  day,
  meta,
  doneThisWeek,
  showSeparator = false,
  onPress,
  testID,
}: {
  day: WorkoutDay;
  meta: (MetaItem | null)[];
  doneThisWeek: boolean;
  showSeparator?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const spoken = meta.filter((item): item is MetaItem => item != null).map(spokenMeta);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[day.title, ...spoken].join(', ')}
      accessibilityHint="Shows this day. Start it from there."
      testID={testID}
      style={({ pressed }) => ({
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: showSeparator ? 0.5 : 0,
        borderBottomColor: colors.separator,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={[type.body, doneThisWeek ? { color: colors.tertiaryLabel } : null]}
          numberOfLines={1}
          maxFontSizeMultiplier={OTHER_DAYS_MAX_SCALE}>
          {day.title}
        </Text>
        <MetaRow items={meta} maxScale={OTHER_DAYS_MAX_SCALE} accessibilityLabel="" />
      </View>
      {doneThisWeek ? (
        <SymbolView name="checkmark" tintColor={colors.systemGreen} size={16} weight="semibold" />
      ) : null}
    </Pressable>
  );
}
