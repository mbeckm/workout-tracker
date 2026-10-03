import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { catalogKey, exercisePickerMeta, recordExerciseSelection } from '@/catalog';
import { showToast } from '@/components/toast';
import {
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  logType,
  sheetColors,
  sheetGeometry,
  signal,
  todayColors,
  todayGeometry,
} from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { compactSet, formatClock, useLogSession } from '@/device/log';
import { durationIsMinutes } from '@/domain/helpers';
import type { DraftExercise } from '@/domain/log-session';
import type { ExercisePrescription } from '@/domain/types';
import { DEVICE, EASE_DISPLAY_FN, PRESS_SCALE } from '@/motion';

import { ExercisePicker } from './exercise-picker';
import { SheetCard, SheetHeader, SheetRow, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/** A row lifts for dragging after this hold (the system's drag-and-drop feel). */
const DRAG_HOLD_MS = 300;
/** The horizontal travel that hands a touch to the row's swipe (vertical needs twice that to win). */
const SWIPE_SLOP = 8;
/** A flick this fast opens the row's actions even short of halfway. */
const SWIPE_VELOCITY = 500;

const MOVE = { duration: DEVICE.DISPLAY, easing: EASE_DISPLAY_FN } as const;

function short(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** `3 × 8 at 85`, `3 × 12`, `3 × 0:45`, `1 × 20 min`. */
function plannedLine(draft: DraftExercise, minutes: boolean): string {
  const planned = draft.sets.filter((set) => !set.extra);
  const first = planned.find((set) => !set.done) ?? planned[0];
  const count = planned.length;
  const p = draft.prescription;
  const seconds = first?.durationSeconds ?? p.durationSeconds ?? null;
  const reps = first?.reps ?? p.reps;
  if (p.trackingMode === 'duration' && seconds != null) {
    return `${count} × ${minutes ? `${Math.round(seconds / 60)} min` : formatClock(seconds)}`;
  }
  const load = first?.weight ?? first?.counterweight ?? null;
  const base = `${count} × ${reps}`;
  if (load == null) return base;
  return `${base} at ${first?.counterweight != null && first.weight == null ? `−${short(load)}` : short(load)}`;
}

/** The logged sets: `85 × 8, 8, 7` when the load holds, else `80×8, 85×6`. */
function loggedLine(draft: DraftExercise, minutes: boolean): string {
  const done = draft.sets.filter((set) => set.done);
  const loads = done.map((set) => set.weight ?? null);
  const sameLoad = loads[0] != null && loads.every((load) => load === loads[0]);
  if (sameLoad && done.every((set) => set.reps != null)) {
    return `${short(loads[0] as number)} × ${done.map((set) => set.reps).join(', ')}`;
  }
  return done
    .map((set) => compactSet(set, minutes))
    .filter(Boolean)
    .join(', ');
}

/** Today (M3, screen 07): the day's lifts, or the alternatives for one (Swap) in place. */
export function TodaySheet({ params }: { params: SheetParams }) {
  if (params.pick) {
    return <PickView target={params.pick} />;
  }
  return params.swap ? <SwapView exerciseId={params.swap} /> : <LiftsView />;
}

function LiftsView() {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const log = useLogSession();
  const { drafts, day, exerciseIndex, mode, setLabel } = log;

  const [rowHeight, setRowHeight] = useState<number>(todayGeometry.rowHeight);
  const [openId, setOpenId] = useState<string | null>(null);
  const ids = drafts.map((draft) => draft.prescription.id);
  const idsKey = ids.join('|');

  // Where each row sits; a drag rewrites it live, the session catches up on drop.
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(ids.map((id, index) => [id, index])),
  );
  /** The lifted row's id from pick-up until the session holds the new order; null when still. */
  const settling = useSharedValue<string | null>(null);
  const [dropTick, setDropTick] = useState(0);
  useEffect(() => {
    positions.set(Object.fromEntries(idsKey.split('|').map((id, index) => [id, index])));
    settling.set(null);
  }, [idsKey, dropTick, positions, settling]);

  const onDrop = useCallback(
    (id: string, to: number) => {
      const from = log.drafts.findIndex((draft) => draft.prescription.id === id);
      if (from >= 0 && to !== from) {
        log.reorder(from, to);
      }
      setDropTick((tick) => tick + 1);
    },
    [log],
  );

  const remove = (draft: DraftExercise) => {
    setOpenId(null);
    const removed = log.removeLiftFromSession(draft.prescription.id);
    if (removed) {
      showToast({ title: `${draft.prescription.name} removed`, onUndo: () => log.restoreLift(removed) });
    }
  };

  const addLift = () => swapSheet('today', { pick: ADD_LIFT });

  return (
    <SheetScroll
      header={<SheetHeader title={day?.title ?? 'Today'} right={{ kind: 'text', label: 'Done', onPress: close }} />}>
      <View style={[styles.card, { height: rowHeight * drafts.length }]}>
        {drafts.map((draft, index) => {
          const current = index === exerciseIndex;
          const minutes = durationIsMinutes(draft.prescription);
          const logged = draft.sets.some((set) => set.done);
          const sub =
            current && mode !== 'finish' && setLabel
              ? `Now, ${setLabel.toLowerCase()}`
              : logged
                ? loggedLine(draft, minutes)
                : plannedLine(draft, minutes);
          return (
            <LiftRow
              key={draft.prescription.id}
              draft={draft}
              index={index}
              count={drafts.length}
              sub={sub}
              current={current}
              rowHeight={rowHeight}
              positions={positions}
              settling={settling}
              open={openId === draft.prescription.id}
              onMeasure={(height) => setRowHeight((value) => (height > value ? height : value))}
              onOpen={(open) => setOpenId(open ? draft.prescription.id : null)}
              onDrop={onDrop}
              onJump={() => {
                log.goToExercise(index);
                close();
              }}
              onEditSet={(setId) => {
                log.goToExercise(index);
                log.beginEdit(draft.prescription.id, setId);
                close();
              }}
              onInfo={() => swapSheet('exercise', { exerciseId: draft.prescription.id, from: 'today' })}
              onSwap={() => {
                setOpenId(null);
                swapSheet('today', { swap: draft.prescription.id });
              }}
              onRemove={() => remove(draft)}
              onMove={(direction) => {
                const to = index + direction;
                if (to >= 0 && to < drafts.length) log.reorder(index, to);
              }}
            />
          );
        })}
      </View>
      <Pressable
        onPress={addLift}
        accessibilityRole="button"
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowTitle, styles.addText]}>
          Add lift
        </Text>
      </Pressable>
    </SheetScroll>
  );
}

