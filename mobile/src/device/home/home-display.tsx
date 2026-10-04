import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { device, gadgetRadius, gadgetType, lcd } from '@/constants/theme';
import { useHaptics, useSounds } from '@/device/haptics';
import { expandedRowHeight, type HomeModel, type HomeRow } from '@/device/home-model';
import { DEVICE, EASE_DISPLAY, EASE_STAMP_FN } from '@/motion';

type PlanModel = Extract<HomeModel, { kind: 'plan' }>;

/** Rows resize and move like the display's content change (SPEC §7: 220 ms). */
const ROW_LAYOUT = LinearTransition.duration(DEVICE.DISPLAY).easing(EASE_DISPLAY);
const LINES_IN = FadeIn.duration(DEVICE.DISPLAY);

/**
 * Home on the display (W1, screens 01 and 14): the plan's days as rows, stacked from the top 8
 * apart, scrolling under a fade when they don't fit (small phones, long plans). Tap a row to
 * pick it. With no plans, the empty slot.
 */
export function HomeDisplay({
  model,
  celebrateDayId,
  onPick,
}: {
  model: HomeModel;
  celebrateDayId: string | null;
  onPick: (dayId: string) => void;
}) {
  if (model.kind === 'empty') {
    return <EmptySlot />;
  }
  return <DayRows model={model} celebrateDayId={celebrateDayId} onPick={onPick} />;
}

