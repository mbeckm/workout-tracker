import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from 'react-native';
import type Animated from 'react-native-reanimated';

import { track } from '@/analytics/analytics';
import { showToast } from '@/components/toast';
import {
  PRESSED_OPACITY,
  fontScaleCap,
  gadgetType,
  plansGeometry as geo,
  plansType,
  sheetColors,
  sheetGeometry,
  signal,
} from '@/constants/theme';
import type { ExercisePrescription, WorkoutDay, WorkoutPlan } from '@/domain/types';
import { useActivation } from '@/device/activation';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import {
  addDay,
  dayDisplayName,
  duplicateDay,
  leaveDecision,
  liftCountLabel,
  moveDay,
  moveExercise,
  moveExerciseTo,
  planDisplayName,
  planHasLifts,
  renameDay,
  renamePlan,
  planUseGate,
} from '@/device/plans-model';
import { requirePro } from '@/purchases/pro-gate';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';

import { editorParams } from './add-sheet';
import { DayLifts } from './plan-day';
import { ActiveBadge } from './plans-sheet';
import { PillButton, SheetHeader, SheetScroll, StickyActionBar } from './primitives';

/** The usual split names, offered while a day is renamed (decision 71: one tap instead of typing). */
const DAY_NAMES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body'];

const NAME_MAX = 40;

type Renaming = { kind: 'plan' } | { kind: 'day'; dayId: string } | null;