function LiftRow({
  draft,
  index,
  count,
  sub,
  current,
  rowHeight,
  positions,
  settling,
  open,
  onMeasure,
  onOpen,
  onDrop,
  onJump,
  onEditSet,
  onInfo,
  onSwap,
  onRemove,
  onMove,
}: {
  draft: DraftExercise;
  index: number;
  count: number;
  sub: string;
  current: boolean;
  rowHeight: number;
  positions: SharedValue<Record<string, number>>;
  settling: SharedValue<string | null>;
  open: boolean;
  onMeasure: (height: number) => void;
  onOpen: (open: boolean) => void;
  onDrop: (id: string, to: number) => void;
  onJump: () => void;
  onEditSet: (setId: string) => void;
  onInfo: () => void;
  onSwap: () => void;
  onRemove: () => void;
  onMove: (direction: 1 | -1) => void;
}) {
  const id = draft.prescription.id;
  const name = draft.prescription.name;
  const reduceMotion = useReducedMotion();
  const actionsWidth = todayGeometry.action * 2;

  const dragging = useSharedValue(false);
  const dragY = useSharedValue(0);
  const startY = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const swipeStart = useSharedValue(0);

  // Another row opened, or this one was closed from outside: slide shut.
  useEffect(() => {
    if (!open) swipeX.set(withTiming(0, MOVE));
  }, [open, swipeX]);

  /** This swipe began while nothing was settling. */
  const armed = useSharedValue(false);
  /** Where the finger went down, for the pick-up's stillness check. */
  const pressX = useSharedValue(0);
  const pressY = useSharedValue(0);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(DRAG_HOLD_MS)
        // Moving before the hold is a swipe or a scroll: the pan's own long-press timer doesn't
        // see movement before it activates, so step aside here.
        .onTouchesDown((event) => {
          pressX.set(event.allTouches[0]?.absoluteX ?? 0);
          pressY.set(event.allTouches[0]?.absoluteY ?? 0);
        })
        .onTouchesMove((event, manager) => {
          const touch = event.allTouches[0];
          if (!touch || dragging.get()) return;
          const moved = Math.max(Math.abs(touch.absoluteX - pressX.get()), Math.abs(touch.absoluteY - pressY.get()));
          if (moved > SWIPE_SLOP) manager.fail();
        })
        .onStart(() => {
          // One row at a time: not while another drop is still settling.
          if (settling.get() != null) return;
          settling.set(id);
          const at = positions.get()[id] ?? 0;
          startY.set(at * rowHeight);
          dragY.set(at * rowHeight);
          dragging.set(true);
        })
        .onUpdate((event) => {
          if (!dragging.get()) return;
          const y = Math.max(0, Math.min((count - 1) * rowHeight, startY.get() + event.translationY));
          dragY.set(y);
          const map = positions.get();
          const from = map[id] ?? 0;
          const to = Math.round(y / rowHeight);
          if (to === from) return;
          const next: Record<string, number> = {};
          for (const key of Object.keys(map)) {
            const at = map[key];
            if (key === id) next[key] = to;
            else if (from < to && at > from && at <= to) next[key] = at - 1;
            else if (from > to && at < from && at >= to) next[key] = at + 1;
            else next[key] = at;
          }
          positions.set(next);
        })
        .onEnd(() => {
          if (!dragging.get()) return;
          const to = positions.get()[id] ?? 0;
          dragY.set(
            withTiming(to * rowHeight, MOVE, () => {
              dragging.set(false);
              scheduleOnRN(onDrop, id, to);
            }),
          );
        }),
    [count, dragY, dragging, id, onDrop, positions, pressX, pressY, rowHeight, settling, startY],
  );

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-SWIPE_SLOP, SWIPE_SLOP])
        .failOffsetY([-SWIPE_SLOP * 2, SWIPE_SLOP * 2])
        // Not on a row that's still moving into place after a drop.
        .onBegin(() => {
          armed.set(settling.get() == null);
        })
        .onStart(() => {
          if (settling.get() != null) armed.set(false);
          swipeStart.set(swipeX.get());
        })
        .onUpdate((event) => {
          if (!armed.get()) return;
          swipeX.set(Math.max(-actionsWidth, Math.min(0, swipeStart.get() + event.translationX)));
        })
        .onEnd((event) => {
          if (!armed.get()) return;
          const shouldOpen = swipeX.get() < -actionsWidth / 2 || event.velocityX < -SWIPE_VELOCITY;
          const settle = shouldOpen && event.velocityX < SWIPE_VELOCITY;
          swipeX.set(withTiming(settle ? -actionsWidth : 0, MOVE));
          scheduleOnRN(onOpen, settle);
        })
        .onFinalize(() => {
          armed.set(false);
        }),
    [actionsWidth, armed, onOpen, settling, swipeStart, swipeX],
  );

  // A flick too quick for the pan to take over (down, one move, up) still opens or closes.
  const flick = useMemo(
    () =>
      Gesture.Exclusive(
        Gesture.Fling()
          .direction(Directions.LEFT)
          .onEnd(() => {
            if (settling.get() != null) return;
            swipeX.set(withTiming(-actionsWidth, MOVE));
            scheduleOnRN(onOpen, true);
          }),
        Gesture.Fling()
          .direction(Directions.RIGHT)
          .onEnd(() => {
            if (settling.get() != null) return;
            swipeX.set(withTiming(0, MOVE));
            scheduleOnRN(onOpen, false);
          }),
      ),
    [actionsWidth, onOpen, settling, swipeX],
  );

  const gesture = useMemo(() => Gesture.Race(drag, swipe, flick), [drag, flick, swipe]);

  const rowStyle = useAnimatedStyle(() => {
    const lifted = dragging.get();
    const at = positions.get()[id] ?? index;
    const top = lifted ? dragY.get() : reduceMotion ? at * rowHeight : withTiming(at * rowHeight, MOVE);
    return {
      top,
      zIndex: lifted ? 1 : 0,
      transform: [{ scale: withTiming(lifted && !reduceMotion ? todayGeometry.dragScale : 1, MOVE) }],
      boxShadow: lifted ? `0 8px 18px ${todayColors.dragShadow}` : undefined,
    };
  });
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.get() }] }));

  const onAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'swap':
        onSwap();
        break;
      case 'remove':
        onRemove();
        break;
      case 'up':
        onMove(-1);
        break;
      case 'down':
        onMove(1);
        break;
      case 'info':
        onInfo();
        break;
    }
  };

  return (
    <Animated.View style={[styles.row, { height: rowHeight }, rowStyle]}>
      <View style={[styles.actions, index > 0 && styles.rule]}>
        <Pressable
          onPress={onSwap}
          accessibilityElementsHidden={!open}
          style={({ pressed }) => [styles.action, styles.swapAction, pressed && styles.pressed]}>
          <Text maxFontSizeMultiplier={fontScaleCap.display} style={gadgetType.rowTitle}>
            Swap
          </Text>
        </Pressable>
        <Pressable
          onPress={onRemove}
          accessibilityElementsHidden={!open}
          style={({ pressed }) => [styles.action, styles.removeAction, pressed && styles.pressed]}>
          <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.rowTitle, styles.onOrange]}>
            Remove
          </Text>
        </Pressable>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
          style={[
            styles.front,
            { minHeight: rowHeight },
            index > 0 && styles.rule,
            current && styles.current,
            frontStyle,
          ]}>
          <Pressable
            onPress={open ? () => onOpen(false) : onJump}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${sub}`}
            accessibilityState={{ selected: current }}
            accessibilityActions={[
              { name: 'swap', label: 'Swap' },
              { name: 'remove', label: 'Remove' },
              { name: 'up', label: 'Move up' },
              { name: 'down', label: 'Move down' },
              { name: 'info', label: 'Exercise info' },
            ]}
            onAccessibilityAction={onAction}
            style={({ pressed }) => [styles.jump, pressed && styles.jumpPressed]}>
            <Text maxFontSizeMultiplier={fontScaleCap.text} numberOfLines={1} style={gadgetType.rowTitle}>
              {name}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap.text} numberOfLines={1} style={[logType.liftSub, styles.sub]}>
              {sub}
            </Text>
          </Pressable>
          <View style={styles.bars}>
            {draft.sets.map((set, setIndex) =>
              set.done ? (
                <Pressable
                  key={set.id}
                  onPress={() => onEditSet(set.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit set ${setIndex + 1}`}
                  hitSlop={{ top: 19, bottom: 19, left: 2, right: 2 }}
                  style={[styles.bar, styles.barOn]}
                />
              ) : (
                <View key={set.id} style={styles.bar} />
              ),
            )}
          </View>
          <Pressable
            onPress={onInfo}
            accessibilityRole="button"
            accessibilityLabel={`About ${name}`}
            hitSlop={6}
            style={({ pressed }) => [styles.info, pressed && styles.pressed]}>
            <Text maxFontSizeMultiplier={fontScaleCap.display} style={logType.info}>
              i
            </Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/** Swap (in place): the lift's alternatives, then the whole catalog through the picker. */
