import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/button';
import { LiftRow, STACK_FONT_SCALE } from '@/components/lift-row';
import { PrCrown } from '@/components/pr-crown';
import { StaggerValue } from '@/components/stagger-value';
import { WeekDays, type DayCelebration } from '@/components/week-days';
import {
  fontScaleCap,
  iconSize,
  LARGE_TITLE_BOTTOM,
  LARGE_TITLE_TOP,
  PRESSED_OPACITY,
  radius,
  space,
  TOUCH_TARGET,
} from '@/constants/theme';
import { formatDayParam } from '@/domain/dates';
import { dayPartAt, formatGreeting, msUntilNextDayPart, type DayPart } from '@/domain/greeting';
import { emptyPlan } from '@/domain/helpers';
import {
  liftChangeFor,
  liftChanges,
  liftNumber,
  weekDayMarks,
  weekLiftSummary,
  workoutFinishedToday,
  type LiftChange,
  type LiftNumber,
  type WeekDayMark,
} from '@/domain/home-numbers';
import {
  completedPlanDayIdsSince,
  dayIdForPlanWorkout,
  startOfLocalWeek,
  trainableDays,
  workoutsSince,
} from '@/domain/plan-loop';
import type { ExercisePrescription, LoggedWorkout, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { weekStreak } from '@/domain/weeks';
import { DURATION, EASE_OUT, SPRING } from '@/motion';
import { useStartDay } from '@/navigation/start-day';
import { clearWeekMoment, usePendingWeekMoment } from '@/navigation/week-moment';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

type Units = 'kg' | 'lbs';

/**
 * The week moment after Done (trim-ui §13 Home week details; Paper `Motion · Done → Home`):
 * it starts once Done's modal has slid away, the day's chip gets its ✓ just after today's
 * circle pops, and a completed week then lights the flame and ticks every chip, left to right.
 */
const MOMENT_DELAY_MS = 360;
const MOMENT_CHIP_MS = 160;
const MOMENT_WEEK_MS = 420;
const MOMENT_WAVE_MS = 70;
/** After this the moment's marks give way to the plain ones (they look the same by then). */
const MOMENT_DONE_MS = MOMENT_WEEK_MS + DURATION.celebrate * 2;

/** Pager feel, shared with the log stage (trim-ui §8 Log stage swaps exercise). */
const PAN_SLOP = 14;
const SWIPE_DISTANCE = 56;
const EDGE_RESISTANCE = 0.22;
/** A neighbour one page away; it brightens as it arrives. */
const NEIGHBOUR_OPACITY = 0.5;

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Home v3 (trim-ui §13 Home, Home states; PRODUCT-DECISIONS 61, 66). One job: start the next
 * workout. The greeting as the head, drawn where the other tabs' large titles sit, with the
 * streak in its trailing lane, the week as seven circles (a trained day opens its workout),
 * then `Next workout` as day chips over the selected day's exercises with your load, and Start
 * at the thumb. What just happened decides
 * the state: training day, just trained (what changed), week complete, mid-workout (Resume).
 */
export function Home() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activePlan, nextDayIndex, savePlan, workoutHistory, activeSession, isPro, units, userName } =
    useWorkoutStore();
  const greeting = formatGreeting(useDayPart(), userName);
  const startDay = useStartDay();

  const days = useMemo(() => activePlan?.days ?? [], [activePlan]);

  // A workout in progress on this plan takes the stage until it's finished.
  const session = activePlan && activeSession?.planId === activePlan.id ? activeSession : null;
  const sessionDay = session ? days.find((item) => item.id === session.dayId) : undefined;
  const nextDay = days[nextDayIndex] ?? days[0];

  const weekStartMs = startOfLocalWeek().getTime();
  const weekStart = new Date(weekStartMs);

  // The week moment: while Done's workout waits to be celebrated, the week shows its state
  // from before it; then it plays once (`playing`) and the week lands on the new state.
  const pendingMoment = usePendingWeekMoment();
  const [playing, setPlaying] = useState<string | null>(null);
  const momentId = pendingMoment ?? playing;
  const momentWorkout = momentId ? (workoutHistory.find((item) => item.id === momentId) ?? null) : null;
  const after = weekState(activePlan, days, workoutHistory, weekStart);
  const before = momentWorkout
    ? weekState(
        activePlan,
        days,
        workoutHistory.filter((item) => item.id !== momentWorkout.id),
        weekStart,
      )
    : after;
  const week = pendingMoment ? before : after;
  const { weekComplete } = after;
  const summary = week.weekComplete ? weekLiftSummary(workoutHistory, weekStart) : null;

  useFocusEffect(
    useCallback(() => {
      if (!pendingMoment) {
        return;
      }
      const timer = setTimeout(() => {
        setPlaying(pendingMoment);
        clearWeekMoment();
      }, MOMENT_DELAY_MS);
      return () => clearTimeout(timer);
    }, [pendingMoment]),
  );
  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setTimeout(() => setPlaying(null), MOMENT_DONE_MS);
    return () => clearTimeout(timer);
  }, [playing]);

  const moment = playing && momentWorkout && !pendingMoment ? momentFor(momentWorkout, before, after, days, activePlan) : null;

  // Just trained: a day of this plan finished today, and the week isn't complete yet (a
  // complete week takes over, with the next day selected).
  const trained = useMemo(
    () => (sessionDay || weekComplete ? null : workoutFinishedToday(activePlan, workoutHistory)),
    [activePlan, sessionDay, weekComplete, workoutHistory],
  );
  const trainedDayId = trained && activePlan ? dayIdForPlanWorkout(trained, activePlan) : null;
  const changes = useMemo(
    () => (trained ? liftChanges(trained, workoutHistory) : null),
    [trained, workoutHistory],
  );

  // The day Home would pick; a chip the user picks holds until that default moves (a finished
  // workout, a new week), so Home never keeps showing a stale choice.
  const defaultDayId = sessionDay?.id ?? trainedDayId ?? nextDay?.id ?? null;
  const [pick, setPick] = useState<{ id: string; forDefault: string | null } | null>(null);
  const selectedId =
    pick && pick.forDefault === defaultDayId && days.some((item) => item.id === pick.id)
      ? pick.id
      : defaultDayId;
  const selectedIndex = Math.max(0, days.findIndex((item) => item.id === selectedId));
  const selected = days[selectedIndex];

  const numbers = useMemo(
    () =>
      days.map((item) =>
        item.exercises.map((exercise) => liftNumber(exercise, workoutHistory, units, isPro)),
      ),
    [days, isPro, units, workoutHistory],
  );

  const select = useCallback(
    (index: number) => {
      const day = days[index];
      if (day) {
        setPick({ id: day.id, forDefault: defaultDayId });
      }
    },
    [days, defaultDayId],
  );

  const createPlan = () => {
    const plan = emptyPlan();
    savePlan(plan, { activate: true });
    router.push(`/plan/${plan.id}?new=1`);
  };

  const openPicker = (plan: WorkoutPlan, day: WorkoutDay) => {
    router.push(
      `/exercises?planId=${plan.id}&dayId=${day.id}&dayTitle=${encodeURIComponent(day.title)}`,
    );
  };

  // Start: Resume the running day; after a workout, the next day as a quiet gray pill
  // (possible, not pushed); otherwise ink `Start <day>`. An empty day asks for exercises.
  let cta: { title: string; variant: 'black' | 'gray'; testID: string; onPress: () => void } | null = null;
  if (activePlan && selected) {
    if (selected.exercises.length === 0) {
      cta = {
        title: 'Add exercises',
        variant: 'black',
        testID: 'home-add-exercises',
        onPress: () => openPicker(activePlan, selected),
      };
    } else if (sessionDay && selected.id === sessionDay.id) {
      cta = {
        title: 'Resume',
        variant: 'black',
        testID: 'home-resume',
        onPress: () => startDay(activePlan, selected),
      };
    } else {
      const target = trainedDayId && selected.id === trainedDayId && nextDay ? nextDay : selected;
      cta = {
        title: `Start ${target.title}`,
        variant: trainedDayId ? 'gray' : 'black',
        testID: 'home-start',
        onPress: () => startDay(activePlan, target),
      };
    }
  }

  // Start sits `inset` above the tab bar, at the thumb (trim-ui §13 Home). Inside a native tab
  // the bottom safe area already includes the system's floating glass bar.
  const footerBottom = insets.bottom + space.inset;
  // Room for Start and the air above it, so the last row can scroll clear of the pill.
  const scrollBottom = footerBottom + TOUCH_TARGET + space.section;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          // The head lands where the other tabs' native large titles do: the bar's toolbar row
          // under the safe area, then the title's line box (trim-ui §4 Under a large title).
          paddingTop: insets.top + LARGE_TITLE_TOP,
          paddingBottom: scrollBottom,
        }}
        testID="home-scroll">
        {activePlan && days.length > 0 ? (
          <View style={{ flex: 1 }} testID="home-next-day">
            <WeekHeader
              greeting={greeting}
              streak={week.streak}
              secured={week.weekComplete}
              marks={week.marks}
              summary={summary}
              moment={moment}
              onOpenWeeks={() => router.push('/weeks')}
              onOpenDay={(mark) =>
                router.push({ pathname: '/day-workout', params: { date: formatDayParam(mark.date) } })
              }
            />

            <View style={{ paddingTop: space.section }}>
              <Text
                style={[type.caption, { paddingHorizontal: space.margin }]}
                accessibilityRole="header">
                {selected && selected.id === trainedDayId ? 'Today' : 'Next workout'}
              </Text>
              <View style={{ paddingTop: space.related }}>
                <DayChips
                  days={days}
                  selectedIndex={selectedIndex}
                  doneIds={week.doneIds}
                  moment={moment}
                  onSelect={select}
                />
              </View>
            </View>

            {/* The pager runs down to Start, so the whole lower screen swipes between days. */}
            <View style={{ flex: 1, paddingTop: space.inline }}>
              <DayPager
                days={days}
                selectedIndex={selectedIndex}
                width={width}
                onSelect={select}
                renderPage={(day, index) => (
                  <ExerciseRows
                    exercises={day.exercises}
                    numbers={numbers[index] ?? []}
                    changes={day.id === trainedDayId ? changes : null}
                    units={units}
                  />
                )}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Start's own ground: at large text the rows scroll under it instead of through it. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: space.inset,
          paddingHorizontal: space.margin,
          paddingBottom: footerBottom,
          backgroundColor: colors.systemBackground,
        }}>
        {cta ? (
          <Button title={cta.title} variant={cta.variant} testID={cta.testID} onPress={cta.onPress} />
        ) : !activePlan ? (
          <Button title="Create plan" variant="black" onPress={createPlan} testID="home-create-plan" />
        ) : null}
      </View>
    </View>
  );
}

