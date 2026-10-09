import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { showToast } from '@/components/toast';
import {
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  progressColors,
  progressGeometry as geo,
  progressType,
  sheetColors,
  sheetGeometry,
  signal,
} from '@/constants/theme';
import {
  bodyGoalFor,
  bodyGoalForDisplay,
  bodyGoalFromDisplay,
  bodyGoalStep,
  latestBodyValue,
} from '@/domain/body-goals';
import { BODY_METRICS, type BodyMetricKey } from '@/domain/check-in';
import { currentOneRM, goalForLift, goalStep, MAX_PINNED_GOALS, pinnedGoals, suggestedGoalTarget } from '@/domain/goals';
import { useDevice } from '@/device/device-context';
import type { SheetKind, SheetParams } from '@/device/device-state';
import {
  bodyLabel,
  formatProgressNumber,
  formatShortDay,
  parseDecimalInput,
  sanitizeDecimalInput,
} from '@/device/progress-model';
import { useWorkoutStore } from '@/store/workout-store';

import { PillButton, SheetCard, SheetHeader, SheetRow, SheetScroll, StickyActionBar } from './primitives';
import { viaMenu } from './progress-sheet';

type Swap = (kind: SheetKind, params?: SheetParams) => void;

/** ‹ from a goal or check-in sheet: back to the lift, the body measurement, or Progress. */
export function backToOrigin(params: SheetParams, swapSheet: Swap): () => void {
  const via = viaMenu(params);
  if (params.from === 'lift' && params.name) {
    return () => swapSheet('lift', { name: params.name, via });
  }
  if (params.from === 'body' && params.metric) {
    return () => swapSheet('body', { metric: params.metric, via });
  }
  return () => swapSheet('progress', { from: via });
}

/** One goal sheet, like the old `/goal` route: `name` for a lift, `metric` for a body measurement. */
export function GoalSheet({ params }: { params: SheetParams }) {
  const isBody = BODY_METRICS.some((item) => item.key === params.metric);
  return isBody ? <BodyGoalSheet params={params} /> : <LiftGoalSheet params={params} />;
}

/**
 * A lift's goal (PRODUCT-DECISIONS 63; the old `goal-sheet` logic): the lift's estimated max as
 * a fact, the target pre-filled with the next round number above it, − / + in the goal step,
 * `Pin to Progress` (with 3 pinned, `Replace on Progress` and which one), `Remove goal` with
 * Undo, and the light `Set goal` pill. A reached goal opens on its next round number.
 */
function LiftGoalSheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { goals, workoutHistory, units, setGoal, removeGoal, restoreGoal } = useWorkoutStore();
  const name = params.name ?? '';
  const back = backToOrigin(params, swapSheet);
  const existing = goalForLift(goals, name);
  // A reached goal (or `Set next goal`) starts from the next round number above it.
  const next = params.next === '1' || existing?.reachedAt != null;
  const current = useMemo(() => currentOneRM(name, workoutHistory), [name, workoutHistory]);
  const step = goalStep(units);

  const [text, setText] = useState(() =>
    formatProgressNumber(
      existing && !next
        ? existing.target
        : suggestedGoalTarget(Math.max(current ?? 0, next && existing ? existing.target : 0), units),
      1,
    ),
  );
  const target = parseDecimalInput(text);

  const others = pinnedGoals(goals).filter((goal) => goal.id !== existing?.id);
  const full = others.length >= MAX_PINNED_GOALS;
  const [pin, setPin] = useState(() => (existing ? existing.pinned : !full));
  const [replaceId, setReplaceId] = useState<string | null>(null);

  // A goal is something to reach: it sits above where the lift is now.
  const valid =
    target != null && (current == null || target > current || (!next && existing?.target === target));

  const nudge = (direction: 1 | -1) => {
    const base = target ?? suggestedGoalTarget(current, units);
    const value = direction > 0 ? Math.floor(base / step) * step + step : Math.ceil(base / step) * step - step;
    setText(formatProgressNumber(Math.max(step, value), 1));
  };

  const save = () => {
    if (!valid || target == null) {
      return;
    }
    Keyboard.dismiss();
    const replacing = full && pin ? (replaceId ?? others[0]?.id ?? null) : null;
    setGoal({ exerciseName: name, target, pinned: pin, replaceId: replacing });
    back();
  };

  const remove = () => {
    if (!existing) {
      return;
    }
    const removed = removeGoal(existing.id);
    back();
    if (removed) {
      showToast({ title: 'Goal removed', onUndo: () => restoreGoal(removed) });
    }
  };

  const facts = [
    current != null ? `Now ${current} ${units}` : null,
    existing?.reachedAt
      ? `${formatProgressNumber(existing.target, 1)} ${units} reached ${formatShortDay(existing.reachedAt)}`
      : null,
  ].filter((fact): fact is string => fact != null);

  return (
    <SheetScroll
      header={<SheetHeader title={name} left={{ kind: 'back', onPress: back }} />}
      actionBar={
        <StickyActionBar>
          <PillButton title="Set goal" onPress={save} disabled={!valid} testID="goal-save" />
        </StickyActionBar>
      }>
      <View testID="goal-sheet">
        <Facts lines={facts} />
        <TargetCard text={text} onChangeText={setText} unit={units} step={step} onNudge={nudge} testID="goal-target" />
        <SheetCard>
          <SheetRow
            size="compact"
            title={full ? 'Replace on Progress' : 'Pin to Progress'}
            accessory={
              <Switch
                value={pin}
                onValueChange={(value) => {
                  setPin(value);
                  if (value && full && replaceId == null) {
                    setReplaceId(others[0]?.id ?? null);
                  }
                }}
                trackColor={{ true: signal.orange, false: sheetColors.track }}
                ios_backgroundColor={sheetColors.track}
                accessibilityLabel={full ? 'Replace on Progress' : 'Pin to Progress'}
                testID="goal-pin"
              />
            }
          />
          {full && pin
            ? others.map((goal) => {
                const chosen = (replaceId ?? others[0]?.id) === goal.id;
                return (
                  <Pressable
                    key={goal.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: chosen }}
                    accessibilityLabel={`${goal.exerciseName}, ${formatProgressNumber(goal.target, 1)} ${units}`}
                    onPress={() => setReplaceId(goal.id)}
                    style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
                    <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowTitle, styles.flex]}>
                      {goal.exerciseName}
                    </Text>
                    <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.tabular]}>
                      {`${formatProgressNumber(goal.target, 1)} ${units}`}
                    </Text>
                    <View style={[styles.tick, chosen && styles.tickOn]}>
                      {chosen ? (
                        <Text maxFontSizeMultiplier={1} style={[gadgetType.chip, styles.tickInk]}>
                          ✓
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            : null}
        </SheetCard>
        {existing ? (
          <SheetCard>
            <SheetRow size="compact" title="Remove goal" destructive onPress={remove} testID="goal-remove" />
          </SheetCard>
        ) : null}
      </View>
    </SheetScroll>
  );
}

/**
 * A body measurement's goal (PRODUCT-DECISIONS 65; the old `body-goal-sheet` logic): no pinning.
 * A target under now aims down, over it up; the goal takes its direction from that.
 */
function BodyGoalSheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { bodyGoals, bodyCheckIns, units, setBodyGoal, removeBodyGoal, restoreBodyGoal } = useWorkoutStore();
  const metric = params.metric as BodyMetricKey;
  const back = backToOrigin(params, swapSheet);
  const existing = bodyGoalFor(bodyGoals, metric);
  const next = params.next === '1' || existing?.reachedAt != null;
  const stored = latestBodyValue(bodyCheckIns, metric);
  const current = stored != null ? bodyGoalForDisplay(metric, stored, units) : null;
  const unit = metric === 'bodyweightKg' ? units : 'cm';
  const step = bodyGoalStep(metric, units);

  const [text, setText] = useState(() => {
    if (existing && !next) {
      return formatProgressNumber(bodyGoalForDisplay(metric, existing.target, units), 1);
    }
    return current != null ? formatProgressNumber(Math.round(current / step) * step, 1) : '';
  });
  const target = parseDecimalInput(text);

  const unchanged =
    existing != null &&
    !next &&
    target === Number(formatProgressNumber(bodyGoalForDisplay(metric, existing.target, units), 1));
  const valid =
    stored != null && target != null && (unchanged || target !== Number(formatProgressNumber(current ?? 0, 1)));

  const nudge = (direction: 1 | -1) => {
    const base = target ?? current ?? step;
    const value = direction > 0 ? Math.floor(base / step) * step + step : Math.ceil(base / step) * step - step;
    setText(formatProgressNumber(Math.max(step, value), 1));
  };

  const save = () => {
    if (!valid || target == null || stored == null) {
      return;
    }
    Keyboard.dismiss();
    if (!unchanged) {
      setBodyGoal({ metric, target: bodyGoalFromDisplay(metric, target, units), start: stored });
    }
    back();
  };

  const remove = () => {
    if (!existing) {
      return;
    }
    const removed = removeBodyGoal(existing.id);
    back();
    if (removed) {
      showToast({ title: 'Goal removed', onUndo: () => restoreBodyGoal(removed) });
    }
  };

  const facts = [
    current != null ? `Now ${formatProgressNumber(current, 1)} ${unit}` : null,
    existing?.reachedAt
      ? `${formatProgressNumber(bodyGoalForDisplay(metric, existing.target, units), 1)} ${unit} reached ${formatShortDay(existing.reachedAt)}`
      : null,
  ].filter((fact): fact is string => fact != null);

  return (
    <SheetScroll
      header={<SheetHeader title={bodyLabel(metric)} left={{ kind: 'back', onPress: back }} />}
      actionBar={
        <StickyActionBar>
          <PillButton title="Set goal" onPress={save} disabled={!valid} testID="body-goal-save" />
        </StickyActionBar>
      }>
      <View testID="body-goal-sheet">
        <Facts lines={facts} />
        <TargetCard text={text} onChangeText={setText} unit={unit} step={step} onNudge={nudge} testID="body-goal-target" />
        {existing ? (
          <SheetCard>
            <SheetRow size="compact" title="Remove goal" destructive onPress={remove} testID="body-goal-remove" />
          </SheetCard>
        ) : null}
      </View>
    </SheetScroll>
  );
}

