import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/button';
import { PrCrown } from '@/components/pr-crown';
import { WeekDays } from '@/components/week-days';
import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import { emptyPlan, formatLoadWithUnit, formatPlanMetricShort } from '@/domain/helpers';
import {
  liftChangeFor,
  liftChanges,
  liftNumber,
  weekDayMarks,
  weekLiftSummary,
  workoutFinishedToday,
  type LiftChange,
  type LiftNumber,
} from '@/domain/home-numbers';
import {
  completedPlanDayIdsSince,
  dayIdForPlanWorkout,
  startOfLocalWeek,
  trainableDays,
  workoutsSince,
} from '@/domain/plan-loop';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { weekStreak } from '@/domain/weeks';
import { DURATION, EASE_OUT, SPRING } from '@/motion';
import { useStartDay } from '@/navigation/start-day';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

type Units = 'kg' | 'lbs';

/**
 * From the larger Dynamic Type sizes up (xxxLarge and the accessibility sizes), a row stacks
 * the prescription and load under the name instead of squeezing the name to an ellipsis.
 */
const STACK_FONT_SCALE = 1.3;

/** A single-line row: a 44pt touch target plus the air a `title` load needs (Paper V4: 48). */
const ROW_HEIGHT = TOUCH_TARGET + space.tight;
/** Lanes, so every row's prescription and load line up (Paper V4; the load lane fits `102.5 kg` with its ↑). They grow with the text. */
const METRIC_LANE = 44;
const LOAD_LANE = 100;