type WeekState = {
  weekComplete: boolean;
  streak: number;
  marks: WeekDayMark[];
  /** Days wearing their ✓: the days done this week, or every day once the week is complete. */
  doneIds: string[];
};

function weekState(
  plan: WorkoutPlan | null | undefined,
  days: WorkoutDay[],
  history: LoggedWorkout[],
  weekStart: Date,
): WeekState {
  const goal = plan ? trainableDays(plan).length : 0;
  const weekComplete = goal > 0 && workoutsSince(history, weekStart) >= goal;
  return {
    weekComplete,
    streak: weekStreak(plan, history),
    marks: weekDayMarks(history, weekStart),
    // The whole plan is done this week: every chip wears its ✓ until the new week starts.
    doneIds: weekComplete
      ? days.map((item) => item.id)
      : completedPlanDayIdsSince(plan, history, weekStart),
  };
}

/** What the week moment plays: which circle fills, which ✓ pop in when, whether the flame lights. */
type WeekMoment = {
  key: string;
  day: DayCelebration | null;
  chipDelays: Record<string, number>;
  lightsFlame: boolean;
};

function momentFor(
  workout: LoggedWorkout,
  before: WeekState,
  after: WeekState,
  days: WorkoutDay[],
  plan: WorkoutPlan | null | undefined,
): WeekMoment {
  const dayIndex = after.marks.findIndex((mark, index) => mark.done && !before.marks[index]?.done);
  const trainedDayId = plan ? dayIdForPlanWorkout(workout, plan) : null;
  const chipDelays: Record<string, number> = {};
  let wave = 0;
  days.forEach((day) => {
    if (!after.doneIds.includes(day.id) || before.doneIds.includes(day.id)) {
      return;
    }
    chipDelays[day.id] =
      day.id === trainedDayId ? MOMENT_CHIP_MS : MOMENT_WEEK_MS + wave++ * MOMENT_WAVE_MS;
  });
  return {
    key: workout.id,
    day: dayIndex >= 0 ? { index: dayIndex, key: workout.id } : null,
    chipDelays,
    lightsFlame: after.weekComplete && !before.weekComplete,
  };
}

