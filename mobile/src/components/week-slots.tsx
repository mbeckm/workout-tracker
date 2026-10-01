import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fontScaleCap, PRESSED_OPACITY, radius, space } from '@/constants/theme';
import { weekdayLong, weekdayShort } from '@/domain/dates';
import type { WeekSlot } from '@/domain/home-numbers';
import { DURATION, EASE_OUT } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/** A slot's bar: thick enough to read at arm's length, thin enough to stay a measure, not a button. */
const BAR = 8;

/** A slot to fill as the week moment plays (Home after Done); `key` replays it. */
export type SlotCelebration = { index: number; key: string };

/**
 * The week as the plan's goal, one slot per workout it asks for (PRODUCT-DECISIONS 69). Slots
 * fill green left to right in the order you trained, whichever days: each filled one names the
 * workout and the weekday under its bar, and opens that day's workout. Open slots are a gray
 * bar with nothing under it. No weekdays to miss: the week is a count, not a calendar.
 *
 * `celebrate`: the slot a workout just filled sweeps green from its leading edge, and its
 * label fades in (trim-ui §8 Week slot fills). Reduce Motion: a crossfade.
 */
export function WeekSlots({
  slots,
  celebrate = null,
  onOpenSlot,
}: {
  slots: WeekSlot[];
  celebrate?: SlotCelebration | null;
  onOpenSlot?: (slot: NonNullable<WeekSlot>) => void;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.tight }} testID="home-week-slots">
      {slots.map((slot, index) => {
        const filling = celebrate?.index === index && slot != null;
        const bar = (
          <View
            style={{
              height: BAR,
              borderRadius: radius.full,
              overflow: 'hidden',
              backgroundColor: slot && !filling ? colors.systemGreen : colors.secondarySystemBackground,
            }}>
            {filling ? <FillingBar key={celebrate.key} /> : null}
          </View>
        );
        if (!slot) {
          return (
            <View key={`open-${index}`} style={{ flex: 1 }} testID={`home-week-slot-${index}`}>
              {bar}
            </View>
          );
        }
        const label = (
          <View>
            <Text style={[type.footnote, { color: colors.label }]} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.title}>
              {slot.title}
            </Text>
            <Text style={type.footnote} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.title}>
              {weekdayShort(slot.date)}
            </Text>
          </View>
        );
        return (
          <Pressable
            key={slot.id}
            onPress={onOpenSlot ? () => onOpenSlot(slot) : undefined}
            disabled={!onOpenSlot}
            testID={`home-week-slot-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${slot.title}, ${weekdayLong(slot.date)}, open workout`}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              gap: space.related,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            {bar}
            {filling ? <FadeIn key={celebrate.key}>{label}</FadeIn> : label}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The green sweeping across a slot from its leading edge. Reduce Motion: it fades in instead. */
function FillingBar() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.set(
      withTiming(1, {
        duration: reduceMotion ? DURATION.change : DURATION.fade,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [fill, reduceMotion]);

  const style = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: fill.get() }
      : { transform: [{ scaleX: fill.get() }] },
  );

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: radius.full,
          backgroundColor: colors.systemGreen,
          transformOrigin: 'left',
        },
        style,
      ]}
    />
  );
}

function FadeIn({ children }: { children: ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: DURATION.fade, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
  }, [shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
