import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space } from '@/constants/theme';
import { weekdayLong, weekdayShort } from '@/domain/dates';
import type { WeekDayMark } from '@/domain/home-numbers';
import { DURATION, EASE_OUT, SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/** One day's circle (trim-ui §13 Home: 40pt): read at arm's length, seven fit a 320pt phone. */
const DAY = 40;
/** Today's ring: gray, so a trained day's green stays the strongest mark in the week. */
const RING = 2;
/** The soft rings leave 140ms apart and grow to this much of the circle (trim-ui §8 Week dot fills). */
const RING_STAGGER_MS = 140;
const RING_GROWTH = 0.8;
const RING_OPACITY = 0.45;

/** A day to fill with the pop (Home's week moment after Done); `key` replays it. */
export type DayCelebration = { index: number; key: string };

/**
 * The current week as seven days, Monday first (Home v3). A day with a finished workout is a
 * green circle with a check; today is a gray ring over its ink weekday; every other day is an empty grey circle.
 * A missed day stays grey like a future one: Trim doesn't scold.
 *
 * `celebrate`: the day a workout just finished fills with `SPRING.pop` and two soft green
 * rings, once (trim-ui §13 Home week details). Reduce Motion: its color crossfades.
 *
 * `onOpenDay`: a trained day is a button that opens that day's workout (a record, as a sheet).
 * Only trained days press; a gray, future or untrained today has no press and no feedback.
 */
export function WeekDays({
  marks,
  celebrate = null,
  onOpenDay,
}: {
  marks: WeekDayMark[];
  celebrate?: DayCelebration | null;
  onOpenDay?: (mark: WeekDayMark) => void;
}) {
  const { colors, type } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between' }}
      testID="home-week-days">
      {marks.map((mark, index) => {
        const day = (
          <>
            {celebrate?.index === index && mark.done ? (
              <FillingDay celebrateKey={celebrate.key} />
            ) : (
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
                  borderColor: colors.systemGray3,
                }}>
                {mark.done ? (
                  <SymbolView name="checkmark" tintColor={colors.onGreen} size={iconSize.caption} weight="bold" />
                ) : null}
              </View>
            )}
            <Text
              style={[type.footnote, mark.isToday ? { color: colors.label } : null]}
              maxFontSizeMultiplier={fontScaleCap.title}>
              {weekdayShort(mark.date)}
            </Text>
          </>
        );
        const latest = mark.done ? mark.latest : null;
        if (onOpenDay && latest) {
          return (
            <Pressable
              key={mark.date.toISOString()}
              onPress={() => onOpenDay(mark)}
              testID={`home-week-day-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`${weekdayLong(mark.date)}, ${latest.title}, open workout`}
              // The circles are 40 wide: a little slop toward their neighbours makes 44.
              hitSlop={{ left: space.pair, right: space.pair }}
              style={({ pressed }) => ({
                alignItems: 'center',
                gap: space.related,
                opacity: pressed ? PRESSED_OPACITY : 1,
              })}>
              {day}
            </Pressable>
          );
        }
        return (
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
            {day}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Today's circle filling as the week moment plays: from the gray ring to green with its check,
 * popping from half size, with two soft green rings leaving it.
 */
function FillingDay({ celebrateKey }: { celebrateKey: string }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(0);
  const scale = useSharedValue(1);
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);

  useEffect(() => {
    // A color crossfade is the reduced-motion celebration: it plays either way.
    fill.set(
      withTiming(1, {
        duration: reduceMotion ? DURATION.change : DURATION.fade,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
    if (reduceMotion) {
      return;
    }
    scale.set(0.5);
    scale.set(withSpring(1, SPRING.pop));
    ringA.set(withTiming(1, { duration: DURATION.celebrate, easing: EASE_OUT }));
    ringB.set(
      withDelay(RING_STAGGER_MS, withTiming(1, { duration: DURATION.celebrate, easing: EASE_OUT })),
    );
  }, [celebrateKey, fill, reduceMotion, ringA, ringB, scale]);

  const circle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    backgroundColor: interpolateColor(fill.get(), [0, 1], [colors.systemBackground, colors.systemGreen]),
    borderWidth: RING * (1 - fill.get()),
  }));
  const check = useAnimatedStyle(() => ({ opacity: fill.get() }));
  const ringAStyle = useAnimatedStyle(() => ({
    opacity: ringA.get() === 0 ? 0 : RING_OPACITY * (1 - ringA.get()),
    transform: [{ scale: 1 + ringA.get() * RING_GROWTH }],
  }));
  const ringBStyle = useAnimatedStyle(() => ({
    opacity: ringB.get() === 0 ? 0 : RING_OPACITY * (1 - ringB.get()),
    transform: [{ scale: 1 + ringB.get() * RING_GROWTH }],
  }));

  const ring = {
    position: 'absolute' as const,
    width: DAY,
    height: DAY,
    borderRadius: radius.full,
    backgroundColor: colors.systemGreen,
  };

  return (
    <View style={{ width: DAY, height: DAY }}>
      <Animated.View pointerEvents="none" style={[ring, ringAStyle]} />
      <Animated.View pointerEvents="none" style={[ring, ringBStyle]} />
      <Animated.View
        style={[
          {
            width: DAY,
            height: DAY,
            borderRadius: radius.full,
            borderColor: colors.systemGray3,
            alignItems: 'center',
            justifyContent: 'center',
          },
          circle,
        ]}>
        <Animated.View style={check}>
          <SymbolView name="checkmark" tintColor={colors.onGreen} size={iconSize.caption} weight="bold" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