/** Pager feel, shared with the log stage (trim-ui §8 Log stage swaps exercise). */
const PAN_SLOP = 14;
const SWIPE_DISTANCE = 56;
const EDGE_RESISTANCE = 0.22;

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** `62.5`, `60`: the load alone, for a number whose unit sits beside it. */
function formatLoad(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Home v3 (trim-ui §13 Home, Home states; PRODUCT-DECISIONS 61). One job: start the next
 * workout. The streak and the week as seven circles, then `Next workout` as day chips over the
 * selected day's exercises with your load, and Start at the thumb. What just happened decides
 * the state: training day, just trained (what changed), week complete, mid-workout (Resume).
 */
export function Home() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activePlan, nextDayIndex, savePlan, workoutHistory, activeSession, isPro, units } =
    useWorkoutStore();
  const startDay = useStartDay();

  const days = useMemo(() => activePlan?.days ?? [], [activePlan]);

  // A workout in progress on this plan takes the stage until it's finished.
  const session = activePlan && activeSession?.planId === activePlan.id ? activeSession : null;
  const sessionDay = session ? days.find((item) => item.id === session.dayId) : undefined;
  const nextDay = days[nextDayIndex] ?? days[0];

  const weekStartMs = startOfLocalWeek().getTime();
  const weekStart = new Date(weekStartMs);
  const goal = activePlan ? trainableDays(activePlan).length : 0;
  const weekComplete = goal > 0 && workoutsSince(workoutHistory, weekStart) >= goal;
  const streak = weekStreak(activePlan, workoutHistory);
  const marks = weekDayMarks(workoutHistory, weekStart);
  const summary = weekComplete ? weekLiftSummary(workoutHistory, weekStart) : null;

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

  // The whole plan is done this week: every chip wears its ✓ until the new week starts.
  const doneIds = weekComplete
    ? days.map((item) => item.id)
    : completedPlanDayIdsSince(activePlan, workoutHistory, weekStart);

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
        contentContainerStyle={{ paddingTop: insets.top + space.gutter, paddingBottom: scrollBottom }}
        testID="home-scroll">
        {activePlan && days.length > 0 ? (
          <View testID="home-next-day">
            <WeekHeader
              streak={streak}
              secured={weekComplete}
              marks={marks}
              summary={summary}
              onPress={() => router.push('/weeks')}
            />

            <View style={{ paddingTop: space.section }}>
              <Text
                style={[type.caption, { paddingHorizontal: space.gutter }]}
                accessibilityRole="header">
                {selected && selected.id === trainedDayId ? 'Today' : 'Next workout'}
              </Text>
              <View style={{ paddingTop: space.related }}>
                <DayChips days={days} selectedIndex={selectedIndex} doneIds={doneIds} onSelect={select} />
              </View>
            </View>

            <View style={{ paddingTop: space.inline }}>
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
          paddingHorizontal: space.gutter,
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

/**
 * The streak over the week: 🔥 `3 weeks` (gray until this week's goal is reached, then
 * orange; hidden before the first full week), the seven day circles, and on a complete week
 * `↑ 9 lifts went up` and 👑 `2 new records`. The block opens Weeks.
 */
function WeekHeader({
  streak,
  secured,
  marks,
  summary,
  onPress,
}: {
  streak: number;
  secured: boolean;
  marks: ReturnType<typeof weekDayMarks>;
  summary: { liftsUp: number; records: number } | null;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  const flameSize = type.tabTitle.fontSize * Math.min(fontScale, fontScaleCap.title);
  const trained = marks.filter((mark) => mark.done).length;
  const spoken = [
    streak > 0 ? plural(streak, 'week', 'weeks') + ' in a row' : null,
    `${trained} ${trained === 1 ? 'day' : 'days'} trained this week`,
    summary && summary.liftsUp > 0 ? plural(summary.liftsUp, 'lift went up', 'lifts went up') : null,
    summary && summary.records > 0 ? plural(summary.records, 'new record', 'new records') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      testID="home-week"
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Shows past weeks"
      style={({ pressed }) => ({
        paddingHorizontal: space.gutter,
        gap: space.inset,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      {streak > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.related }} testID="home-streak">
          <SymbolView
            name="flame.fill"
            size={flameSize}
            tintColor={secured ? colors.systemOrange : colors.systemGray3}
            fallback={<Text style={type.tabTitle}>🔥</Text>}
          />
          {/*
            Plain text for now: the count rolling up belongs to the week moment after Done (trim-ui
            §13 Home week details, not built yet), and NumberFlow mis-measures at large text.
          */}
          <Text
            style={[type.tabTitle, { fontVariant: ['tabular-nums'] }]}
            maxFontSizeMultiplier={fontScaleCap.title}>
            {plural(streak, 'week', 'weeks')}
          </Text>
        </View>
      ) : null}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <WeekDays marks={marks} />
      </View>
      {summary && (summary.liftsUp > 0 || summary.records > 0) ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.inset, rowGap: space.tight }}
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
    </Pressable>
  );
}

/**
 * The plan's days as chips: selected ink, others gray fill, and a small green ✓ on a day done
 * this week, selected or not (trim-ui §1 rule 15). They scroll sideways when a plan has more
 * than fit, keeping the selected chip in view.
 */
function DayChips({
  days,
  selectedIndex,
  doneIds,
  onSelect,
}: {
  days: WorkoutDay[];
  selectedIndex: number;
  doneIds: string[];
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
    scrollRef.current?.scrollTo({ x: Math.max(0, x - space.gutter), animated: true });
  }, [selectedIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ gap: space.related, paddingHorizontal: space.gutter }}
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
              backgroundColor: selected ? colors.label : colors.secondarySystemBackground,
              opacity: pressed && !selected ? PRESSED_OPACITY : 1,
            })}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={fontScaleCap.title}
              style={[type.row, { color: selected ? colors.onLabel : colors.label }]}>
              {day.title}
            </Text>
            {done ? (
              <SymbolView name="checkmark" size={iconSize.caption} weight="bold" tintColor={colors.systemGreen} />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * The days' exercise lists side by side, one page per chip: a swipe follows the finger 1:1
 * with each neighbour already drawn, commits on distance or a flick and settles with the
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
      <View style={{ width, overflow: 'hidden' }} testID="home-exercise-pager">
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'flex-start' }, trackStyle]}>
          {days.map((day, dayIndex) => {
            const current = dayIndex === selectedIndex;
            return (
              <View
                key={day.id}
                style={{ width, paddingHorizontal: space.gutter }}
                accessibilityElementsHidden={!current}
                importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
                pointerEvents={current ? 'auto' : 'none'}>
                {renderPage(day, dayIndex)}
              </View>
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * The day's exercises as single-line rows on the page (hairlines, no surface): `row` name, the
 * prescription `4 × 6` in `caption`, and the trailing load in `title` + unit. Before a workout
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
        <ExerciseRow
          key={`${exercise.id}-${index}`}
          exercise={exercise}
          number={changes ? null : (numbers[index] ?? null)}
          change={changes ? liftChangeFor(changes, exercise.name) : null}
          units={units}
          showSeparator={index < exercises.length - 1}
        />
      ))}
    </View>
  );
}

