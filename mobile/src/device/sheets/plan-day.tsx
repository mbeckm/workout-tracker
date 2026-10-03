import { useLayoutEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  PRESSED_OPACITY,
  fontScaleCap,
  gadgetRadius,
  lcd,
  plansColors,
  plansGeometry as geo,
  plansType,
  sheetColors,
  sheetGeometry,
  signal,
} from '@/constants/theme';
import type { ExercisePrescription } from '@/domain/types';
import { chipPrescription, spokenPrescription } from '@/device/plans-model';
import { DEVICE, EASE_DISPLAY_FN, SPRING } from '@/motion';

import { useSheetChrome } from './sheet-context';

const SHIFT = { duration: DEVICE.DRUM, easing: EASE_DISPLAY_FN } as const;

/**
 * Where a dragged row lands: the number of other rows whose middle sits above the dragged
 * row's middle. Rows keep their measured heights (Dynamic Type), so this works on any size.
 */
function landingIndex(from: number, dy: number, heights: readonly number[]): number {
  'worklet';
  let top = 0;
  let fromTop = 0;
  for (let i = 0; i < from; i += 1) fromTop += heights[i] ?? 0;
  const centre = fromTop + (heights[from] ?? 0) / 2 + dy;
  let count = 0;
  for (let i = 0; i < heights.length; i += 1) {
    const h = heights[i] ?? 0;
    if (i !== from && top + h / 2 < centre) count += 1;
    top += h;
  }
  return count;
}

/** How far the dragged row travels to sit in slot `to`. */
function slotOffset(from: number, to: number, heights: readonly number[]): number {
  'worklet';
  let offset = 0;
  if (to > from) for (let i = from + 1; i <= to; i += 1) offset += heights[i] ?? 0;
  if (to < from) for (let i = to; i < from; i += 1) offset -= heights[i] ?? 0;
  return offset;
}

/**
 * A day's card in the editor (PA1, `.dc`): its lifts as rows (the name and the dark sets × reps
 * chip), then `Add lift` in orange. A row swipes left to remove (with Undo, by the caller) and
 * drags to a new place after a long press; Move up / Move down / Remove are its accessibility
 * actions.
 *
 * A gesture acts on the row under the finger at touch-down. While a drop is settling (the lifted
 * row gliding into its slot, then the store's new order), the card's rows ignore new swipes and
 * holds: nothing acts on a row that is still moving. The pick-up is a plain long-press pan, not
 * a manually activated one: RNGH re-creates a manual-activation recognizer on every re-render,
 * which could swallow the chip's tap.
 */
export function DayLifts({
  exercises,
  emphasiseAdd,
  onChip,
  onRemove,
  onMove,
  onReorder,
  onAdd,
  testID,
}: {
  exercises: readonly ExercisePrescription[];
  /** An empty plan's first state: `Add lift` is the one thing to do. */
  emphasiseAdd: boolean;
  onChip: (exercise: ExercisePrescription) => void;
  onRemove: (exercise: ExercisePrescription) => void;
  onMove: (exercise: ExercisePrescription, delta: -1 | 1) => void;
  /** A drop: the lift (by id) lands at index `to`. */
  onReorder: (exerciseId: string, to: number) => void;
  onAdd: () => void;
  testID: string;
}) {
  const heights = useSharedValue<number[]>([]);
  /** The lifted row's index while it's dragged or settling into its slot; -1 when the card is still. */
  const dragFrom = useSharedValue(-1);
  const dragDy = useSharedValue(0);
  const order = exercises.map((item) => item.id).join('|');

  // A committed drag re-renders the rows in their new order: only then let go of the offsets,
  // so nothing jumps between the drop and the store's update.
  useLayoutEffect(() => {
    dragFrom.set(-1);
    dragDy.set(0);
  }, [order, dragDy, dragFrom]);

  // The drop, by identity: the row's index may be stale by the time the glide ends.
  const commit = (exerciseId: string, to: number) => {
    const from = exercises.findIndex((item) => item.id === exerciseId);
    const slot = Math.max(0, Math.min(exercises.length - 1, to));
    if (from < 0 || from === slot) {
      // Nothing changes order, so no re-render lets go of the offsets: do it here.
      dragFrom.set(-1);
      dragDy.set(0);
      return;
    }
    onReorder(exerciseId, slot);
  };

  return (
    <View style={styles.card} testID={testID}>
      {exercises.map((exercise, index) => (
        <LiftRow
          key={exercise.id}
          exercise={exercise}
          index={index}
          count={exercises.length}
          heights={heights}
          dragFrom={dragFrom}
          dragDy={dragDy}
          onChip={() => onChip(exercise)}
          onRemove={() => onRemove(exercise)}
          onMove={(delta) => onMove(exercise, delta)}
          onCommit={commit}
          testID={`${testID}-lift-${index}`}
        />
      ))}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add lift"
        testID={`${testID}-add`}
        style={({ pressed }) => [
          styles.row,
          exercises.length > 0 && styles.rule,
          emphasiseAdd && styles.addEmphasis,
          pressed && styles.pressed,
        ]}>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[plansType.row, styles.addText, emphasiseAdd && styles.addEmphasisText]}>
          Add lift
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[plansType.row, styles.addText, emphasiseAdd && styles.addEmphasisText]}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