/**
 * The streak flame: gray while the week's goal is open, orange once it's reached. When the
 * week moment completes the week, it lights (gray → orange crossfade) with a small flicker.
 * Reduce Motion: the crossfade alone.
 */
function Flame({ size, secured, lightKey }: { size: number; secured: boolean; lightKey: string | null }) {
  const { colors, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const lit = useSharedValue(secured ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (lightKey == null) {
      lit.set(secured ? 1 : 0);
      return;
    }
    lit.set(0);
    lit.set(
      withDelay(
        MOMENT_WEEK_MS,
        withTiming(1, { duration: DURATION.change, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
      ),
    );
    if (!reduceMotion) {
      scale.set(
        withDelay(
          MOMENT_WEEK_MS,
          withSequence(
            withTiming(1.2, { duration: DURATION.press, easing: EASE_OUT }),
            withSpring(1, SPRING.pop),
          ),
        ),
      );
    }
  }, [lightKey, lit, reduceMotion, scale, secured]);

  const flicker = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const orange = useAnimatedStyle(() => ({ opacity: lit.get() }));
  const fallback = <Text style={type.title}>🔥</Text>;

  return (
    <Animated.View style={flicker}>
      <SymbolView name="flame.fill" size={size} tintColor={colors.systemGray3} fallback={fallback} />
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, orange]}>
        <SymbolView name="flame.fill" size={size} tintColor={colors.systemOrange} fallback={fallback} />
      </Animated.View>
    </Animated.View>
  );
}