function SwapView({ exerciseId }: { exerciseId: string }) {
  const { swapSheet } = useDevice();
  const log = useLogSession();
  const draft = log.drafts.find((item) => item.prescription.id === exerciseId);
  // Lifts already in today's session aren't alternatives.
  const alternatives = useMemo(() => {
    const inDay = new Set(log.drafts.map((item) => item.prescription.name.trim().toLowerCase()));
    return log.alternativesFor(exerciseId).filter((item) => !inDay.has(item.name.trim().toLowerCase()));
  }, [exerciseId, log]);
  const back = () => swapSheet('today');

  const swapTo = (exercise: ExercisePrescription) => {
    log.swapExercise(exerciseId, exercise);
    back();
  };

  return (
    <SheetScroll
      header={
        <SheetHeader
          title={draft ? `Swap ${draft.prescription.name}` : 'Swap'}
          left={{ kind: 'back', onPress: back }}
        />
      }>
      {alternatives.length > 0 ? (
        <SheetCard>
          {alternatives.map((exercise) => (
            <SheetRow
              key={exercise.id}
              size="compact"
              title={exercise.name}
              sub={exercisePickerMeta(exercise)}
              onPress={() => {
                void recordExerciseSelection(exercise);
                swapTo(exercise);
              }}
            />
          ))}
        </SheetCard>
      ) : null}
      <SheetCard>
        <SheetRow size="compact" title="Choose another" onPress={() => swapSheet('today', { pick: exerciseId })} />
      </SheetCard>
    </SheetScroll>
  );
}

