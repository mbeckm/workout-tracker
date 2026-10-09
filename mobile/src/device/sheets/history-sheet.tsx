import type { FlashListRef } from '@shopify/flash-list';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native';

import { confirmAction } from '@/components/confirm-action';
import {
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  receiptColors,
  receiptGeometry as g,
  sheetColors,
  sheetGeometry,
  signal,
  space,
} from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { Paper, SlipPaper } from '@/device/receipt/paper';
import { dotoSet, historyLog, type HistoryItem, type LogRow, type LogSlip } from '@/device/receipt-model';
import { useWorkoutStore } from '@/store/workout-store';

import { SheetHeader } from './primitives';
import { useSheetChrome } from './sheet-context';
import { SheetList } from './sheet-list';

/** Where History was scrolled when a workout opened from it, so ‹ comes back to the same place. */
let wallOffset = 0;

type Entry = LogRow | LogSlip;

/**
 * History (decision 90, H2; D9). Training weeks newest first, each a Doto header with that
 * week's lamps, then its workouts: clean rows in one card, and a workout that printed (a record,
 * a goal, a milestone) as its paper slip in the list where it happened. Tap opens the workout's
 * finish screen with ‹ back to History; long-press asks, then deletes (`deleteWorkout`).
 * Virtualized (FlashList: a week header, a row or a slip per item), so years of workouts scroll
 * smoothly. Workouts from deleted plans keep their own title.
 */
export function HistorySheet({ params }: { params: SheetParams }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const { workoutHistory, activePlan, units, goals, milestoneFor, deleteWorkout } = useWorkoutStore();
  const listRef = useRef<FlashListRef<HistoryItem>>(null);
  const restore = params.back === '1';
  const { width } = useWindowDimensions();
  const slipWidth = width - 2 * sheetGeometry.sidePad - 2 * g.slipInsetX;

  const items = useMemo(
    () => historyLog({ history: workoutHistory, plan: activePlan, units, goals, milestoneFor }),
    [activePlan, goals, milestoneFor, units, workoutHistory],
  );

  const open = useCallback(
    (entry: Entry) =>
      swapSheet('receipt', {
        workoutId: entry.workoutId,
        from: 'history',
        ...(params.from ? { wallFrom: params.from } : {}),
      }),
    [params.from, swapSheet],
  );

  const askDelete = useCallback(
    (entry: Entry) =>
      confirmAction(
        { title: entry.deletePrompt, confirmLabel: 'Delete', cancelLabel: 'Cancel', destructive: true, presentation: 'sheet' },
        () => deleteWorkout(entry.workoutId),
      ),
    [deleteWorkout],
  );

  const header = (
    <SheetHeader
      title="History"
      left={params.from === 'menu' ? { kind: 'back', onPress: () => swapSheet('menu') } : undefined}
      right={{ kind: 'close', onPress: close }}
    />
  );

  return (
    <SheetList
      header={header}
      listRef={listRef}
      data={items}
      keyExtractor={(item) => item.key}
      getItemType={(item) => item.type}
      onScroll={(event) => {
        wallOffset = event.nativeEvent.contentOffset.y;
      }}
      onLoad={() => {
        if (restore && wallOffset > 0) {
          listRef.current?.scrollToOffset({ offset: wallOffset, animated: false });
        }
      }}
      ListEmptyComponent={<EmptyWall />}
      renderItem={({ item }) =>
        item.type === 'week' ? (
          <WeekHeader label={item.label} lamps={item.lamps} accessibilityLabel={item.accessibilityLabel} />
        ) : item.type === 'row' ? (
          <LogRowItem row={item} onPress={open} onDelete={askDelete} />
        ) : (
          <SlipItem slip={item} width={slipWidth} onPress={open} onDelete={askDelete} />
        )
      }
    />
  );
}

/** `WEEK 12` in Doto with the week's lamps: green for done, dark for the rest (`.wkh`, `.wl`). */
function WeekHeader({ label, lamps, accessibilityLabel }: { label: string; lamps: boolean[]; accessibilityLabel: string }) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={accessibilityLabel} style={styles.week}>
      <Text maxFontSizeMultiplier={1} style={gadgetType.sectionLabel}>
        {label}
      </Text>
      <View style={styles.lamps}>
        {lamps.map((done, index) => (
          <View key={index} style={[styles.lamp, done && styles.lampDone]} />
        ))}
      </View>
    </View>
  );
}

const DELETE_ACTIONS = [{ name: 'activate' }, { name: 'delete', label: 'Delete' }];

function useEntryActions(entry: Entry, onPress: (entry: Entry) => void, onDelete: (entry: Entry) => void) {
  return {
    onPress: () => onPress(entry),
    onLongPress: () => onDelete(entry),
    accessibilityRole: 'button' as const,
    accessibilityLabel: entry.accessibilityLabel,
    accessibilityActions: DELETE_ACTIONS,
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'delete') onDelete(entry);
      else onPress(entry);
    },
    testID: `history-${entry.workoutId}`,
  };
}

/**
 * A workout that didn't print: a row of the week's card (`Push 1` over `Thu 9 Oct, 52 min`,
 * the volume on the right). Consecutive rows share one card; a rule separates them.
 */