function Facts({ lines }: { lines: string[] }) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <View style={styles.facts}>
      {lines.map((line) => (
        <Text key={line} maxFontSizeMultiplier={fontScaleCap.text} style={[progressType.readoutCaption, styles.tabular]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

/** The target: a big field with its unit, over − and + in the goal's step. */
function TargetCard({
  text,
  onChangeText,
  unit,
  step,
  onNudge,
  testID,
}: {
  text: string;
  onChangeText: (text: string) => void;
  unit: string;
  step: number;
  onNudge: (direction: 1 | -1) => void;
  testID: string;
}) {
  const spokenUnit = unit === 'lbs' ? 'pounds' : unit === 'kg' ? 'kilograms' : 'centimeters';
  return (
    <View style={styles.targetCard}>
      <View style={styles.targetRow}>
        <TextInput
          value={text}
          onChangeText={(next) => onChangeText(sanitizeDecimalInput(next))}
          keyboardType="decimal-pad"
          keyboardAppearance="dark"
          selectTextOnFocus
          selectionColor={signal.orange}
          accessibilityLabel={`Goal, ${spokenUnit}`}
          maxFontSizeMultiplier={fontScaleCap.display}
          testID={testID}
          // No lineHeight on a TextInput (AGENTS.md): a fixed height keeps it still.
          style={styles.targetInput}
        />
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={progressType.bigUnit}>
          {unit}
        </Text>
      </View>
      <View style={styles.nudges}>
        <Nudge label="−" spoken={`Minus ${step}`} onPress={() => onNudge(-1)} />
        <View style={styles.nudgeRule} />
        <Nudge label="+" spoken={`Plus ${step}`} onPress={() => onNudge(1)} />
      </View>
    </View>
  );
}

function Nudge({ label, spoken, onPress }: { label: string; spoken: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}>
      <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.sheetTitle, styles.nudgeInk]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  facts: { paddingHorizontal: geo.headInset, marginBottom: sheetGeometry.cardGap },
  targetCard: {
    backgroundColor: sheetColors.card,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    marginBottom: sheetGeometry.cardGap,
    overflow: 'hidden',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: geo.rowGap,
    paddingVertical: geo.rowPadX,
  },
  targetInput: {
    ...progressType.goalInput,
    color: sheetColors.ink,
    fontVariant: ['tabular-nums'],
    height: geo.targetHeight,
    minWidth: geo.targetMinWidth,
    padding: 0,
    textAlign: 'center',
  },
  nudges: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: sheetColors.rule },
  nudgeRule: { width: 1, backgroundColor: sheetColors.rule },
  nudge: { flex: 1, height: geo.nudgeHeight, alignItems: 'center', justifyContent: 'center' },
  nudgeInk: { color: sheetColors.controlInk },
  pressed: { backgroundColor: sheetColors.cardRaised },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: geo.rowGap,
    paddingHorizontal: sheetGeometry.itemPadX,
    paddingVertical: geo.rowPadY,
  },
  tick: {
    width: geo.tick,
    height: geo.tick,
    borderRadius: geo.tick / 2,
    borderWidth: 2,
    borderColor: progressColors.tickRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: signal.orange, borderColor: signal.orange },
  tickInk: { color: sheetColors.onOrange },
});
