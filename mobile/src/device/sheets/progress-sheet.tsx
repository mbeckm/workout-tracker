import { useMemo } from 'react';
import { ActionSheetIOS, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { showToast } from '@/components/toast';
import {
  fontScaleCap,
  progressGeometry as geo,
  progressType,
  sheetColors,
  signal,
} from '@/constants/theme';
import type { Goal } from '@/domain/goals';
import { PROGRESS_SPARKLINE_DAYS } from '@/domain/progress';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { progressModel, type GoalCardModel, type MetricRowModel } from '@/device/progress-model';
import { useWorkoutStore } from '@/store/workout-store';

import { SectionLabel, SheetCard, SheetHeader, SheetScroll } from './primitives';
import { GoalRing, Sparkline } from './progress-parts';
import { useSheetChrome } from './sheet-context';

/** Progress reached from the menu keeps ‹ back to it through lift detail and the goal sheet. */
export function viaMenu(params: SheetParams): string | undefined {
  return params.from === 'menu' || params.via === 'menu' ? 'menu' : undefined;
}

/**
 * Progress (QA1, screen 18 without the gauge; SPEC §6; PRODUCT-DECISIONS 62, 63). GOALS: the
 * pinned goals as green rings. `LIFTS, 30 DAYS`: name, sparkline, estimated max and the change
 * over the window. BODY: the measurements with a check-in. Tap a row for its detail; long-press
 * a lift or body row to set a goal, a goal to edit, unpin or remove it.
 */
export function ProgressSheet({ params }: { params: SheetParams }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const {
    activePlan,
    bodyCheckIns,
    goals,
    nextDayIndex,
    units,
    workoutHistory,
    removeGoal,
    restoreGoal,
    setGoalPinned,
  } = useWorkoutStore();
  const via = viaMenu(params);

  const model = useMemo(
    () =>
      progressModel({
        history: workoutHistory,
        plan: activePlan,
        nextDayIndex,
        goals,
        bodyCheckIns,
        units,
      }),
    [activePlan, bodyCheckIns, goals, nextDayIndex, units, workoutHistory],
  );

  const openLift = (name: string) => swapSheet('lift', { name, via });
  const openGoal = (name: string) => swapSheet('goal', { name, from: 'progress', via });
  const openBody = (metric: string) => swapSheet('body', { metric, via });
  const openBodyGoal = (metric: string) => swapSheet('goal', { metric, from: 'progress', via });
  const openCheckIn = () => swapSheet('checkin', { from: 'progress', via });

  const goalActions = (goal: Goal) => {
    const remove = () => {
      const removed = removeGoal(goal.id);
      if (removed) {
        showToast({ title: 'Goal removed', onUndo: () => restoreGoal(removed) });
      }
    };
    if (Platform.OS !== 'ios') {
      openGoal(goal.exerciseName);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `${goal.exerciseName} goal`,
        options: ['Edit goal', 'Unpin from Progress', 'Remove goal', 'Cancel'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
        userInterfaceStyle: 'dark',
      },
      (index) => {
        if (index === 0) openGoal(goal.exerciseName);
        if (index === 1) setGoalPinned(goal.id, false);
        if (index === 2) remove();
      },
    );
  };

  // rank: the gauge and "stronger than n%" wait for strength-standards data (PLAN D4).
  return (
    <SheetScroll
      header={
        <SheetHeader
          title="Progress"
          left={via ? { kind: 'back', onPress: () => swapSheet('menu') } : undefined}
          right={via ? undefined : { kind: 'close', onPress: close }}
        />
      }>
      <View testID="progress-sheet">
        {model.goals.length > 0 ? (
          <>
            <SectionLabel>GOALS</SectionLabel>
            <View style={styles.goals} testID="progress-goals">
              {[0, 1, 2].map((slot) => {
                const card = model.goals[slot];
                return card ? (
                  <GoalCard
                    key={card.goal.id}
                    card={card}
                    onPress={() => openLift(card.goal.exerciseName)}
                    onLongPress={() => goalActions(card.goal)}
                  />
                ) : (
                  <View key={`slot-${slot}`} style={styles.goalSlot} />
                );
              })}
            </View>
          </>
        ) : null}

        <SectionLabel>{`LIFTS, ${PROGRESS_SPARKLINE_DAYS} DAYS`}</SectionLabel>
        <SheetCard>
          {model.empty ? <PlainRow key="empty" title="No lifts yet" /> : null}
          {model.empty
            ? model.empty.nextLifts.map((name, index) => <PlainRow key={`next-${index}`} title={name} dim />)
            : null}
          {model.lifts.map((row) => (
            <MetricRow
              key={row.key}
              row={row}
              onPress={() => openLift(row.name)}
              onLongPress={() => openGoal(row.name)}
              testID={`progress-lift-${row.key.replace(/\s+/g, '-')}`}
            />
          ))}
          {model.body.length === 0 ? (
            <PlainRow key="check-in" title="Check in" action onPress={openCheckIn} testID="progress-check-in" />
          ) : null}
        </SheetCard>

        {model.body.length > 0 ? (
          <>
            <SectionLabel>BODY</SectionLabel>
            <SheetCard>
              {model.body.map(({ metric, row }) => (
                <MetricRow
                  key={metric}
                  row={row}
                  onPress={() => openBody(metric)}
                  onLongPress={() => openBodyGoal(metric)}
                  testID={`progress-body-${metric}`}
                />
              ))}
            </SheetCard>
          </>
        ) : null}
      </View>
    </SheetScroll>
  );
}

/** A goal card (prototype `.goal`): the ring, `Bench press 100`, `at 92`. */
function GoalCard({
  card,
  onPress,
  onLongPress,
}: {
  card: GoalCardModel;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={card.accessibilityLabel}
      accessibilityActions={[{ name: 'longpress', label: 'Goal actions' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress();
      }}
      style={({ pressed }) => [styles.goal, pressed && styles.pressed]}>
      <GoalRing progress={card.progress} label={card.reached ? '✓' : card.percent} />
      <Text
        numberOfLines={2}
        maxFontSizeMultiplier={fontScaleCap.title}
        style={[progressType.goalTitle, styles.goalTitle]}>
        {card.title}
      </Text>
      {card.sub ? (
        <Text
          numberOfLines={2}
          maxFontSizeMultiplier={fontScaleCap.title}
          style={[progressType.goalSub, styles.center, styles.tabular, card.reached && styles.reached]}>
          {card.sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A lift or body row (prototype `.plift`): name, sparkline, value over the change. */
function MetricRow({
  row,
  onPress,
  onLongPress,
  testID,
}: {
  row: MetricRowModel;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
}) {
  const valueStyle = row.record ? styles.record : null;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityActions={[{ name: 'longpress', label: 'Set a goal' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.text} style={[progressType.liftName, styles.name]}>
        {row.name}
      </Text>
      <Sparkline values={row.spark} tone={row.tone} />
      <View style={styles.value}>
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[progressType.liftValue, styles.right, styles.tabular, valueStyle]}>
          {row.value}
        </Text>
        {row.change ? (
          <Text
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[progressType.liftChange, styles.right, styles.tabular, valueStyle]}>
            {row.change}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A row with only a name: the empty state's facts, the next day's lifts (dim), `Check in`. */
function PlainRow({
  title,
  dim = false,
  action = false,
  onPress,
  testID,
}: {
  title: string;
  dim?: boolean;
  action?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={({ pressed }) => [styles.row, styles.plainRow, pressed && styles.rowPressed]}>
      <Text
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[progressType.liftName, styles.name, dim && styles.dim, action && styles.action]}>
        {title}
      </Text>
      {action ? (
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[progressType.liftValue, styles.action]}>
          +
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  goals: { flexDirection: 'row', gap: geo.goalGap, marginHorizontal: geo.goalInset },
  goalSlot: { flex: 1 },
  goal: {
    flex: 1,
    minHeight: geo.goalCardHeight,
    borderRadius: geo.goalCardRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.card,
    alignItems: 'center',
    paddingTop: geo.goalCardPadTop,
    paddingBottom: geo.goalCardPadTop,
    paddingHorizontal: geo.goalCardPadX,
  },
  goalTitle: { marginTop: geo.goalTitleTop, textAlign: 'center' },
  pressed: { backgroundColor: sheetColors.cardRaised },
  center: { textAlign: 'center' },
  reached: { color: signal.done },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: geo.rowGap,
    paddingVertical: geo.rowPadY,
    paddingHorizontal: geo.rowPadX,
  },
  plainRow: { minHeight: geo.plainRowHeight },
  rowPressed: { backgroundColor: sheetColors.cardRaised },
  name: { flex: 1, minWidth: 0 },
  dim: { color: sheetColors.sectionLabel },
  action: { color: signal.orange },
  value: { minWidth: geo.valueLane, alignItems: 'flex-end' },
  right: { textAlign: 'right' },
  record: { color: signal.record },
  tabular: { fontVariant: ['tabular-nums'] },
});
