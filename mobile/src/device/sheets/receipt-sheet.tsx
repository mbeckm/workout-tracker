import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Pressable, Share, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { showToast } from '@/components/toast';
import { fontScaleCap, gadgetType, receiptColors, receiptGeometry as g, sheetGeometry, space } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { useHaptics, useSounds } from '@/device/haptics';
import { useLogSession } from '@/device/log';
import { Paper, ReceiptRows } from '@/device/receipt/paper';
import { freshReceiptTitle, receiptModel } from '@/device/receipt-model';
import type { LoggedWorkout } from '@/domain/types';
import { DEVICE, LINEAR_FN } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

import { PillButton, SheetCard, SheetHeader, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/** The workout a receipt shows: by id, `latest` (development links), or the one just finished. */
export function useReceiptWorkout(workoutId: string | undefined): LoggedWorkout | null {
  const { workoutHistory, lastCompletedWorkout } = useWorkoutStore();
  if (!workoutId) return null;
  if (workoutId === 'latest') return workoutHistory[0] ?? null;
  return (
    workoutHistory.find((item) => item.id === workoutId) ??
    (lastCompletedWorkout?.id === workoutId ? lastCompletedWorkout : null)
  );
}

/**
 * The receipt (SPEC §6 Receipt, screens 13 and 03; PLAN D7, D20, D22). The paper feeds out of
 * the slot in 18 steps over 1.8 s with the print haptic and sound on the same steps; a tap on the
 * paper completes it, and Done is live from the first frame. Fresh after a workout (`fresh=1`):
 * the header states the week and Done closes (the moments queue runs when it's gone). From the
 * History wall (`from=history`): the day's name with ‹ back to the wall. Reduce Motion: the paper
 * fades in where it ends; the haptic and the sound stay. Under a fresh receipt, one card per lift
 * swapped today asks whether the plan keeps it (Keep in plan / Just today), and so does one more
 * for a new order dragged in Today (D92); leaving them unanswered keeps the plan as it was.
 */
export function ReceiptSheet({ params }: { params: SheetParams }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const { workoutHistory, units, userName, goals, milestoneFor, claimMilestone, activePlan, plans } = useWorkoutStore();
  const workout = useReceiptWorkout(params.workoutId);
  const fresh = params.fresh === '1';
  const { planSwaps, answerSwap, answerOrder } = useLogSession();
  const swaps = fresh && workout && planSwaps?.workoutId === workout.id ? planSwaps : null;
  const orderNames = useMemo(() => {
    const day = swaps?.order
      ? plans.find((item) => item.id === swaps.planId)?.days.find((item) => item.id === swaps.dayId)
      : undefined;
    const names = (swaps?.order ?? []).flatMap((slotId) => day?.exercises.find((item) => item.id === slotId)?.name ?? []);
    return names.length > 1 ? names.join(', ') : null;
  }, [plans, swaps]);
  const fromHistory = params.from === 'history';

  const milestone = workout ? milestoneFor(workout) : null;
  const workoutId = workout?.id;
  // Printed once ever (D7): the fresh receipt that shows it claims it.
  useEffect(() => {
    if (fresh && milestone && workoutId) {
      claimMilestone(milestone, workoutId);
    }
  }, [claimMilestone, fresh, milestone, workoutId]);

  const receipt = useMemo(
    () =>
      workout
        ? receiptModel({ workout, history: workoutHistory, units, userName, milestone, goals })
        : null,
    [goals, milestone, units, userName, workout, workoutHistory],
  );

  const title =
    (workout && fresh ? freshReceiptTitle(workout, workoutHistory, activePlan) : null) ?? workout?.title ?? 'Receipt';
  const back = () =>
    swapSheet('history', { back: '1', ...(params.wallFrom ? { from: params.wallFrom } : {}) });

  const share = () => {
    if (receipt) {
      void Share.share({ message: receipt.text }).catch(() => undefined);
    }
  };

  return (
    <SheetScroll
      header={
        <SheetHeader
          title={title}
          left={fromHistory ? { kind: 'back', onPress: back } : undefined}
          right={fromHistory || fresh ? undefined : { kind: 'close', onPress: close }}
        />
      }>
      <View style={styles.slot} />
      {receipt ? (
        <FeedingPaper accessibilityLabel={receipt.accessibilityLabel}>
          <ReceiptRows rows={receipt.rows} />
        </FeedingPaper>
      ) : (
        <View style={styles.clip} />
      )}
      {swaps?.swaps.map((swap) => (
        <SheetCard key={swap.slotId} style={styles.swap}>
          <View style={styles.swapBody}>
            <Text maxFontSizeMultiplier={fontScaleCap.text} style={gadgetType.rowTitle}>
              {`${swap.to.name} in ${swaps.dayTitle}?`}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.swapSub]}>
              {`Instead of ${swap.from.name}`}
            </Text>
            <View style={styles.swapActions}>
              <PillButton
                title="Keep in plan"
                onPress={() => {
                  answerSwap(swap.slotId, true);
                  showToast({ title: `${swaps.dayTitle} updated` });
                }}
                style={styles.swapPill}
              />
              <PillButton
                title="Just today"
                variant="dark"
                onPress={() => answerSwap(swap.slotId, false)}
                style={styles.swapPill}
              />
            </View>
          </View>
        </SheetCard>
      ))}
      {swaps && orderNames ? (
        <SheetCard style={styles.swap}>
          <View style={styles.swapBody}>
            <Text maxFontSizeMultiplier={fontScaleCap.text} style={gadgetType.rowTitle}>
              {`This order in ${swaps.dayTitle}?`}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.swapSub]}>
              {orderNames}
            </Text>
            <View style={styles.swapActions}>
              <PillButton
                title="Keep in plan"
                onPress={() => {
                  answerOrder(true);
                  showToast({ title: `${swaps.dayTitle} updated` });
                }}
                style={styles.swapPill}
              />
              <PillButton
                title="Just today"
                variant="dark"
                onPress={() => answerOrder(false)}
                style={styles.swapPill}
              />
            </View>
          </View>
        </SheetCard>
      ) : null}
      <View style={styles.actions}>
        {receipt ? (
          <PillButton title="Share" variant="dark" onPress={share} style={styles.share} testID="receipt-share" />
        ) : null}
        {fresh ? (
          <PillButton title="Done" onPress={close} style={styles.done} testID="receipt-done" />
        ) : null}
      </View>
    </SheetScroll>
  );
}

