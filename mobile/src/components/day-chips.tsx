import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space } from '@/constants/theme';
import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

/**
 * A plan's days as chips, on Home and in the plan editor (trim-ui §1 rule 15: the same control
 * means the same thing everywhere): selected in the brand hue, others gray fill. `renderMark`
 * adds a trailing mark (Home's green ✓ on a day done this week). With `onAdd`, a last `+` chip
 * adds a day. They scroll sideways when a plan has more than fit, keeping the selected chip in
 * view, and fade out at the screen's edges.
 */
export function DayChips({
  days,
  selectedIndex,
  onSelect,
  renderMark,
  accessibilityLabelFor,
  onAdd,
  testID,
}: {
  days: WorkoutDay[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderMark?: (day: WorkoutDay, selected: boolean) => ReactNode;
  accessibilityLabelFor?: (day: WorkoutDay) => string;
  onAdd?: () => void;
  testID: string;
}) {
  const { colors, type } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const chipX = useRef<number[]>([]);

  useEffect(() => {
    const x = chipX.current[selectedIndex];
    if (x == null) {
      return;
    }
    scrollRef.current?.scrollTo({ x: Math.max(0, x - space.margin), animated: true });
  }, [selectedIndex, days.length]);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ gap: space.related, paddingHorizontal: space.margin }}
        testID={testID}>
        {days.map((day, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={day.id}
              testID={`${testID}-${index}`}
              onLayout={(event) => {
                chipX.current[index] = event.nativeEvent.layout.x;
              }}
              onPress={() => onSelect(index)}
              accessibilityRole="tab"
              accessibilityLabel={accessibilityLabelFor?.(day) ?? day.title}
              accessibilityState={{ selected }}
              // Chips are 36pt tall; extend the touch target to 44pt.
              hitSlop={{ top: space.tight, bottom: space.tight }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.tight,
                paddingVertical: space.related,
                paddingHorizontal: space.inset,
                borderRadius: radius.full,
                borderCurve: 'continuous',
                backgroundColor: selected ? colors.brand : colors.secondarySystemBackground,
                opacity: pressed && !selected ? PRESSED_OPACITY : 1,
              })}>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={fontScaleCap.title}
                style={[type.row, { color: selected ? colors.onBrand : colors.label }]}>
                {day.title.trim() || `Day ${index + 1}`}
              </Text>
              {renderMark?.(day, selected)}
            </Pressable>
          );
        })}
        {onAdd ? (
          <Pressable
            testID={`${testID}-add`}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add day"
            hitSlop={{ top: space.tight, bottom: space.tight }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: space.related,
              paddingHorizontal: space.inline,
              borderRadius: radius.full,
              borderCurve: 'continuous',
              backgroundColor: colors.secondarySystemBackground,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            <SymbolView name="plus" size={iconSize.row} weight="semibold" tintColor={colors.label} />
            {/* An empty line box, so the + chip is as tall as a day chip at every text size. */}
            <Text style={[type.row, { width: 0 }]} maxFontSizeMultiplier={fontScaleCap.title}>
              {' '}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <EdgeFade side="left" />
      <EdgeFade side="right" />
    </View>
  );
}

/**
 * A chip scrolled past the margin dissolves into the page instead of being sliced by the
 * screen edge, so a cut chip reads as "more this way". At rest it covers only empty margin.
 */
function EdgeFade({ side }: { side: 'left' | 'right' }) {
  const { colors } = useTheme();
  const id = `day-chip-fade-${side}`;
  return (
    <Svg
      pointerEvents="none"
      width={space.margin}
      height="100%"
      style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0 }}>
      <Defs>
        <LinearGradient id={id} x1={side === 'left' ? 0 : 1} y1={0} x2={side === 'left' ? 1 : 0} y2={0}>
          <Stop offset={0} stopColor={colors.systemBackground} stopOpacity={1} />
          <Stop offset={1} stopColor={colors.systemBackground} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