/** Day and plan actions: the system action sheet on iOS (trim-ui §9: alerts and action sheets stay system-styled). */
export function showActions(
  title: string,
  actions: readonly { label: string; destructive?: boolean; run: () => void }[],
) {
  const options = [...actions.map((action) => action.label), 'Cancel'];
  if (Platform.OS === 'ios') {
    const destructive = actions.findIndex((action) => action.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
        userInterfaceStyle: 'dark',
      },
      (index) => actions[index]?.run(),
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...actions.map((action) => ({
      text: action.label,
      style: action.destructive ? ('destructive' as const) : ('default' as const),
      onPress: action.run,
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

/**
 * The plan editor (PA1, screens 21 and 25; plan editor v3 / 3.1 behaviour): the plan's name
 * with its Active badge (tap to rename it in place), each day as a header (tap the name to
 * rename it; `…` for rename, duplicate, delete with Undo, move up or down) over a card of lifts,
 * `Add day` at the end, and a sticky `Use plan` while the plan isn't the active one. The header
 * `…` holds Rename, Use plan and Delete plan.
 *
 * Leaving (‹, a swipe down, the scrim, Use plan) names an unnamed plan after its days
 * (decision 71) and silently drops a plan that was opened unnamed and still has no lifts;
 * going back to the rack after a change files its cartridges. Going to Add lifts or to device
 * edit isn't leaving: they come back here.
 */
export function EditorSheet({ params }: { params: SheetParams }) {
  const { swapSheet, open, mode } = useDevice();
  const { plans, activePlanId, activeSession, updatePlan, editPlan, deletePlan } = useWorkoutStore();
  const { removePlan, removeDay, removeExercise } = useUndoableDeletes();
  const { activatePlanWithInsert } = useActivation();
  const planId = params.planId ?? '';
  const isNew = params.new === '1';
  const plan = plans.find((item) => item.id === planId);

  const planRef = useRef(plan);
  const [initialPlan] = useState(plan);
  const [openedUnnamed] = useState(() => plan != null && !plan.name.trim());
  /** Set when going to Add lifts or device edit, which come back here. */
  const stayingRef = useRef(false);
  const leftRef = useRef(false);
  const deletedRef = useRef(false);
  const gatingRef = useRef(false);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const dayY = useRef<Record<string, number>>({});
  const scrolledRef = useRef(false);
  const [renaming, setRenaming] = useState<Renaming>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const leave = () => {
    if (leftRef.current || stayingRef.current || deletedRef.current) {
      return null;
    }
    leftRef.current = true;
    const current = planRef.current;
    if (!current) {
      return null;
    }
    const decision = leaveDecision({
      plan: current,
      openedUnnamed,
      isNew,
      changed: params.dirty === '1' || current !== initialPlan,
    });
    track('plan_editor_closed', {
      outcome: decision.discard ? 'discarded' : 'saved',
      is_new: isNew,
      days: current.days.length,
      exercises: current.days.reduce((sum, day) => sum + day.exercises.length, 0),
      active: current.id === activePlanId,
    });
    if (decision.discard) {
      deletePlan(current, { archive: false });
    } else if (decision.rename) {
      updatePlan({ ...current, name: decision.rename });
    }
    return decision;
  };
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  });
  // A swipe down, the scrim, ✕ and Use plan all close the sheet: leaving happens as it unmounts.
  useEffect(() => () => void leaveRef.current(), []);

  if (!plan) {
    return <SheetScroll header={<SheetHeader title="Plan" left={{ kind: 'back', onPress: () => swapSheet('plans') }} />}>{null}</SheetScroll>;
  }

  const via: SheetParams = params.via ? { from: params.via } : {};
  const isActive = plan.id === activePlanId;
  const hasLifts = planHasLifts(plan);
  const sessionOpen = mode === 'log' || mode === 'rest' || mode === 'finish' || activeSession != null;

  const backToRack = () => {
    commitRename();
    const decision = leave();
    swapSheet('plans', { ...via, ...(decision?.file ? { filed: plan.id } : {}) });
  };

  const stay = () => {
    Keyboard.dismiss();
    stayingRef.current = true;
  };

  /* Renaming in place --------------------------------------------------------------------- */

  const startRename = (next: Exclude<Renaming, null>) => {
    commitRename();
    if (next.kind === 'plan') {
      setDraft(plan.name.trim());
    } else {
      setDraft(plan.days.find((day) => day.id === next.dayId)?.title.trim() ?? '');
    }
    setRenaming(next);
  };

  /** Saves the open name field (an empty or unchanged name keeps the old one). */
  const commitRename = (value = draft) => {
    if (!renaming) {
      return;
    }
    const latest = planRef.current;
    if (latest) {
      const next = renaming.kind === 'plan' ? renamePlan(latest, value) : renameDay(latest, renaming.dayId, value);
      if (next !== latest) {
        updatePlan(next);
      }
    }
    setRenaming(null);
  };

  /* Plan actions ---------------------------------------------------------------------------- */

  const activateThisPlan = async () => {
    commitRename();
    const gate = planUseGate({ plan, activePlanId, sessionOpen });
    if (gate.kind === 'active') {
      return;
    }
    if (gate.kind === 'blocked') {
      showToast({ title: gate.toast });
      return;
    }
    if (gatingRef.current) {
      return;
    }
    gatingRef.current = true;
    const allowed = await requirePro(gate.reason).finally(() => {
      gatingRef.current = false;
    });
    if (allowed) {
      activatePlanWithInsert(plan.id, 'rack');
    }
  };

  const deleteThisPlan = () => {
    deletedRef.current = true;
    removePlan(plan);
    swapSheet('plans', via);
  };

  const planActions = () =>
    showActions(planDisplayName(plan), [
      { label: 'Rename', run: () => startRename({ kind: 'plan' }) },
      ...(isActive ? [] : [{ label: 'Use plan', run: () => void activateThisPlan() }]),
      { label: 'Delete plan', destructive: true, run: deleteThisPlan },
    ]);

  /* Day actions ----------------------------------------------------------------------------- */

  const edit = (transform: (latest: WorkoutPlan) => WorkoutPlan) => editPlan(plan.id, transform);

  const dayActions = (day: WorkoutDay, index: number) =>
    showActions(dayDisplayName(day, index), [
      { label: 'Rename', run: () => startRename({ kind: 'day', dayId: day.id }) },
      { label: 'Duplicate', run: () => edit((latest) => duplicateDay(latest, day.id)) },
      ...(index > 0 ? [{ label: 'Move up', run: () => edit((latest) => moveDay(latest, day.id, -1)) }] : []),
      ...(index < plan.days.length - 1
        ? [{ label: 'Move down', run: () => edit((latest) => moveDay(latest, day.id, 1)) }]
        : []),
      ...(plan.days.length > 1
        ? [{ label: 'Delete day', destructive: true, run: () => removeDay(plan, day.id) }]
        : []),
    ]);

  const openAdd = (day: WorkoutDay) => {
    commitRename();
    stay();
    swapSheet('add', editorParams(params, { dayId: day.id }));
  };

  const openEdit = (day: WorkoutDay, exercise: ExercisePrescription) => {
    commitRename();
    stay();
    open({
      mode: 'edit',
      planId: plan.id,
      dayId: day.id,
      exerciseId: exercise.id,
      back: editorParams(params, { dirty: '1', dayId: day.id }),
    });
  };

  const addOneDay = () => {
    commitRename();
    edit(addDay);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  // Home's 0-lift redirect and Add lifts land on their day.
  const onDayLayout = (day: WorkoutDay) => (event: LayoutChangeEvent) => {
    dayY.current[day.id] = event.nativeEvent.layout.y;
    if (!scrolledRef.current && params.dayId === day.id && plan.days[0]?.id !== day.id) {
      scrolledRef.current = true;
      const y = Math.max(0, event.nativeEvent.layout.y - sheetGeometry.headerHeight);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
    }
  };

  const title = planDisplayName(plan);

  return (
    <SheetScroll
      scrollRef={scrollRef}
      header={
        <SheetHeader
          title={title}
          titleHidden
          left={{ kind: 'back', onPress: backToRack }}
          right={{ kind: 'text', label: '…', accessibilityLabel: 'Plan options', onPress: planActions }}
        />
      }
      actionBar={
        isActive ? undefined : (
          <StickyActionBar>
            <PillButton title="Use plan" onPress={() => void activateThisPlan()} style={styles.pill} testID="editor-use" />
          </StickyActionBar>
        )
      }>
      <View testID="editor-sheet">
        <View style={styles.titleRow}>
          {renaming?.kind === 'plan' ? (
            <NameField
              value={draft}
              onChange={setDraft}
              onDone={(text) => commitRename(text)}
              placeholder={title}
              accessibilityLabel="Plan name"
              style={[plansType.planTitleInput, styles.planInput]}
            />
          ) : (
            <Pressable
              onPress={() => startRename({ kind: 'plan' })}
              accessibilityRole="button"
              accessibilityLabel={`${title}${isActive ? ', active' : ''}`}
              style={({ pressed }) => [styles.titlePress, pressed && styles.pressed]}
              testID="editor-title">
              <Text maxFontSizeMultiplier={fontScaleCap.title} style={[gadgetType.sheetHero, styles.titleText]}>
                {title}
              </Text>
            </Pressable>
          )}
          {isActive ? <ActiveBadge /> : null}
        </View>

        {plan.days.map((day, index) => {
          const name = dayDisplayName(day, index);
          const renamingDay = renaming?.kind === 'day' && renaming.dayId === day.id;
          const taken = new Set(plan.days.filter((item) => item.id !== day.id).map((item) => item.title.trim()));
          return (
            <View key={day.id} onLayout={onDayLayout(day)} testID={`editor-day-${index}`}>
              <View style={styles.dayHead}>
                {renamingDay ? (
                  <NameField
                    value={draft}
                    onChange={setDraft}
                    onDone={(text) => commitRename(text)}
                    placeholder={`Day ${index + 1}`}
                    accessibilityLabel="Day name"
                    style={[plansType.dayTitleInput, styles.dayInput]}
                  />
                ) : (
                  <Pressable
                    onPress={() => startRename({ kind: 'day', dayId: day.id })}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    style={({ pressed }) => [styles.dayName, pressed && styles.pressed]}
                    testID={`editor-day-${index}-name`}>
                    <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.title} style={plansType.dayTitle}>
                      {name}
                    </Text>
                  </Pressable>
                )}
                <Text maxFontSizeMultiplier={fontScaleCap.title} style={plansType.dayCount}>
                  {liftCountLabel(day.exercises.length)}
                </Text>
                <Pressable
                  onPress={() => dayActions(day, index)}
                  accessibilityRole="button"
                  accessibilityLabel={`${name} options`}
                  testID={`editor-day-${index}-more`}
                  style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
                  <Text maxFontSizeMultiplier={fontScaleCap.title} style={plansType.dayCount}>
                    …
                  </Text>
                </Pressable>
              </View>
              {renamingDay ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  style={styles.suggestions}
                  contentContainerStyle={styles.suggestionRow}>
                  {DAY_NAMES.filter((suggestion) => suggestion === draft || !taken.has(suggestion)).map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => commitRename(suggestion)}
                      accessibilityRole="button"
                      testID={`day-name-${suggestion}`}
                      style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                      <Text maxFontSizeMultiplier={fontScaleCap.title} style={plansType.muscleChip}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <DayLifts
                exercises={day.exercises}
                emphasiseAdd={!hasLifts && index === 0}
                onChip={(exercise) => openEdit(day, exercise)}
                onRemove={(exercise) => removeExercise(plan, day.id, exercise.id)}
                onMove={(exercise, delta) => edit((latest) => moveExercise(latest, day.id, exercise.id, delta))}
                onReorder={(exerciseId, to) =>
                  edit((latest) => {
                    const lifts = latest.days.find((item) => item.id === day.id)?.exercises ?? [];
                    const from = lifts.findIndex((item) => item.id === exerciseId);
                    return moveExerciseTo(latest, day.id, from, to);
                  })
                }
                onAdd={() => openAdd(day)}
                testID={`editor-day-${index}`}
              />
            </View>
          );
        })}

        <Pressable
          onPress={addOneDay}
          accessibilityRole="button"
          testID="editor-add-day"
          style={({ pressed }) => [styles.addDay, pressed && styles.pressed]}>
          <Text maxFontSizeMultiplier={fontScaleCap.title} style={plansType.addDay}>
            Add day
          </Text>
        </Pressable>
        {isActive ? <View style={styles.tail} /> : null}
      </View>
    </SheetScroll>
  );
}

/** An inline name field: the title's own type, the dark keyboard, an orange cursor. */
function NameField({
  value,
  onChange,
  onDone,
  placeholder,
  accessibilityLabel,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  onDone: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  style: TextInputProps['style'];
}) {
  const ref = useRef<TextInput>(null);
  return (
    <TextInput
      ref={ref}
      value={value}
      // `selectTextOnFocus` misses an autofocused field on iOS: select the old name once it has focus.
      onFocus={() => requestAnimationFrame(() => ref.current?.setSelection(0, value.length))}
      onChangeText={onChange}
      // The field's own text: a Return typed right after the last letter beats the state update.
      onSubmitEditing={(event) => onDone(event.nativeEvent.text)}
      onEndEditing={(event) => onDone(event.nativeEvent.text)}
      autoFocus
      selectTextOnFocus
      returnKeyType="done"
      placeholder={placeholder}
      placeholderTextColor={sheetColors.muted}
      selectionColor={signal.orange}
      keyboardAppearance="dark"
      maxLength={NAME_MAX}
      accessibilityLabel={accessibilityLabel}
      maxFontSizeMultiplier={fontScaleCap.title}
      testID="editor-name-field"
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: PRESSED_OPACITY },
  pill: { width: 'auto', paddingHorizontal: geo.pillPadX },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: geo.titleGap,
    marginTop: geo.titleTop,
    paddingHorizontal: geo.titleX,
    minHeight: geo.titleHeight,
  },
  titlePress: { flexShrink: 1 },
  titleText: { flexShrink: 1 },
  // A fixed height, no line height on a TextInput (AGENTS.md).
  planInput: { flex: 1, height: geo.titleHeight, padding: 0, color: sheetColors.ink },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: geo.dayTop,
    marginBottom: geo.dayBottom,
    marginLeft: geo.dayX,
    minHeight: geo.dayHeight,
  },
  dayName: { flex: 1, minWidth: 0 },
  dayInput: { flex: 1, height: geo.dayHeight, padding: 0, color: sheetColors.ink },
  more: {
    width: geo.dayMore,
    height: geo.dayMore,
    marginVertical: -(geo.dayMore - geo.dayHeight) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { flexGrow: 0, marginHorizontal: -sheetGeometry.sidePad, marginBottom: geo.chipsBottom },
  suggestionRow: { gap: geo.chipGap, paddingHorizontal: geo.chipsPadX, paddingTop: geo.suggestionTop },
  suggestion: {
    height: geo.chipHeight,
    paddingHorizontal: geo.chipPadX,
    borderRadius: geo.chipRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.pillDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDay: {
    marginTop: geo.addDayTop,
    marginHorizontal: geo.addDayX,
    height: geo.addDayHeight,
    borderRadius: geo.addDayRadius,
    borderCurve: 'continuous',
    boxShadow: `inset 0 0 0 ${geo.addDayRing}px ${sheetColors.rule}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tail: { height: geo.tail },
});