function ExerciseRow({
  exercise,
  number,
  change,
  units,
  showSeparator,
}: {
  exercise: ExercisePrescription;
  number: LiftNumber | null;
  change: LiftChange | null;
  units: Units;
  showSeparator: boolean;
}) {
  const { colors, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_FONT_SCALE;
  const metric = formatPlanMetricShort(exercise);
  const trailing = change ? <ChangeValue change={change} units={units} /> : number ? <LoadValue number={number} units={units} /> : null;

  let spoken: string | null = null;
  if (change) {
    spoken =
      change.kind === 'first'
        ? formatLoadWithUnit(change.load, units)
        : change.kind === 'same'
          ? 'same as last time'
          : `${change.kind === 'up' ? 'up' : 'down'} ${formatLoadWithUnit(change.delta, units)}`;
    if (change.record) {
      spoken += ', personal best';
    }
  } else if (number) {
    spoken = `${formatLoadWithUnit(number.load, units)}${number.loadUp != null ? ', up from last time' : ''}`;
  }

  const metricText = (
    <Text
      style={[
        type.caption,
        { fontVariant: ['tabular-nums'] },
        stacked ? { flex: 1 } : { minWidth: METRIC_LANE * fontScale, textAlign: 'right' },
      ]}>
      {metric}
    </Text>
  );
  const trailingLane = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
        gap: space.tight,
        flexShrink: 0,
        minWidth: stacked ? undefined : LOAD_LANE * fontScale,
      }}>
      {trailing}
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={[exercise.name, metric.replace(' × ', ' sets of '), spoken].filter(Boolean).join(', ')}
      style={{
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
        gap: stacked ? space.tight : space.inline,
        minHeight: ROW_HEIGHT,
        paddingVertical: space.related,
        justifyContent: 'center',
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <Text style={[type.row, stacked ? null : { flex: 1, minWidth: 0 }]} numberOfLines={stacked ? 2 : 1}>
        {exercise.name}
      </Text>
      {stacked ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.inline }}>
          {metricText}
          {trailingLane}
        </View>
      ) : (
        <>
          {metricText}
          {trailingLane}
        </>
      )}
    </View>
  );
}

/** A glyph that sits on the number's line: the lane aligns by baseline, a symbol has none. */
function LaneGlyph({ children }: { children: React.ReactNode }) {
  return <View style={{ alignSelf: 'center' }}>{children}</View>;
}

function Amount({ value, units }: { value: number; units: Units }) {
  const { type } = useTheme();
  return (
    <>
      <Text style={[type.title, { fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={fontScaleCap.title}>
        {formatLoad(value)}
      </Text>
      <Text style={type.caption} maxFontSizeMultiplier={fontScaleCap.title}>
        {units}
      </Text>
    </>
  );
}

/** Today's load; an ink ↑ when the Pro target raises it (change is ink, trim-ui §5). */
function LoadValue({ number, units }: { number: LiftNumber; units: Units }) {
  const { colors } = useTheme();
  return (
    <>
      {number.loadUp != null ? (
        <LaneGlyph>
          <SymbolView name="arrow.up" size={iconSize.caption} weight="bold" tintColor={colors.label} />
        </LaneGlyph>
      ) : null}
      <Amount value={number.load} units={units} />
    </>
  );
}

/** What a lift did today: ↑ / ↓ and the difference, `same`, or the crown on a record. */
function ChangeValue({ change, units }: { change: LiftChange; units: Units }) {
  const { colors, type } = useTheme();
  if (change.kind === 'first') {
    return <Amount value={change.load} units={units} />;
  }
  const glyph = change.record ? (
    <LaneGlyph>
      <PrCrown size={iconSize.caption} />
    </LaneGlyph>
  ) : change.kind === 'same' ? null : (
    <LaneGlyph>
      <SymbolView
        name={change.kind === 'up' ? 'arrow.up' : 'arrow.down'}
        size={iconSize.caption}
        weight="bold"
        tintColor={colors.label}
      />
    </LaneGlyph>
  );
  return (
    <>
      {glyph}
      {change.kind === 'same' ? (
        <Text style={type.caption} maxFontSizeMultiplier={fontScaleCap.title}>
          same
        </Text>
      ) : (
        <Amount value={change.delta} units={units} />
      )}
    </>
  );
}
