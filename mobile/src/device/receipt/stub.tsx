import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fontScaleCap, gadgetType, receiptColors, receiptGeometry as g, space } from '@/constants/theme';
import { useHaptics, useSounds } from '@/device/haptics';
import { DashedRule, Paper } from '@/device/receipt/paper';
import { dotoSet, type ReceiptStub } from '@/device/receipt-model';
import { DEVICE, EASE_FILE_FN, LINEAR_FN } from '@/motion';

/** Thermal text: the ink bleeds a little (`text-shadow 0 0 .5px`). */
function Ink({ style, children, lines }: { style: object | object[]; children: string; lines?: number }) {
  return (
    <Text numberOfLines={lines} maxFontSizeMultiplier={fontScaleCap.display} style={[style, styles.ink]}>
      {children}
    </Text>
  );
}

/** A row with a left and a right column. */
function Pair({ left, right }: { left: string; right: string }) {
  const style = gadgetType.receiptStubBold;
  return (
    <View style={styles.pair}>
      <Ink style={[style, styles.shrink]} lines={1}>
        {left}
      </Ink>
      <Ink style={style}>{right}</Ink>
    </View>
  );
}

/** The bars under the footer: the pattern, three times over. */
function Barcode() {
  const bars = [...g.barcodeBars, ...g.barcodeBars, ...g.barcodeBars];
  return (
    <View style={styles.barcode} importantForAccessibility="no-hide-descendants">
      {bars.map((width, index) => (
        <View key={index} style={{ width, backgroundColor: index % 2 === 0 ? receiptColors.ink : undefined }} />
      ))}
    </View>
  );
}

/**
 * What the receipt prints (decision 90): `TRIM` and `No. 047`, the name, the double rule, the
 * milestone, each goal reached, every record (one big; several as rows, old struck through),
 * the day and the volume, a barcode.
 */
function StubContent({ stub }: { stub: ReceiptStub }) {
  const single = stub.records.length === 1 ? stub.records[0] : null;
  return (
    <>
      <View style={styles.pair}>
        <Ink style={gadgetType.receiptMast}>TRIM</Ink>
        <Ink style={[gadgetType.receiptStub, styles.muted]}>{stub.number}</Ink>
      </View>
      {stub.name ? <Ink style={gadgetType.receiptStubName}>{stub.name}</Ink> : null}
      <View style={styles.doubleRule} />
      {stub.milestone ? <Ink style={[gadgetType.receiptStubBold, styles.pr]}>{`★ ${stub.milestone}`}</Ink> : null}
      {stub.goals.map((goal) => (
        <View key={goal.lift} style={styles.block}>
          <Ink style={[gadgetType.receiptStubBold, styles.pr]}>GOAL REACHED ✓</Ink>
          <Ink style={gadgetType.receiptHeroSmall}>{goal.target}</Ink>
          <Ink style={gadgetType.receiptStubBold}>{goal.lift}</Ink>
        </View>
      ))}
      {stub.recordsHeading ? (
        <Ink style={[gadgetType.receiptStubBold, styles.pr, stub.goals.length > 0 && styles.block]}>{stub.recordsHeading}</Ink>
      ) : null}
      {single ? (
        <>
          {single.was ? (
            <View style={styles.pair}>
              <Ink style={[gadgetType.receiptStub, styles.muted, styles.struck]}>{single.was}</Ink>
              {single.wasDate ? <Ink style={[gadgetType.receiptStub, styles.muted]}>{single.wasDate}</Ink> : null}
            </View>
          ) : null}
          <Ink style={gadgetType.receiptHero}>{dotoSet(single.now)}</Ink>
          <Ink style={gadgetType.receiptStubBold}>{single.lift}</Ink>
        </>
      ) : (
        stub.records.map((record) => (
          <View key={record.lift} style={styles.record}>
            <Ink style={gadgetType.receiptStubBold} lines={1}>
              {record.lift}
            </Ink>
            <View style={styles.pairBase}>
              <Ink style={[gadgetType.receiptStub, styles.muted, styles.struck]}>{record.was ?? ''}</Ink>
              <Ink style={gadgetType.receiptHeroSmall}>{dotoSet(record.now)}</Ink>
            </View>
          </View>
        ))
      )}
      <DashedRule gap={g.stubRuleGap} />
      <Pair left={stub.footer.title} right={stub.footer.amount} />
      <Ink style={[gadgetType.receiptStub, styles.muted]}>{stub.footer.date}</Ink>
      <Barcode />
    </>
  );
}

/** The rubber stamp: a ring of record ink, its lines centred, tilted. */
function StampMark({ lines }: { lines: string[] }) {
  return (
    <View style={styles.stampRing}>
      {lines.map((line, index) => (
        <Text key={index} maxFontSizeMultiplier={1} style={gadgetType.receiptStamp}>
          {line}
        </Text>
      ))}
    </View>
  );
}

/**
 * The receipt at the bottom of the finish screen (F3a): it prints up out of the slot under it in
 * FEED_STEPS steps with the print haptic and sound, then the stamp slams on and the paper jolts.
 * `animate` off (from History): it's simply there. A tap on the paper completes it. Reduce
 * Motion: the paper fades in where it ends, the stamp with it; haptics and sounds stay.
 */