/** `pick` for adding a lift; otherwise it's the id of the lift being swapped. */
const ADD_LIFT = 'add';

/**
 * The whole catalog in place (the picker in replace mode): one tap adds the lift to today's
 * session, or swaps it in for `target`. The picker records the choice in recents itself.
 */
function PickView({ target }: { target: string }) {
  const { swapSheet } = useDevice();
  const log = useLogSession();
  const adding = target === ADD_LIFT;
  const draft = adding ? undefined : log.drafts.find((item) => item.prescription.id === target);
  const takenKeys = useMemo(() => new Set(log.drafts.map((item) => catalogKey(item.prescription))), [log.drafts]);

  const back = () => {
    Keyboard.dismiss();
    swapSheet('today', adding ? {} : { swap: target });
  };

  const onPick = (exercise: ExercisePrescription) => {
    Keyboard.dismiss();
    if (adding) {
      log.addLift(exercise);
    } else {
      log.swapExercise(target, exercise);
    }
    swapSheet('today');
  };

  return (
    <SheetScroll
      header={
        <SheetHeader
          title={adding ? (log.day ? `Add to ${log.day.title}` : 'Add lift') : draft ? `Swap ${draft.prescription.name}` : 'Swap'}
          left={{ kind: 'back', onPress: back }}
        />
      }>
      <ExercisePicker mode="replace" onPick={onPick} takenKeys={takenKeys} />
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: sheetColors.card,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: { position: 'absolute', left: 0, right: 0, backgroundColor: sheetColors.card },
  actions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  action: { width: todayGeometry.action, alignItems: 'center', justifyContent: 'center' },
  swapAction: { backgroundColor: sheetColors.pillDark },
  removeAction: { backgroundColor: signal.orange },
  onOrange: { color: sheetColors.onOrange },
  front: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: todayGeometry.rowGap,
    paddingLeft: todayGeometry.rowPadLeft,
    paddingRight: todayGeometry.rowPadRight,
    backgroundColor: sheetColors.card,
  },
  rule: { borderTopWidth: 1, borderTopColor: sheetColors.rule },
  current: {
    backgroundColor: sheetColors.cardRaised,
    boxShadow: `inset ${todayGeometry.currentInset}px 0 0 ${signal.orange}`,
  },
  jump: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: todayGeometry.jumpPadX,
    paddingVertical: todayGeometry.jumpPadY,
    borderRadius: todayGeometry.jumpRadius,
    borderCurve: 'continuous',
  },
  jumpPressed: { backgroundColor: sheetColors.cardRaised },
  sub: { marginTop: todayGeometry.subGap },
  bars: { flexDirection: 'row', gap: todayGeometry.barGap, flexShrink: 0 },
  bar: {
    width: todayGeometry.bar,
    height: todayGeometry.barHeight,
    borderRadius: todayGeometry.barRadius,
    backgroundColor: todayColors.barOff,
  },
  barOn: { backgroundColor: signal.orange },
  info: {
    width: todayGeometry.info,
    height: todayGeometry.info,
    borderRadius: todayGeometry.info / 2,
    backgroundColor: sheetColors.track,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  add: {
    alignSelf: 'flex-start',
    paddingHorizontal: sheetGeometry.itemPadX,
    paddingVertical: sheetGeometry.itemPadY,
  },
  addText: { color: signal.orange },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
});