/**
 * The paper under the slot, fed out in `FEED_STEPS` steps (CSS `steps(18)`). Jump-start, so each
 * step lands with its haptic tick (ticks at 0, 100 … 1700 ms). A tap completes the feed (D22).
 */
function FeedingPaper({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel: string }) {
  const reduceMotion = useReducedMotion();
  const haptics = useHaptics();
  const playSound = useSounds();
  const progress = useSharedValue(0);
  const height = useSharedValue(0);
  const started = useRef(false);

  // Ticks and chatter start with the feed, once the paper has a height.
  const start = () => {
    if (started.current) return;
    started.current = true;
    haptics.receiptPrint();
    playSound('print');
    progress.set(
      reduceMotion
        ? withTiming(1, { duration: DEVICE.REDUCED_FADE, reduceMotion: ReduceMotion.Never })
        : withTiming(1, { duration: DEVICE.FEED, easing: LINEAR_FN, reduceMotion: ReduceMotion.Never }),
    );
  };

  const onLayout = (event: LayoutChangeEvent) => {
    height.set(event.nativeEvent.layout.height);
    start();
  };

  const complete = () => {
    cancelAnimation(progress);
    progress.set(1);
  };

  const paperStyle = useAnimatedStyle(() => {
    const h = height.get();
    if (h === 0) return { opacity: 0 };
    if (reduceMotion) return { opacity: progress.get(), transform: [{ translateY: 0 }] };
    const step = Math.ceil(progress.get() * DEVICE.FEED_STEPS) / DEVICE.FEED_STEPS;
    return { opacity: 1, transform: [{ translateY: -(1 - step) * h }] };
  });

  return (
    <Pressable
      onPress={complete}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={styles.clip}>
      <Animated.View style={paperStyle} onLayout={onLayout}>
        <Paper kind="receipt" style={styles.paper} contentStyle={styles.paperContent}>
          {children}
        </Paper>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: g.slotHeight,
    marginHorizontal: g.slotInset,
    borderRadius: g.slotRadius,
    backgroundColor: receiptColors.slot,
    boxShadow: `0 1px 0 ${receiptColors.slotLip}`,
    zIndex: 2,
  },
  clip: {
    marginTop: -g.clipOverlap,
    paddingBottom: g.clipBottom,
    overflow: 'hidden',
  },
  paper: { marginTop: g.paperTop, marginHorizontal: g.paperInset },
  paperContent: { paddingTop: g.padTop, paddingHorizontal: g.padX, paddingBottom: g.padBottom },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: g.actionGap },
  share: { width: g.shareWidth, marginTop: 0 },
  done: { width: g.doneWidth, marginTop: 0 },
  swap: { marginHorizontal: g.paperInset },
  swapBody: { paddingHorizontal: sheetGeometry.itemPadX, paddingVertical: sheetGeometry.itemPadY },
  swapSub: { marginTop: space.pair },
  swapActions: { flexDirection: 'row', gap: g.actionGap, marginTop: space.inset },
  swapPill: { flex: 1, width: 'auto', marginTop: 0 },
});