export function PrintingStub({
  stub,
  animate,
  onPrintStart,
}: {
  stub: ReceiptStub;
  animate: boolean;
  /** When the paper starts to feed (the sheet scrolls it into view). */
  onPrintStart?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const haptics = useHaptics();
  const playSound = useSounds();
  const feed = useSharedValue(animate ? 0 : 1);
  const stamp = useSharedValue(animate ? 0 : 1);
  const jolt = useSharedValue(0);
  const height = useSharedValue(0);
  const started = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = () => {
    if (started.current || !animate) return;
    started.current = true;
    const feedTime = reduceMotion ? DEVICE.REDUCED_FADE : DEVICE.FEED;
    const stampAt = DEVICE.STUB_DELAY + feedTime + DEVICE.STUB_STAMP_GAP;
    timers.current.push(
      setTimeout(() => {
        onPrintStart?.();
        haptics.receiptPrint();
        playSound('print');
      }, DEVICE.STUB_DELAY),
      setTimeout(() => {
        haptics.stamp();
        playSound('stamp');
      }, stampAt + (reduceMotion ? 0 : DEVICE.STUB_STAMP_LAND)),
    );
    feed.set(
      withDelay(
        DEVICE.STUB_DELAY,
        withTiming(1, { duration: feedTime, easing: LINEAR_FN, reduceMotion: ReduceMotion.Never }),
      ),
    );
    stamp.set(
      withDelay(
        stampAt,
        reduceMotion
          ? withTiming(1, { duration: DEVICE.REDUCED_FADE, reduceMotion: ReduceMotion.Never })
          : withTiming(1, { duration: DEVICE.STUB_STAMP, easing: EASE_FILE_FN, reduceMotion: ReduceMotion.Never }),
      ),
    );
    if (!reduceMotion) {
      const third = DEVICE.STUB_JOLT / 3;
      jolt.set(
        withDelay(
          stampAt + DEVICE.STUB_STAMP_LAND,
          withSequence(
            withTiming(space.tight, { duration: third, reduceMotion: ReduceMotion.Never }),
            withTiming(-space.pair / 2, { duration: third, reduceMotion: ReduceMotion.Never }),
            withTiming(0, { duration: third, reduceMotion: ReduceMotion.Never }),
          ),
        ),
      );
    }
  };

  const onLayout = (event: LayoutChangeEvent) => {
    height.set(event.nativeEvent.layout.height);
    start();
  };

  const complete = () => {
    cancelAnimation(feed);
    cancelAnimation(stamp);
    cancelAnimation(jolt);
    feed.set(1);
    stamp.set(1);
    jolt.set(0);
  };

  const paperStyle = useAnimatedStyle(() => {
    const h = height.get();
    if (h === 0) return { opacity: animate ? 0 : 1 };
    if (reduceMotion) return { opacity: feed.get(), transform: [{ translateY: 0 }] };
    const step = Math.ceil(feed.get() * DEVICE.FEED_STEPS) / DEVICE.FEED_STEPS;
    return { opacity: 1, transform: [{ translateY: (1 - step) * h + jolt.get() }] };
  });

  const stampStyle = useAnimatedStyle(() => {
    const t = stamp.get();
    if (reduceMotion) return { opacity: t, transform: [{ rotate: `${g.stampTilt}deg` }] };
    const scale = g.stampFromScale + (1 - g.stampFromScale) * t;
    const angle = g.stampFromAngle + (g.stampTilt - g.stampFromAngle) * t;
    return { opacity: Math.min(1, t * 2), transform: [{ scale }, { rotate: `${angle}deg` }] };
  });

  return (
    <View>
      <Pressable
        onPress={complete}
        accessible
        accessibilityRole="text"
        accessibilityLabel={stub.accessibilityLabel}
        style={styles.clip}>
        <Animated.View style={paperStyle} onLayout={onLayout}>
          <Paper kind="stub" style={styles.paper} contentStyle={styles.content}>
            <StubContent stub={stub} />
            <Animated.View style={[styles.stamp, stampStyle]} pointerEvents="none">
              <StampMark lines={stub.stamp} />
            </Animated.View>
          </Paper>
        </Animated.View>
      </Pressable>
      <View style={styles.slot} />
    </View>
  );
}

const styles = StyleSheet.create({
  ink: {
    textShadowColor: receiptColors.inkBleed,
    textShadowRadius: 0.5,
    textShadowOffset: { width: 0, height: 0 },
  },
  muted: { color: receiptColors.muted },
  pr: { color: receiptColors.pr },
  struck: { textDecorationLine: 'line-through' },
  shrink: { flexShrink: 1 },
  pair: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.related },
  pairBase: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.related },
  block: { marginTop: g.stubRecordGap },
  record: { marginTop: g.stubRecordGap },
  doubleRule: {
    height: g.stubRuleLine * 2 + g.stubRuleSpace,
    borderTopWidth: g.stubRuleLine,
    borderBottomWidth: g.stubRuleLine,
    borderColor: receiptColors.ink,
    marginVertical: g.stubRuleGap,
  },
  barcode: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: g.barcodeHeight,
    marginTop: g.barcodeTop,
    marginHorizontal: g.barcodeInset,
    overflow: 'hidden',
  },
  // The paper rises out of the slot: anything below the slot's top is hidden.
  clip: { overflow: 'hidden', alignItems: 'center', paddingTop: g.stubSlotTop },
  paper: { width: g.stubWidth },
  content: { paddingTop: g.stubPadTop, paddingHorizontal: g.stubPadX, paddingBottom: g.stubPadBottom },
  stamp: { position: 'absolute', right: g.stampRight, bottom: g.stampBottom },
  stampRing: {
    width: g.stampSize,
    height: g.stampSize,
    borderRadius: g.stampSize / 2,
    borderWidth: g.stampLine,
    borderColor: receiptColors.pr,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    height: g.slotHeight,
    marginHorizontal: g.stubSlotInset,
    marginTop: -g.slotHeight / 2,
    borderRadius: g.slotRadius,
    backgroundColor: receiptColors.slot,
    boxShadow: `0 1px 0 ${receiptColors.slotLip}`,
  },
});
