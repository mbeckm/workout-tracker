import type { FlashListRef } from '@shopify/flash-list';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native';

import { confirmAction } from '@/components/confirm-action';
import { fontScaleCap, gadgetType, receiptColors, receiptGeometry as g, sheetGeometry, signal } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { DashedRule, Paper, SlipPaper } from '@/device/receipt/paper';
import { historyWall, type MiniReceipt, type WallItem } from '@/device/receipt-model';
import { useWorkoutStore } from '@/store/workout-store';

import { SheetHeader } from './primitives';
import { useSheetChrome } from './sheet-context';
import { SheetList } from './sheet-list';

/** Where the wall was scrolled when a receipt opened from it, so ‹ comes back to the same place. */
let wallOffset = 0;

/**
 * The History wall (SPEC §6 History wall, HR1, screen 02; D9). Training weeks newest first, each
 * a Doto header with that week's lamps (done of planned) over a 3-column grid of tilted mini
 * receipts. Tap prints the full receipt; long-press asks, then deletes (`deleteWorkout`).
 * Virtualized (FlashList: a week header or one row of three per item), so years of workouts
 * scroll smoothly. Workouts from deleted plans keep their own title.
 */
export function HistorySheet({ params }: { params: SheetParams }) {
  const { close } = useSheetChrome();
  const { swapSheet } = useDevice();
  const { workoutHistory, activePlan, units, deleteWorkout } = useWorkoutStore();
  const listRef = useRef<FlashListRef<WallItem>>(null);
  const restore = params.back === '1';
  const { width } = useWindowDimensions();
  // Three columns in the sheet's padding and the grid's inset, 10 apart (`.rgrid`).
  const miniWidth =
    (width - 2 * sheetGeometry.sidePad - 2 * g.miniGridInset - (g.miniColumns - 1) * g.miniGap) / g.miniColumns;

  const items = useMemo(
    () => historyWall({ history: workoutHistory, plan: activePlan, units, columns: g.miniColumns }),
    [activePlan, units, workoutHistory],
  );

  const openReceipt = useCallback(
    (mini: MiniReceipt) =>
      swapSheet('receipt', {
        workoutId: mini.workoutId,
        from: 'history',
        ...(params.from ? { wallFrom: params.from } : {}),
      }),
    [params.from, swapSheet],
  );

  const askDelete = useCallback(
    (mini: MiniReceipt) =>
      confirmAction(
        { title: mini.deletePrompt, confirmLabel: 'Delete', cancelLabel: 'Cancel', destructive: true, presentation: 'sheet' },
        () => deleteWorkout(mini.workoutId),
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
        ) : (
          <View style={[styles.row, !item.lastInWeek && styles.rowGap]}>
            {Array.from({ length: g.miniColumns }, (_, column) => {
              const mini = item.minis[column];
              return mini ? (
                <MiniReceiptCard
                  key={mini.workoutId}
                  mini={mini}
                  width={miniWidth}
                  tilt={g.miniTilts[(item.firstIndex + column) % g.miniTilts.length]}
                  onPress={openReceipt}
                  onDelete={askDelete}
                />
              ) : (
                <View key={column} style={styles.cell} />
              );
            })}
          </View>
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

/**
 * A mini receipt (`.mini`): day, date, a dashed rule, sets, volume and the PR (or minutes), Plex
 * Mono 9/13 on a torn slip, tilted by its place in the week. Pressed it settles to .96.
 * Thumbnails keep their size; VoiceOver reads the whole slip.
 */
function MiniReceiptCard({
  mini,
  width,
  tilt,
  onPress,
  onDelete,
}: {
  mini: MiniReceipt;
  width: number;
  tilt: number;
  onPress: (mini: MiniReceipt) => void;
  onDelete: (mini: MiniReceipt) => void;
}) {
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'delete') onDelete(mini);
    else onPress(mini);
  };
  return (
    <Pressable
      onPress={() => onPress(mini)}
      onLongPress={() => onDelete(mini)}
      accessibilityRole="button"
      accessibilityLabel={mini.accessibilityLabel}
      accessibilityActions={DELETE_ACTIONS}
      onAccessibilityAction={onAction}
      testID={`mini-${mini.workoutId}`}
      style={({ pressed }) => [
        styles.cell,
        { transform: [{ rotate: `${tilt}deg` }, { scale: pressed ? g.miniPressScale : 1 }] },
      ]}>
      <SlipPaper width={width} contentStyle={styles.miniContent}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptMiniTitle}>
          {mini.title}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptMini}>
          {mini.date}
        </Text>
        <DashedRule gap={g.miniRuleGap} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptMini}>
          {mini.sets}
        </Text>
        {mini.volume ? (
          <Text numberOfLines={1} maxFontSizeMultiplier={1} style={gadgetType.receiptMini}>
            {mini.volume}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1}
          style={mini.last.pr ? gadgetType.receiptMiniPr : gadgetType.receiptMini}>
          {mini.last.text}
        </Text>
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
  row: {
    flexDirection: 'row',
    gap: g.miniGap,
    marginHorizontal: g.miniGridInset,
  },
  rowGap: { paddingBottom: g.miniGap },
  cell: { flex: 1, minWidth: 0 },
  // The teeth take the last 6 of the prototype's 16 bottom padding.
  miniContent: { paddingTop: g.miniPadTop, paddingHorizontal: g.miniPadX, paddingBottom: g.miniPadBottom - g.miniToothDepth },
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