function LogRowItem({ row, onPress, onDelete }: { row: LogRow; onPress: (entry: Entry) => void; onDelete: (entry: Entry) => void }) {
  const actions = useEntryActions(row, onPress, onDelete);
  return (
    <Pressable
      {...actions}
      style={({ pressed }) => [
        styles.logRow,
        row.first && styles.logFirst,
        row.last && styles.logLast,
        !row.first && styles.logRule,
        pressed && styles.logPressed,
      ]}>
      <View style={styles.logText}>
        <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.text} style={gadgetType.rowTitle}>
          {row.title}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, styles.logSub]}>
          {row.sub}
        </Text>
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowTitle, styles.logTrailing]}>
        {row.trailing}
      </Text>
    </Pressable>
  );
}

/**
 * A workout that printed: its slip, tilted by its place in History. The heading in record ink,
 * the day and its volume under it on the left; what it printed big on the right (each record, the goal's
 * target, the workout count; several records one line each, the lift with its set in the lane). Pressed it settles to .96.
 */
function SlipItem({
  slip,
  width,
  onPress,
  onDelete,
}: {
  slip: LogSlip;
  width: number;
  onPress: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
}) {
  const actions = useEntryActions(slip, onPress, onDelete);
  const tilt = g.slipTilts[slip.index % g.slipTilts.length];
  return (
    <Pressable
      {...actions}
      style={({ pressed }) => [
        styles.slip,
        { transform: [{ rotate: `${tilt}deg` }, { scale: pressed ? g.miniPressScale : 1 }] },
      ]}>
      <SlipPaper width={width} contentStyle={styles.slipContent}>
        <View style={styles.slipLeft}>
          <Text numberOfLines={1} maxFontSizeMultiplier={1} style={[gadgetType.receiptSlip, styles.pr]}>
            {slip.heading}
          </Text>
          <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptSlip}>
            {slip.title}
          </Text>
          {slip.meta.map((line) => (
            <Text key={line} numberOfLines={1} maxFontSizeMultiplier={1} style={[gadgetType.receiptSlip, styles.muted]}>
              {line}
            </Text>
          ))}
        </View>
        {slip.highlights.length === 1 ? (
          <View style={styles.slipRight}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptSlipBig}>
              {dotoSet(slip.highlights[0].value)}
            </Text>
            <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptSlip}>
              {slip.highlights[0].label}
            </Text>
          </View>
        ) : (
          // Several: one line each, the lift with its set in the lane.
          <View style={styles.slipLines}>
            {slip.highlights.map((highlight, index) => (
              <View key={index} style={styles.slipLine}>
                <Text numberOfLines={1} maxFontSizeMultiplier={1} style={[gadgetType.receiptSlip, styles.shrink]}>
                  {highlight.label}
                </Text>
                <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptSlipMid}>
                  {dotoSet(highlight.value)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SlipPaper>
    </Pressable>
  );
}

/** No workouts yet: one blank torn receipt that says so. */
function EmptyWall() {
  return (
    <View style={styles.empty}>
      <Paper kind="receipt" style={styles.emptyPaper} contentStyle={styles.emptyContent}>
        <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.receiptBold, styles.emptyText]}>
          NO WORKOUTS YET
        </Text>
      </Paper>
    </View>
  );
}

const styles = StyleSheet.create({
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: g.weekTop,
    marginHorizontal: g.weekX,
    marginBottom: g.weekBottom,
  },
  lamps: { flexDirection: 'row', gap: g.weekLampGap },
  lamp: {
    width: g.weekLamp,
    height: g.weekLamp,
    borderRadius: g.weekLamp / 2,
    backgroundColor: receiptColors.wallLampOff,
  },
  lampDone: { backgroundColor: signal.done },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.related,
    minHeight: g.logRowHeight,
    paddingHorizontal: sheetGeometry.itemPadX,
    paddingVertical: space.related,
    backgroundColor: sheetColors.card,
  },
  logFirst: { borderTopLeftRadius: gadgetRadius.card, borderTopRightRadius: gadgetRadius.card },
  logLast: { borderBottomLeftRadius: gadgetRadius.card, borderBottomRightRadius: gadgetRadius.card },
  logRule: { borderTopWidth: 1, borderTopColor: sheetColors.rule },
  logPressed: { backgroundColor: sheetColors.cardRaised },
  logText: { flex: 1, minWidth: 0 },
  logSub: { marginTop: space.pair },
  logTrailing: { flexShrink: 0 },
  slip: { marginHorizontal: g.slipInsetX, marginVertical: g.slipGap / 2 },
  slipContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: g.slipColumnGap,
    paddingTop: g.slipPadTop,
    paddingHorizontal: g.slipPadX,
    paddingBottom: g.slipPadBottom - g.miniToothDepth,
  },
  slipLeft: { flex: 1, minWidth: 0 },
  slipRight: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '60%' },
  slipLines: { flex: 1.4, minWidth: 0, gap: space.pair },
  slipLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.related },
  shrink: { flexShrink: 1 },
  pr: { color: receiptColors.pr },
  muted: { color: receiptColors.muted },
  empty: { alignItems: 'center', paddingTop: g.emptyTop },
  emptyPaper: { width: g.emptyWidth, transform: [{ rotate: `${g.miniTilts[1]}deg` }] },
  emptyContent: {
    minHeight: g.emptyHeight,
    justifyContent: 'center',
    paddingHorizontal: g.padX,
    paddingTop: g.padTop,
    paddingBottom: g.padBottom,
  },
  emptyText: { textAlign: 'center' },
});