function DayRows({
  model,
  celebrateDayId,
  onPick,
}: {
  model: PlanModel;
  celebrateDayId: string | null;
  onPick: (dayId: string) => void;
}) {
  const haptics = useHaptics();
  const scrollRef = useRef<ScrollView>(null);
  const rowFrames = useRef(new Map<string, { y: number; height: number }>());
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);

  const selectedDayId = model.rows[model.selectedIndex]?.dayId;

  // Keep the selected row in view (a long plan opens on its next day).
  useEffect(() => {
    const frame = selectedDayId ? rowFrames.current.get(selectedDayId) : undefined;
    if (!frame || viewport === 0) return;
    const bottom = frame.y + frame.height + device.rowInset;
    if (bottom > offset + viewport) {
      scrollRef.current?.scrollTo({ y: bottom - viewport, animated: true });
    } else if (frame.y - device.rowInset < offset) {
      scrollRef.current?.scrollTo({ y: Math.max(0, frame.y - device.rowInset), animated: true });
    }
    // Only when the selection or the space changes, not on every scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayId, viewport, content]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffset(event.nativeEvent.contentOffset.y);
  };
  const overflows = content > viewport + 1;
  const fadeTop = overflows && offset > 1;
  const fadeBottom = overflows && offset + viewport < content - 1;

  return (
    <View style={styles.fill}>
      <View style={styles.fill}>
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={styles.rows}
          showsVerticalScrollIndicator={false}
          scrollEnabled={overflows}
          alwaysBounceVertical={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setContent(height)}>
          {model.rows.map((row) => (
            <DayRow
              key={row.dayId}
              row={row}
              celebrate={row.dayId === celebrateDayId}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                rowFrames.current.set(row.dayId, { y, height });
              }}
              onPress={() => {
                if (row.selected) return;
                haptics.displayTap();
                onPick(row.dayId);
              }}
            />
          ))}
        </ScrollView>
        {fadeTop ? <View pointerEvents="none" style={[styles.fade, styles.fadeTop]} /> : null}
        {fadeBottom ? <View pointerEvents="none" style={[styles.fade, styles.fadeBottom]} /> : null}
      </View>
      {model.week.done ? (
        <View style={styles.footer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text maxFontSizeMultiplier={1} style={gadgetType.lcdSmall}>
            WEEK DONE
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DayRow({
  row,
  celebrate,
  onLayout,
  onPress,
}: {
  row: HomeRow;
  celebrate: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const title = row.title.toUpperCase();
  const expanded = row.selected && !row.done;

  return (
    <Animated.View layout={ROW_LAYOUT} onLayout={onLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.accessibilityLabel}
        accessibilityState={{ selected: row.selected }}
        onPress={onPress}>
        {row.done ? (
          <>
            {row.selected ? <View pointerEvents="none" style={styles.ring} /> : null}
            <DoneRow row={row} title={title} celebrate={celebrate} />
          </>
        ) : expanded ? (
          <View
            style={[
              styles.row,
              styles.selectedRow,
              { height: expandedRowHeight(row.liftCount, device.rowExpandedBase, device.rowExpandedLine) },
            ]}>
            <View style={styles.rowHead}>
              <LcdText style={[gadgetType.lcdRow, styles.shrink]}>{title}</LcdText>
              <LcdText style={gadgetType.lcdRow}>{row.estimate ?? '0 LIFTS'}</LcdText>
            </View>
            {row.lines.length > 0 ? (
              <Animated.View entering={LINES_IN} style={styles.lines}>
                {row.lines.map((line, index) =>
                  line.kind === 'more' ? (
                    <LcdText key="more" style={[gadgetType.lcdList, styles.dim]}>
                      {`+${line.count} MORE`}
                    </LcdText>
                  ) : (
                    <View key={index} style={styles.line}>
                      <LcdText style={[gadgetType.lcdList, styles.shrink]}>{line.name}</LcdText>
                      <LcdText style={[gadgetType.lcdList, styles.dim]}>{` ${line.prescription}`}</LcdText>
                    </View>
                  ),
                )}
              </Animated.View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.row, styles.todoRow]}>
            <View style={styles.rowHead}>
              <LcdText style={[gadgetType.lcdRow, styles.dim, styles.shrink]}>{title}</LcdText>
              <LcdText style={[gadgetType.lcdRow, styles.dim]}>
                {row.liftCount === 1 ? '1 LIFT' : `${row.liftCount} LIFTS`}
              </LcdText>
            </View>
            {row.estimate ? (
              <LcdText style={[gadgetType.lcdMeta, styles.dim, styles.meta]}>{row.estimate}</LcdText>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * A stamped day: orange, ink #121211, `MON 48 MIN` / `9 SETS`, and a PR stamp rotated 7° on
 * its top edge. A day that just finished fills from todo to done and stamps in (SPEC §7);
 * the haptic and sound play as the stamp lands.
 */
function DoneRow({ row, title, celebrate }: { row: HomeRow; title: string; celebrate: boolean }) {
  const haptics = useHaptics();
  const playSound = useSounds();
  const reduceMotion = useReducedMotion();
  const done = row.done!;

  // 0 = the todo row, 1 = done.
  const fill = useSharedValue(celebrate ? 0 : 1);
  // 0 = the stamp in the air (2.4×, −12°, clear), 1 = landed.
  const stamp = useSharedValue(celebrate ? 0 : 1);
  const reduced = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    reduced.set(reduceMotion ? 1 : 0);
    if (!celebrate) {
      fill.set(1);
      stamp.set(1);
      return;
    }
    fill.set(0);
    stamp.set(0);
    fill.set(withDelay(DEVICE.ROW_FILL_DELAY, withTiming(1, { duration: DEVICE.STAMP })));
    stamp.set(
      withDelay(
        DEVICE.STAMP_DELAY,
        reduceMotion
          ? withTiming(1, { duration: DEVICE.REDUCED_FADE })
          : withTiming(1, { duration: DEVICE.STAMP, easing: EASE_STAMP_FN }),
      ),
    );
    const land = setTimeout(() => {
      haptics.stamp();
      playSound('stamp');
    }, DEVICE.STAMP_DELAY + (reduceMotion ? 0 : DEVICE.STAMP_LAND));
    return () => clearTimeout(land);
  }, [celebrate, fill, haptics, playSound, reduceMotion, reduced, stamp]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.get(), [0, 1], [lcd.todoRow, lcd.doneRow]),
  }));
  const inkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(fill.get(), [0, 1], [lcd.amberDim, lcd.doneRowInk]),
  }));
  const metaStyle = useAnimatedStyle(() => ({
    color: interpolateColor(fill.get(), [0, 1], [lcd.amberDim, lcd.doneRowMeta]),
  }));
  const stampStyle = useAnimatedStyle(() => {
    const t = stamp.get();
    if (reduced.get() === 1) {
      return { opacity: t, transform: [{ rotate: `${device.stampAngle}deg` }] };
    }
    const scale = device.stampFromScale + (1 - device.stampFromScale) * t;
    const angle = device.stampFromAngle + (device.stampAngle - device.stampFromAngle) * t;
    return { opacity: Math.min(1, t), transform: [{ scale }, { rotate: `${angle}deg` }] };
  });

  return (
    <Animated.View style={[styles.row, styles.doneRow, rowStyle]}>
      <View style={styles.rowHead}>
        <LcdText animated style={[gadgetType.lcdRow, styles.shrink, inkStyle]}>
          {title}
        </LcdText>
        <LcdText animated style={[gadgetType.lcdRow, inkStyle]}>
          ✓
        </LcdText>
      </View>
      <View style={[styles.rowHead, styles.meta]}>
        <LcdText animated style={[gadgetType.lcdMeta, metaStyle]}>
          {`${done.weekday} ${done.minutes} MIN`}
        </LcdText>
        <LcdText animated style={[gadgetType.lcdMeta, metaStyle]}>
          {done.sets === 1 ? '1 SET' : `${done.sets} SETS`}
        </LcdText>
      </View>
      {row.stamp ? (
        <Animated.View pointerEvents="none" style={[styles.stamp, stampStyle]}>
          <LcdText style={[gadgetType.lcdStamp, styles.stampInk]}>{row.stamp.text}</LcdText>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** No plans (D18): `SLOT` / `EMPTY` dim on top and a blinking `INSERT PLAN`. */
export function EmptySlot() {
  const blink = useSharedValue(1);
  useEffect(() => {
    const half = DEVICE.BLINK / 2;
    // CSS `steps(1)`: on for half the period, dim for the other half.
    blink.set(
      withRepeat(
        withSequence(
          withDelay(half, withTiming(device.blinkDimOpacity, { duration: DEVICE.SNAP })),
          withDelay(half, withTiming(1, { duration: DEVICE.SNAP })),
        ),
        -1,
      ),
    );
  }, [blink]);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));

  return (
    <View style={styles.fill} accessible accessibilityLabel="No plan. Insert a plan.">
      <View style={styles.header}>
        <LcdText style={[gadgetType.lcdSmall, styles.dim]}>SLOT</LcdText>
        <LcdText style={[gadgetType.lcdSmall, styles.dim]}>EMPTY</LcdText>
      </View>
      <Animated.View style={[styles.prompt, blinkStyle]}>
        <LcdText style={gadgetType.lcdPrompt} lines={2}>
          {'INSERT\nPLAN'}
        </LcdText>
      </Animated.View>
    </View>
  );
}

/** Display text: fixed size (hardware), one line, cut short with … */
function LcdText({
  children,
  style,
  animated = false,
  lines = 1,
}: {
  children: string;
  style: object | object[];
  animated?: boolean;
  lines?: number;
}) {
  const Component = animated ? Animated.Text : Text;
  return (
    <Component maxFontSizeMultiplier={1} numberOfLines={lines} style={style}>
      {children}
    </Component>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  rows: {
    paddingTop: device.rowInset,
    paddingBottom: device.rowInset,
    paddingHorizontal: device.rowInset,
    gap: device.rowGap,
  },
  row: {
    height: device.rowHeight,
    borderRadius: gadgetRadius.lcdRow,
    borderCurve: 'continuous',
    paddingHorizontal: device.rowPadX,
    paddingVertical: device.rowPadY,
  },
  doneRow: { backgroundColor: lcd.doneRow },
  // A selected stamped row (Start repeats it): a 2pt amber ring outside the orange, clear of
  // it by a gap of lcd ground. Drawn behind the row, so the PR stamp stays on top.
  ring: {
    position: 'absolute',
    top: -(device.rowRingGap + device.rowOutline),
    bottom: -(device.rowRingGap + device.rowOutline),
    left: -(device.rowRingGap + device.rowOutline),
    right: -(device.rowRingGap + device.rowOutline),
    borderWidth: device.rowOutline,
    borderColor: lcd.amber,
    borderRadius: gadgetRadius.lcdRow + device.rowRingGap + device.rowOutline,
    borderCurve: 'continuous',
  },
  // The prototype's undone rows are <button>s, which centre their content vertically.
  selectedRow: {
    justifyContent: 'center',
    boxShadow: `inset 0 0 0 ${device.rowOutline}px ${lcd.amber}`,
  },
  todoRow: { justifyContent: 'center', backgroundColor: lcd.todoRow },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: device.rowGap },
  shrink: { flexShrink: 1 },
  meta: { marginTop: device.rowMetaGap },
  lines: { marginTop: device.rowListGap },
  line: { flexDirection: 'row' },
  dim: { color: lcd.amberDim },
  stamp: {
    position: 'absolute',
    right: device.stampOffsetRight,
    top: device.stampOffsetTop,
    borderWidth: device.stampBorder,
    borderColor: lcd.doneRowInk,
    borderRadius: gadgetRadius.stamp,
    borderCurve: 'continuous',
    paddingHorizontal: device.stampPadX,
    paddingVertical: device.stampPadY,
    backgroundColor: lcd.doneRow,
  },
  stampInk: { color: lcd.doneRowInk },
  fade: { position: 'absolute', left: 0, right: 0, height: device.rowFadeHeight },
  fadeTop: {
    top: 0,
    experimental_backgroundImage: `linear-gradient(180deg, ${lcd.lcd}, ${lcd.lcdClear})`,
  },
  fadeBottom: {
    bottom: 0,
    experimental_backgroundImage: `linear-gradient(0deg, ${lcd.lcd}, ${lcd.lcdClear})`,
  },
  footer: {
    alignItems: 'center',
    paddingTop: device.rowGap,
    paddingBottom: device.displayFooterY,
  },
  header: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prompt: { position: 'absolute', left: device.displayPad, right: device.displayPad, top: device.promptY },
});
