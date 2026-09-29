import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { fontScaleCap, iconSize, radius, space } from '@/constants/theme';
import { weekdayLong, weekdayShort } from '@/domain/dates';
import type { WeekDayMark } from '@/domain/home-numbers';
import { useTheme } from '@/theme/theme-context';

/** One day's circle (trim-ui §13 Home: 40pt): read at arm's length, seven fit a 320pt phone. */
const DAY = 40;
/** Today's ring, the same weight as the focused well's ring (trim-ui → States). */
const RING = 2;

/**
 * The current week as seven days, Monday first (Home v3). A day with a
 * finished workout is a green circle with a check; today is an ink ring; every other day is
 * an empty grey circle. A missed day stays grey like a future one: Trim doesn't scold.
 */
export function WeekDays({ marks }: { marks: WeekDayMark[] }) {
  const { colors, type } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between' }}
      testID="home-week-days">
      {marks.map((mark) => (
        <View
          key={mark.date.toISOString()}
          accessible
          accessibilityLabel={[
            weekdayLong(mark.date),
            mark.isToday ? 'today' : null,
            mark.done ? 'trained' : null,
          ]
            .filter(Boolean)
            .join(', ')}
          style={{ alignItems: 'center', gap: space.related }}>
          <View
            style={{
              width: DAY,
              height: DAY,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mark.done
                ? colors.systemGreen
                : mark.isToday
                  ? colors.systemBackground
                  : colors.secondarySystemBackground,
              borderWidth: mark.isToday && !mark.done ? RING : 0,
              borderColor: colors.label,
            }}>
            {mark.done ? (
              <SymbolView
                name="checkmark"
                tintColor={colors.onGreen}
                size={iconSize.caption}
                weight="bold"
              />
            ) : null}
          </View>
          <Text
            style={[type.footnote, mark.isToday ? { color: colors.label } : null]}
            maxFontSizeMultiplier={fontScaleCap.title}>
            {weekdayShort(mark.date)}
          </Text>
        </View>
      ))}
    </View>
  );
}
