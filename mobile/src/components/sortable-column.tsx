import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DURATION, EASE_IN_OUT, EASE_OUT, SPRING } from '@/motion';

/** Row height used until a row has measured itself (a day row is about this tall). */
const ESTIMATED_ROW = 76;
const LIFT_SCALE = 1.02;

type Column = {
  order: SharedValue<string[]>;
  heights: SharedValue<Record<string, number>>;
  active: SharedValue<string>;
  target: SharedValue<number>;
  dragY: SharedValue<number>;
  lift: SharedValue<number>;
  measured: SharedValue<boolean>;
  reduceMotion: boolean;
  activeKey: string | null;
  handleFor: (key: string) => ReturnType<typeof Gesture.Pan>;
};

const ColumnContext = createContext<Column | null>(null);

function heightOf(heights: Record<string, number>, key: string) {
  'worklet';
  return heights[key] ?? ESTIMATED_ROW;
}

function topOf(order: string[], heights: Record<string, number>, key: string) {
  'worklet';
  let top = 0;
  for (const item of order) {
    if (item === key) {
      return top;
    }
    top += heightOf(heights, item);
  }
  return top;
}

function moved(order: string[], from: number, to: number) {
  'worklet';
  const next = order.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The order the rows show right now: the dragged row sits in the slot it hovers. */
function projected(column: Pick<Column, 'order' | 'active' | 'target'>) {
  'worklet';
  const order = column.order.get();
  const active = column.active.get();
  if (active === '') {
    return order;
  }
  return moved(order, order.indexOf(active), column.target.get());
}

/**
 * A short vertical list whose rows reorder by dragging a handle (trim-ui §8, Row reorder).
 *
 * Rows are stacked absolutely from one shared order, so a drag, a drop and the store update
 * that follows never re-lay anything out: the row that's dropped is already where the new
 * order puts it. The handle's pan wins over the page's scroll natively (it activates on the
 * first movement, before the scroll view's slop), so the page stays put while a row moves.
 * No autoscroll: the lists this serves fit on a screen.
 *
 * Rows that join, leave or move glide to their slot (`enter`, ease-in-out); nothing moves
 * on first appearance. Reduced motion: rows snap and the lift keeps only its surface.
 */
export function SortableColumn({
  keys,
  renderRow,
  onMove,
  onSlotChange,
  onDragChange,
}: {
  keys: string[];
  renderRow: (key: string, index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  /** The dragged row crossed into a new slot (a selection haptic). */
  onSlotChange?: () => void;
  /** A row lifted or landed: the page can hold its scroll meanwhile. */
  onDragChange?: (dragging: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const order = useSharedValue(keys);
  const heights = useSharedValue<Record<string, number>>({});
  const active = useSharedValue('');
  const target = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const measured = useSharedValue(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Gestures stay the same objects for a whole drag; they reach the latest callbacks here.
  const callbacks = useRef({ onMove, onSlotChange, onDragChange });
  useLayoutEffect(() => {
    callbacks.current = { onMove, onSlotChange, onDragChange };
  });
  const move = useCallback((from: number, to: number) => callbacks.current.onMove(from, to), []);
  const slotTick = useCallback(() => callbacks.current.onSlotChange?.(), []);
  const lifted = useCallback((key: string | null) => {
    setActiveKey(key);
    callbacks.current.onDragChange?.(key != null);
  }, []);

  // The store is the truth between drags. After a drop it already matches.
  const keysSignature = keys.join('|');
  useLayoutEffect(() => {
    order.set(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature, order]);

  const handleFor = useMemo(() => {
    const liftTiming = { duration: DURATION.press, easing: EASE_OUT };

    return (key: string) =>
      Gesture.Pan()
        // The lift answers the touch; the drag starts on the first movement.
        .minDistance(0)
        .onBegin(() => {
          if (active.get() !== '') {
            return;
          }
          const current = order.get();
          active.set(key);
          target.set(current.indexOf(key));
          dragY.set(0);
          lift.set(withTiming(1, liftTiming));
          scheduleOnRN(lifted, key);
        })
        .onUpdate((event) => {
          if (active.get() !== key) {
            return;
          }
          dragY.set(event.translationY);
          const current = order.get();
          const sizes = heights.get();
          const center = topOf(current, sizes, key) + event.translationY + heightOf(sizes, key) / 2;
          // Slot = how many other rows' centres lie above the dragged row's centre.
          let slot = 0;
          for (const item of current) {
            if (item !== key && topOf(current, sizes, item) + heightOf(sizes, item) / 2 < center) {
              slot += 1;
            }
          }
          if (slot !== target.get()) {
            target.set(slot);
            scheduleOnRN(slotTick);
          }
        })
        .onFinalize((event) => {
          if (active.get() !== key) {
            return;
          }
          const current = order.get();
          const sizes = heights.get();
          const from = current.indexOf(key);
          const to = target.get();
          const next = moved(current, from, to);
          const settleY = topOf(next, sizes, key) - topOf(current, sizes, key);
          lift.set(withTiming(0, liftTiming));
          const land = () => {
            'worklet';
            // Same frame: the order takes the drop, so the row is already in its slot.
            order.set(next);
            active.set('');
            dragY.set(0);
            scheduleOnRN(lifted, null);
            if (from !== to) {
              scheduleOnRN(move, from, to);
            }
          };
          if (reduceMotion) {
            land();
            return;
          }
          dragY.set(
            // Lands even if cut short, so a row can never stay lifted.
            withSpring(settleY, { ...SPRING.fling, velocity: event.velocityY }, () => {
              land();
            }),
          );
        });
  }, [active, dragY, heights, lift, lifted, move, order, reduceMotion, slotTick, target]);

  const column = useMemo<Column>(
    () => ({ order, heights, active, target, dragY, lift, measured, reduceMotion, activeKey, handleFor }),
    [active, activeKey, dragY, handleFor, heights, lift, measured, order, reduceMotion, target],
  );

  const containerStyle = useAnimatedStyle(() => {
    const sizes = heights.get();
    let total = 0;
    for (const item of order.get()) {
      total += heightOf(sizes, item);
    }
    return {
      height: measured.get() && !reduceMotion ? withTiming(total, { duration: DURATION.enter, easing: EASE_IN_OUT }) : total,
    };
  });

  return (
    <ColumnContext.Provider value={column}>
      <Animated.View style={containerStyle}>
        {keys.map((key, index) => (
          <Cell key={key} rowKey={key}>
            {renderRow(key, index)}
          </Cell>
        ))}
      </Animated.View>
    </ColumnContext.Provider>
  );
}

function Cell({ rowKey, children }: { rowKey: string; children: ReactNode }) {
  const column = useColumn();
  const { heights, measured, dragY, lift, active, reduceMotion } = column;

  const style = useAnimatedStyle(() => {
    const sizes = heights.get();
    if (active.get() === rowKey) {
      const top = topOf(column.order.get(), sizes, rowKey);
      return {
        zIndex: 1,
        transform: [
          { translateY: top + dragY.get() },
          { scale: reduceMotion ? 1 : 1 + (LIFT_SCALE - 1) * lift.get() },
        ],
      };
    }
    const top = topOf(projected(column), sizes, rowKey);
    const glide = measured.get() && !reduceMotion;
    return {
      zIndex: 0,
      transform: [
        { translateY: glide ? withTiming(top, { duration: DURATION.enter, easing: EASE_IN_OUT }) : top },
        { scale: 1 },
      ],
    };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    const key = rowKey;
    heights.modify((value) => {
      'worklet';
      value[key] = height;
      return value;
    });
    // Glide only once the first layout has landed: nothing moves on first appearance.
    if (!measured.get()) {
      requestAnimationFrame(() => measured.set(true));
    }
  };

  return (
    <Animated.View onLayout={onLayout} style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]}>
      {children}
    </Animated.View>
  );
}

function useColumn() {
  const column = useContext(ColumnContext);
  if (!column) {
    throw new Error('Sortable rows render inside <SortableColumn>.');
  }
  return column;
}

/** Wraps a row's drag handle: dragging it moves the row. */
export function SortableHandle({ rowKey, children }: { rowKey: string; children: ReactNode }) {
  const { handleFor } = useColumn();
  const gesture = useMemo(() => handleFor(rowKey), [handleFor, rowKey]);
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

/** Whether this row is the one being dragged (it wears the lifted surface). */
export function useSortableLifted(rowKey: string) {
  return useColumn().activeKey === rowKey;
}