function LiftRow({
  exercise,
  index,
  count,
  heights,
  dragFrom,
  dragDy,
  onChip,
  onRemove,
  onMove,
  onCommit,
  testID,
}: {
  exercise: ExercisePrescription;
  index: number;
  count: number;
  heights: SharedValue<number[]>;
  dragFrom: SharedValue<number>;
  dragDy: SharedValue<number>;
  onChip: () => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onCommit: (exerciseId: string, to: number) => void;
  testID: string;
}) {
  const chip = chipPrescription(exercise);
  const { scrollGesture, scrollY } = useSheetChrome();
  const reduceMotion = useReducedMotion();
  /** The row's sideways offset while swiped (left only). */
  const swipeX = useSharedValue(0);
  /** This row's place in the card, as the gestures see it (a drop can re-order the card mid-gesture). */
  const at = useSharedValue(index);
  /** The touch that began this swipe may move the row (false while the card is settling). */
  const armed = useSharedValue(false);
  /** The list's scroll offset when the finger went down. */
  const touchScroll = useSharedValue(0);
  /** A swipe has taken this touch (the pick-up then stays down). */
  const swiping = useSharedValue(false);
  /** Where the finger went down, for the pick-up's stillness check. */
  const pressX = useSharedValue(0);
  const pressY = useSharedValue(0);
  /** Swiped away: the row is on its way out and takes no more touches. */
  const gone = useSharedValue(false);
  /** Where the other rows slide to make room for the lifted one. */
  const shiftY = useSharedValue(0);

  useLayoutEffect(() => {
    at.set(index);
  }, [at, index]);

  const id = exercise.id;

  // Swipe left past the Remove width to remove the lift (the caller offers Undo).
  const swipe = Gesture.Pan()
    .activeOffsetX([-geo.swipeSlop, geo.swipeSlop])
    .failOffsetY([-geo.swipeSlop, geo.swipeSlop])
    // The sheet's scroll view takes any touch that moves; a sideways one is still the row's.
    .simultaneousWithExternalGesture(scrollGesture)
    .onBegin(() => {
      armed.set(dragFrom.get() < 0 && !gone.get());
      touchScroll.set(scrollY.get());
    })
    .onStart(() => {
      // A list still gliding when the finger landed: that touch only stops it (as on iOS), so
      // the swipe can't land on a row that slid under the finger.
      if (dragFrom.get() >= 0 || Math.abs(scrollY.get() - touchScroll.get()) > geo.swipeSlop) armed.set(false);
      swiping.set(armed.get());
    })
    .onUpdate((event) => {
      if (armed.get()) swipeX.set(Math.min(0, event.translationX));
    })
    .onEnd((event) => {
      if (!armed.get()) return;
      const x = swipeX.get();
      // Past the Remove width, or a flick that's already halfway there and heading on.
      const projected = x + event.velocityX * geo.swipeProjection;
      if (-x > geo.removeWidth || (-x > geo.removeWidth / 2 && -projected > geo.removeWidth)) {
        gone.set(true);
        swipeX.set(
          withTiming(-geo.removeWidth * geo.swipeAway, SHIFT, (finished) => {
            if (finished) scheduleOnRN(onRemove);
          }),
        );
        return;
      }
      swipeX.set(withSpring(0, SPRING.fling));
    })
    .onFinalize(() => {
      armed.set(false);
      swiping.set(false);
    });

  // A long press picks the row up: held still for `dragLongPress`. Moving sooner is a swipe or a
  // scroll, so the pick-up steps aside (checked here: the pan's own long-press timer doesn't see
  // movement before it activates). Not while another drop is still settling.
  const drag = Gesture.Pan()
    .activateAfterLongPress(geo.dragLongPress)
    .onTouchesDown((event) => {
      pressX.set(event.allTouches[0]?.absoluteX ?? 0);
      pressY.set(event.allTouches[0]?.absoluteY ?? 0);
    })
    .onTouchesMove((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch || dragFrom.get() === at.get()) return;
      const moved = Math.max(Math.abs(touch.absoluteX - pressX.get()), Math.abs(touch.absoluteY - pressY.get()));
      if (moved > geo.swipeSlop || swiping.get()) manager.fail();
    })
    .onStart(() => {
      if (dragFrom.get() >= 0 || gone.get() || swiping.get() || swipeX.get() !== 0) return;
      dragFrom.set(at.get());
      dragDy.set(0);
    })
    .onUpdate((event) => {
      if (dragFrom.get() === at.get()) dragDy.set(event.translationY);
    })
    .onEnd(() => {
      const from = at.get();
      if (dragFrom.get() !== from) return;
      const list = heights.get();
      const to = landingIndex(from, dragDy.get(), list);
      const offset = slotOffset(from, to, list);
      if (reduceMotion) {
        dragDy.set(offset);
        scheduleOnRN(onCommit, id, to);
        return;
      }
      dragDy.set(
        withTiming(offset, SHIFT, (finished) => {
          if (finished) {
            scheduleOnRN(onCommit, id, to);
          } else if (dragFrom.get() === from) {
            // Interrupted (the day changed under it): put everything back.
            dragFrom.set(-1);
            dragDy.set(0);
          }
        }),
      );
    });

  // Both listen; each steps aside for the other (a pick-up never interrupts a swipe that has
  // started, even if a re-render reaches the handlers mid-touch).
  const rowGesture = Gesture.Simultaneous(swipe, drag);

  // The other rows slide out of the lifted one's way once per slot change (not every frame), so
  // they settle with it instead of trailing behind.
  useAnimatedReaction(
    () => {
      const from = dragFrom.get();
      if (from < 0 || from === index) return 0;
      const list = heights.get();
      const to = landingIndex(from, dragDy.get(), list);
      const size = list[from] ?? 0;
      return index > from && index <= to ? -size : index < from && index >= to ? size : 0;
    },
    (target, previous) => {
      if (target === previous) return;
      // A reset (the new order is in) lands at once; a slot change glides.
      shiftY.set(dragFrom.get() < 0 || reduceMotion ? target : withTiming(target, SHIFT));
    },
    [index, reduceMotion],
  );

  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.get() }] }));

  const style = useAnimatedStyle(() => {
    const from = dragFrom.get();
    if (from === index) {
      return {
        zIndex: 2,
        transform: [{ translateY: dragDy.get() }, { scale: geo.dragScale }],
        boxShadow: [{ offsetX: 0, offsetY: geo.dragShadowY, blurRadius: geo.dragShadowBlur, color: plansColors.dragShadow }],
      };
    }
    return { zIndex: 0, transform: [{ translateY: from < 0 ? 0 : shiftY.get() }, { scale: 1 }], boxShadow: [] };
  });

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
    { name: 'remove', label: 'Remove' },
  ];

  return (
    <Animated.View
      style={style}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        heights.modify((list) => {
          'worklet';
          list[index] = height;
          list.length = count;
          return list;
        });
      }}>
      <View style={[styles.swipeFrame, index > 0 && styles.rule]}>
        <View style={styles.remove} accessible={false}>
          <Text maxFontSizeMultiplier={fontScaleCap.text} style={[plansType.row, styles.removeText]}>
            Remove
          </Text>
        </View>
        <GestureDetector gesture={rowGesture}>
          <Animated.View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${exercise.name}, ${spokenPrescription(exercise)}`}
            accessibilityActions={[{ name: 'activate' }, ...actions]}
            onAccessibilityAction={(event) => {
              const name = event.nativeEvent.actionName;
              if (name === 'activate') onChip();
              if (name === 'moveUp') onMove(-1);
              if (name === 'moveDown') onMove(1);
              if (name === 'remove') onRemove();
            }}
            testID={testID}
            style={[styles.row, styles.liftRow, swipeStyle]}>
            <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.text} style={[plansType.row, styles.name]}>
              {exercise.name}
            </Text>
            <Pressable
              onPress={onChip}
              accessible={false}
              hitSlop={geo.rowPadY}
              testID={`${testID}-chip`}
              style={({ pressed }) => [styles.num, pressed && styles.pressed]}>
              <Text maxFontSizeMultiplier={1} style={plansType.num}>
                {chip}
              </Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: PRESSED_OPACITY },
  card: {
    backgroundColor: sheetColors.card,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    marginBottom: sheetGeometry.cardGap,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: geo.rowGap,
    paddingTop: geo.rowPadY,
    paddingBottom: geo.rowPadY,
    paddingLeft: geo.rowPadLeft,
    paddingRight: geo.rowPadRight,
  },
  // Opaque, so the Remove action shows only where the row has moved away.
  liftRow: { backgroundColor: sheetColors.card },
  rule: { borderTopWidth: 1, borderTopColor: sheetColors.rule },
  name: { flex: 1, minWidth: 0 },
  num: {
    backgroundColor: lcd.lcd,
    borderRadius: geo.numRadius,
    borderCurve: 'continuous',
    paddingHorizontal: geo.numPadX,
    paddingVertical: geo.numPadY,
    boxShadow: `inset 0 ${geo.numShadowY}px ${geo.numShadowBlur}px ${plansColors.numShade}`,
    flexShrink: 0,
  },
  addText: { color: signal.orange },
  addEmphasis: { backgroundColor: signal.orange },
  addEmphasisText: { color: sheetColors.onOrange },
  swipeFrame: { overflow: 'hidden' },
  // Behind the row, at its right end: shows as the row moves left.
  remove: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    paddingRight: geo.rowPadRight * 2,
    backgroundColor: signal.orange,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  removeText: { color: sheetColors.onOrange },
});
