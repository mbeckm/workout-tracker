import { useEffect, useMemo, useRef } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import type Animated from 'react-native-reanimated';

import { showToast } from '@/components/toast';
import { fontScaleCap, gadgetType, receiptGeometry as g, sheetGeometry, space } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { useLogSession } from '@/device/log';
import { FinishStatsView, Rise } from '@/device/receipt/finish-stats';
import { PrintingStub } from '@/device/receipt/stub';
import { finishStats, freshReceiptTitle, receiptStub } from '@/device/receipt-model';
import type { LoggedWorkout } from '@/domain/types';
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
 * The finish screen (decision 90, F3a; trim-ui → Receipt). The stats lead: three numbers and a
 * line per lift against last time, in the sheet's own cards. Only a moment prints: on a record
 * (every one), a goal reached or a milestone the receipt rises out of the slot at the bottom,
 * after the stats, and the stamp slams on. Fresh after a workout (`fresh=1`): the header states
 * the week, the cards rise in and count up, and Done closes (the moments queue runs when it's
 * gone). From History (`from=history`): the day's name with ‹ back, everything already in place.
 * Done and ‹ are live from the first frame; a tap on the paper completes it. Under a fresh
 * screen, one card per lift swapped today asks whether the plan keeps it (Keep in plan / Just
 * today), and so does one more for a new order dragged in Today (D92); leaving them unanswered
 * keeps the plan as it was.
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
  const scrollRef = useRef<Animated.ScrollView>(null);

  const milestone = workout ? milestoneFor(workout) : null;
  const workoutId = workout?.id;
  // Printed once ever (D7): the fresh receipt that shows it claims it.
  useEffect(() => {
    if (fresh && milestone && workoutId) {
      claimMilestone(milestone, workoutId);
    }
  }, [claimMilestone, fresh, milestone, workoutId]);

  // Both read only the workouts before this one, so the store adding it to history changes nothing.
  const stats = useMemo(
    () => (workout ? finishStats({ workout, history: workoutHistory, units }) : null),
    [units, workout, workoutHistory],
  );
  const stub = useMemo(
    () => (workout ? receiptStub({ workout, history: workoutHistory, units, userName, milestone, goals }) : null),
    [goals, milestone, units, userName, workout, workoutHistory],
  );

  const title =
    (workout && fresh ? freshReceiptTitle(workout, workoutHistory, activePlan) : null) ?? workout?.title ?? 'Receipt';
  const back = () =>
    swapSheet('history', { back: '1', ...(params.wallFrom ? { from: params.wallFrom } : {}) });

  const share = () => {
    if (stub) {
      void Share.share({ message: stub.text }).catch(() => undefined);
    }
  };

  return (
    <SheetScroll
      scrollRef={scrollRef}
      header={
        <SheetHeader
          title={title}
          left={fromHistory ? { kind: 'back', onPress: back } : undefined}
          right={fromHistory || fresh ? undefined : { kind: 'close', onPress: close }}
        />
      }>
      <View style={styles.body}>
        {stats ? <FinishStatsView stats={stats} play={fresh} /> : null}
        {swaps?.swaps.map((swap) => (
          <SheetCard key={swap.slotId}>
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
          <SheetCard>
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
      </View>
      {stub ? (
        <PrintingStub
          stub={stub}
          animate={fresh}
          onPrintStart={() => scrollRef.current?.scrollToEnd({ animated: true })}
        />
      ) : null}
      <Rise index={0} play={fresh}>
        <View style={styles.actions}>
          {stub ? (
            <PillButton title="Share" variant="dark" onPress={share} style={styles.share} testID="receipt-share" />
          ) : null}
          {fresh ? <PillButton title="Done" onPress={close} style={styles.done} testID="receipt-done" /> : null}
        </View>
      </Rise>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  body: { gap: sheetGeometry.cardGap },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: g.actionGap, marginTop: space.gutter },
  share: { width: g.shareWidth, marginTop: 0 },
  done: { width: g.doneWidth, marginTop: 0 },
  swapBody: { paddingHorizontal: sheetGeometry.itemPadX, paddingVertical: sheetGeometry.itemPadY },
  swapSub: { marginTop: space.pair },
  swapActions: { flexDirection: 'row', gap: g.actionGap, marginTop: space.inset },
  swapPill: { flex: 1, width: 'auto', marginTop: 0 },
});
