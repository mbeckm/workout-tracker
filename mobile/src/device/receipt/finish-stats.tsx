import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  receiptGeometry as g,
  sheetColors,
  sheetGeometry,
  signal,
  space,
} from '@/constants/theme';
import { groupThousands, receiptLoad, type DeltaTone, type FinishStat, type FinishStats } from '@/device/receipt-model';
import { SheetCard } from '@/device/sheets/primitives';
import { DEVICE, EASE_OUT_FN } from '@/motion';

const TONE: Record<DeltaTone, string> = { up: signal.done, record: signal.record, quiet: sheetColors.muted };

/** Rises 16 into place and fades in after `index` staggers; still when `play` is off. */
export function Rise({ index, play, children }: { index: number; play: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const animate = play && !reduceMotion;
  const progress = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    progress.set(
      withDelay(
        index * DEVICE.FINISH_STAGGER,
        withTiming(1, { duration: DEVICE.FINISH_RISE, easing: EASE_OUT_FN, reduceMotion: ReduceMotion.Never }),
      ),
    );
  }, [animate, index, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * space.inset }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Counts from 0 to `value` over FINISH_COUNT (ease-out cubic) when `play`, else shows it. */
function useCountUp(value: number, play: boolean): number {
  const reduceMotion = useReducedMotion();
  const animate = play && !reduceMotion;
  const [shown, setShown] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const start = Date.now() + DEVICE.FINISH_COUNT_DELAY;
    const tick = () => {
      const t = Math.max(0, Math.min(1, (Date.now() - start) / DEVICE.FINISH_COUNT));
      setShown(value * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, value]);
  return animate ? shown : value;
}

function StatCell({ stat, play }: { stat: FinishStat; play: boolean }) {
  const shown = useCountUp(stat.value, play);
  // An estimated max keeps its half (114.5); everything else is whole.
  const text = stat.key === 'oneRM' && shown === stat.value ? receiptLoad(stat.value) : groupThousands(shown);
  return (
    <View style={styles.cell} accessible accessibilityLabel={stat.accessibilityLabel}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={fontScaleCap.display}
        style={[gadgetType.finishStat, styles.tabular, stat.record && styles.gold]}>
        {text}
      </Text>
      <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.title} style={gadgetType.statLabel}>
        {stat.label}
      </Text>
      {stat.delta ? (
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={fontScaleCap.title}
          style={[gadgetType.statLabel, styles.delta, { color: TONE[stat.delta.tone] }]}>
          {stat.delta.text}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The finish screen's numbers (decision 90, F3a): three stats in one card, then a card with one
 * row per lift and its line against last time. Fresh, the cards rise in one after another and
 * the numbers count up; from History they're simply there.
 */
export function FinishStatsView({ stats, play }: { stats: FinishStats; play: boolean }) {
  return (
    <View style={styles.stack}>
      <Rise index={0} play={play}>
        <View style={[styles.card, styles.statRow]}>
          {stats.stats.map((stat) => (
            <StatCell key={stat.key} stat={stat} play={play} />
          ))}
        </View>
      </Rise>
      {stats.lifts.length > 0 ? (
        <SheetCard>
          {stats.lifts.map((lift, index) => (
            <Rise key={lift.id} index={index + 1} play={play}>
              <View style={styles.lift} accessible accessibilityLabel={lift.accessibilityLabel}>
                <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowTitle, styles.liftName]}>
                  {lift.name}
                </Text>
                <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowSub, { color: TONE[lift.delta.tone] }]}>
                  {lift.delta.text}
                </Text>
              </View>
            </Rise>
          ))}
        </SheetCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: sheetGeometry.cardGap },
  card: { backgroundColor: sheetColors.card, borderRadius: gadgetRadius.card, borderCurve: 'continuous' },
  statRow: { flexDirection: 'row', paddingHorizontal: g.statPadX, paddingVertical: g.statPadY, gap: space.related },
  cell: { flex: 1, minWidth: 0 },
  gold: { color: signal.record },
  tabular: { fontVariant: ['tabular-nums'] },
  delta: { marginTop: g.statDeltaTop },
  lift: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.related,
    minHeight: g.liftRowHeight,
    paddingHorizontal: sheetGeometry.itemPadX,
    paddingVertical: space.related,
  },
  liftName: { flexShrink: 1 },
});