/** A mark arriving in the week moment: pops in from half size (`SPRING.pop`). Reduce Motion: a fade. */
function PopIn({ delayMs, children }: { delayMs: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.5);

  useEffect(() => {
    shown.set(
      withDelay(
        delayMs,
        withTiming(1, {
          duration: reduceMotion ? DURATION.change : DURATION.fade,
          easing: EASE_OUT,
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    );
    if (!reduceMotion) {
      scale.set(withDelay(delayMs, withSpring(1, SPRING.pop)));
    }
  }, [delayMs, reduceMotion, scale, shown]);

  const style = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * The greeting's part of the day (`morning`, `afternoon`, `evening`). It moves on at the next
 * boundary while Home is open, and catches up when Trim comes back to the foreground or Home
 * back into focus, so a phone left on Home over lunch doesn't still say `Morning`.
 */
function useDayPart(): DayPart {
  const [part, setPart] = useState<DayPart>(() => dayPartAt(new Date()));
  const refresh = useCallback(() => setPart(dayPartAt(new Date())), []);

  useEffect(() => {
    // A second past the boundary, so the clock has surely crossed it when the timer fires.
    const timer = setTimeout(refresh, msUntilNextDayPart(new Date()) + BOUNDARY_SLACK_MS);
    return () => clearTimeout(timer);
  }, [part, refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);
  useFocusEffect(refresh);

  return part;
}

const BOUNDARY_SLACK_MS = 1000;

/** The greeting shrinks this far to stay on one line, then the name truncates (never wraps). */
const GREETING_MIN_SCALE = 0.75;

/**
 * Home's head and its fact line (trim-ui §13 Home): the greeting (`Morning, Marvin`) at the
 * native large title's metrics, with the streak in its trailing lane (the flame, gray until this
 * week's goal is reached, then orange, and the count; `0` before the first full week), then the
 * seven day circles, and on a complete week `↑ 9 lifts went up` and 👑 `2 new records`. The
 * streak opens Weeks; a trained day's circle opens that day's workout.
 */
function WeekHeader({
  greeting,
  streak,
  secured,
  marks,
  summary,
  moment,
  onOpenWeeks,
  onOpenDay,
}: {
  greeting: string;
  streak: number;
  secured: boolean;
  marks: WeekDayMark[];
  summary: { liftsUp: number; records: number } | null;
  moment: WeekMoment | null;
  onOpenWeeks: () => void;
  onOpenDay: (mark: WeekDayMark) => void;
}) {
  const { colors, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  // The head line holds its size at every text size, as the navigation bar's title does, so
  // it never drifts from the other tabs' titles (trim-ui §3 rule 9); the streak beside it holds
  // with it. NumberFlow can't take `allowFontScaling`, so its size is divided by the scale the
  // system multiplies it by.
  const countStyle = [
    type.title,
    { fontSize: type.title.fontSize / fontScale, fontVariant: ['tabular-nums' as const] },
  ];

  return (
    <View style={{ paddingHorizontal: space.margin }}>
      {/* The head: the greeting at the native large title's metrics, on the title's edge, with
          the bar's own air under it; the circles follow as its fact line (trim-ui §4). */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.inline,
          paddingBottom: LARGE_TITLE_BOTTOM,
        }}
        testID="home-head">
        <Text
          style={[type.largeTitle, { flex: 1 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={GREETING_MIN_SCALE}
          allowFontScaling={false}
          accessibilityRole="header"
          testID="home-greeting">
          {greeting}
        </Text>
        <Pressable
          onPress={onOpenWeeks}
          testID="home-streak"
          accessibilityRole="button"
          accessibilityLabel={`${streak} week streak`}
          accessibilityHint="Shows past weeks"
          // The streak is 28 tall; the slop makes it a 44pt target without moving the line.
          hitSlop={{ top: space.related, bottom: space.related, left: space.related }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.tight,
            flexShrink: 0,
            opacity: pressed ? PRESSED_OPACITY : 1,
          })}>
          <Flame
            size={type.title.fontSize}
            secured={secured}
            lightKey={moment?.lightsFlame ? moment.key : null}
          />
          {fontScale < STACK_FONT_SCALE ? (
            // The count rolls when the week moment moves it (3 → 4).
            <StaggerValue value={streak} style={countStyle} />
          ) : (
            // NumberFlow mis-measures at large Dynamic Type: plain text there, no roll.
            <Text style={[type.title, { fontVariant: ['tabular-nums'] }]} allowFontScaling={false}>
              {String(streak)}
            </Text>
          )}
        </Pressable>
      </View>
      <WeekDays marks={marks} celebrate={moment?.day ?? null} onOpenDay={onOpenDay} />
      {summary && (summary.liftsUp > 0 || summary.records > 0) ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: space.inset,
            rowGap: space.tight,
            paddingTop: space.inset,
          }}
          testID="home-week-summary">
          {summary.liftsUp > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
              <SymbolView name="arrow.up" size={iconSize.caption} weight="bold" tintColor={colors.label} />
              <Text style={[type.caption, { color: colors.label }]}>
                {plural(summary.liftsUp, 'lift went up', 'lifts went up')}
              </Text>
            </View>
          ) : null}
          {summary.records > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
              <PrCrown size={iconSize.caption} />
              <Text style={[type.caption, { color: colors.label }]}>
                {plural(summary.records, 'new record', 'new records')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The plan's days as chips: selected ink, others gray fill, and a small green ✓ on a day done
 * this week, selected or not (trim-ui §1 rule 15). They scroll sideways when a plan has more
 * than fit, keeping the selected chip in view, and fade out at the screen's edges.
 */
function DayChips({
  days,
  selectedIndex,
  doneIds,
  moment,
  onSelect,
}: {
  days: WorkoutDay[];
  selectedIndex: number;
  doneIds: string[];
  moment: WeekMoment | null;
  onSelect: (index: number) => void;
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
  }, [selectedIndex]);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ gap: space.related, paddingHorizontal: space.margin }}
        testID="home-day-chips">
        {days.map((day, index) => {
          const selected = index === selectedIndex;
          const done = doneIds.includes(day.id);
          return (
            <Pressable
              key={day.id}
              testID={`home-chip-${index}`}
              onLayout={(event) => {
                chipX.current[index] = event.nativeEvent.layout.x;
              }}
              onPress={() => onSelect(index)}
              accessibilityRole="tab"
              accessibilityLabel={done ? `${day.title}, done this week` : day.title}
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
                {day.title}
              </Text>
              {done ? (
                moment?.chipDelays[day.id] != null ? (
                  <PopIn key={moment.key} delayMs={moment.chipDelays[day.id]}>
                    <SymbolView name="checkmark" size={iconSize.caption} weight="bold" tintColor={selected ? colors.onBrand : colors.systemGreen} />
                  </PopIn>
                ) : (
                  <SymbolView name="checkmark" size={iconSize.caption} weight="bold" tintColor={selected ? colors.onBrand : colors.systemGreen} />
                )
              ) : null}
            </Pressable>
          );
        })}
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
  const id = `home-chip-fade-${side}`;
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

/**
 * The days' exercise lists side by side, one page per chip, filling the screen down to Start so
 * a swipe anywhere below the chips pages: it follows the finger 1:1 with each neighbour already
 * drawn (at half opacity, brightening as it arrives), commits on distance or a flick and settles with the
 * finger's velocity, as the log stage does. A chip tap pages there in `enter`. Only the
 * selected page is read by VoiceOver.
 */
function DayPager({
  days,
  selectedIndex,
  width,
  onSelect,
  renderPage,
}: {
  days: WorkoutDay[];
  selectedIndex: number;
  width: number;
  onSelect: (index: number) => void;
  renderPage: (day: WorkoutDay, index: number) => React.ReactNode;
}) {
  const pos = useSharedValue(selectedIndex);
  const startPos = useSharedValue(selectedIndex);
  const startX = useSharedValue(0);
  const count = useSharedValue(days.length);
  // The page the pager is on or heading to: a swipe sets it on release, before React hears.
  const index = useSharedValue(selectedIndex);

  useEffect(() => {
    count.set(days.length);
  }, [count, days.length]);

  // A selection that didn't come from a swipe (a chip, a new default) pages there.
  useEffect(() => {
    if (index.get() === selectedIndex) {
      return;
    }
    index.set(selectedIndex);
    pos.set(
      withTiming(selectedIndex, {
        duration: DURATION.enter,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [index, pos, selectedIndex]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-PAN_SLOP, PAN_SLOP])
        .failOffsetY([-PAN_SLOP, PAN_SLOP])
        .onStart((event) => {
          startPos.set(pos.get());
          startX.set(event.translationX);
        })
        .onUpdate((event) => {
          const last = count.get() - 1;
          const next = startPos.get() - (event.translationX - startX.get()) / width;
          if (next < 0) {
            pos.set(next * EDGE_RESISTANCE);
          } else if (next > last) {
            pos.set(last + (next - last) * EDGE_RESISTANCE);
          } else {
            pos.set(next);
          }
        })
        .onEnd((event) => {
          const from = index.get();
          const last = count.get() - 1;
          const travel = (from - pos.get()) * width + project(event.velocityX);
          let target = from;
          if (travel < -SWIPE_DISTANCE && from < last) {
            target = from + 1;
          } else if (travel > SWIPE_DISTANCE && from > 0) {
            target = from - 1;
          }
          pos.set(
            withSpring(target, {
              ...SPRING.fling,
              velocity: -event.velocityX / width,
              reduceMotion: ReduceMotion.System,
            }),
          );
          if (target !== from) {
            index.set(target);
            scheduleOnRN(onSelect, target);
          }
        }),
    [count, index, onSelect, pos, startPos, startX, width],
  );

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pos.get() * width }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1, width, overflow: 'hidden' }} testID="home-exercise-pager">
        <Animated.View style={[{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }, trackStyle]}>
          {days.map((day, dayIndex) => (
            <PagerPage key={day.id} index={dayIndex} pos={pos} width={width} current={dayIndex === selectedIndex}>
              {renderPage(day, dayIndex)}
            </PagerPage>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** A day's page: a neighbour one page away sits at half opacity and brightens as it arrives. */
function PagerPage({
  index,
  pos,
  width,
  current,
  children,
}: {
  index: number;
  pos: SharedValue<number>;
  width: number;
  current: boolean;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(pos.get() - index), [0, 1], [1, NEIGHBOUR_OPACITY], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View
      style={[{ width, paddingHorizontal: space.margin }, style]}
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
      pointerEvents={current ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}

/**
 * The day's exercises as single-line rows on the page (hairlines, no surface): `row` name and
 * the trailing load in `valueCompact` + unit. No prescription: Home says what to lift, the
 * log says how many sets (`Set n of m`) and the day editor holds the plan. Before a workout
 * the load is today's (Pro: the target, with an ink ↑ when it rises; free: last heaviest set).
 * Just trained, the lane says what changed: ↑ `2.5 kg`, `same`, or the crown on a record.
 */
function ExerciseRows({
  exercises,
  numbers,
  changes,
  units,
}: {
  exercises: ExercisePrescription[];
  numbers: (LiftNumber | null)[];
  changes: Map<string, LiftChange> | null;
  units: Units;
}) {
  return (
    <View testID="home-exercise-list">
      {exercises.map((exercise, index) => (
        <LiftRow
          key={`${exercise.id}-${index}`}
          name={exercise.name}
          number={changes ? null : (numbers[index] ?? null)}
          change={changes ? liftChangeFor(changes, exercise.name) : null}
          units={units}
          showSeparator={index < exercises.length - 1}
        />
      ))}
    </View>
  );
}
