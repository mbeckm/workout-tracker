import { useEffect, useRef } from 'react';
import { AppState, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  device,
  fontScaleCap,
  gadgetType,
  momentColors,
  receiptColors,
  receiptGeometry as g,
  signal,
} from '@/constants/theme';
import { useHaptics, useSounds } from '@/device/haptics';
import { fromReferenceTop } from '@/device/layout';
import type { WeekReport } from '@/device/moments';
import { DashedRule, Paper } from '@/device/receipt/paper';
import { PillButton } from '@/device/sheets/primitives';
import { DEVICE, EASE_DISPLAY_FN, EASE_WEEK_DROP_FN } from '@/motion';

import { GridGround } from './grid-ground';

const NEVER = ReduceMotion.Never;

/**
 * The finished week (D15; boards HR2 and QC2): on the dark grid ground, the week's report drops
 * onto the receipt spike over the week's other slips, with the stamp thud as it lands. Share week
 * and Done. A tap on the scene skips to the end; backgrounding finishes it. Reduce Motion: the
 * scene and the report fade in, the thud stays. Done fades it away, then the queue moves on.
 */
export function WeekMoment({ report, onDone }: { report: WeekReport; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const haptics = useHaptics();
  const playSound = useSounds();
  const scene = useSharedValue(0);
  const drop = useSharedValue(0);
  const landed = useRef(false);
  const leaving = useRef(false);

  const land = () => {
    if (landed.current) return;
    landed.current = true;
    haptics.stamp();
    playSound('stamp');
  };

  const skip = () => {
    cancelAnimation(scene);
    cancelAnimation(drop);
    scene.set(1);
    drop.set(1);
    land();
  };

  useEffect(() => {
    scene.set(withTiming(1, { duration: DEVICE.WEEK_SCENE, easing: EASE_DISPLAY_FN, reduceMotion: NEVER }));
    drop.set(
      withDelay(
        reduceMotion ? 0 : DEVICE.WEEK_DROP_DELAY,
        withTiming(1, {
          duration: reduceMotion ? DEVICE.WEEK_SCENE : DEVICE.WEEK_DROP,
          easing: reduceMotion ? EASE_DISPLAY_FN : EASE_WEEK_DROP_FN,
          reduceMotion: NEVER,
        }),
        NEVER,
      ),
    );
    // The thud on the frame the slip meets the spike (trim-ui §8 rule 3).
    const timer = setTimeout(land, reduceMotion ? DEVICE.WEEK_SCENE : DEVICE.WEEK_DROP_DELAY + DEVICE.WEEK_DROP_LAND);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') skip();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
    // Plays once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = () => {
    if (leaving.current) return;
    leaving.current = true;
    land();
    cancelAnimation(drop);
    drop.set(1);
    scene.set(
      withTiming(0, { duration: DEVICE.WEEK_SCENE_OUT, easing: EASE_DISPLAY_FN, reduceMotion: NEVER }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  };

  const share = () => {
    void Share.share({ message: report.text }).catch(() => undefined);
  };

  const sceneStyle = useAnimatedStyle(() => ({ opacity: scene.get() }));
  const reportStyle = useAnimatedStyle(() => {
    const t = drop.get();
    if (reduceMotion) return { opacity: t, transform: [{ rotate: `${g.reportTilt}deg` }] };
    return {
      opacity: interpolate(t, [0, 0.3], [0, 1], 'clamp'),
      transform: [
        { translateY: (1 - t) * -g.dropFrom },
        { rotate: `${interpolate(t, [0, 1], [g.dropTilt, g.reportTilt])}deg` },
      ],
    };
  });

  const y = (reference: number) => fromReferenceTop(reference, insets.top);
  const centre = (w: number) => (width - w) / 2;
  const bottom = insets.bottom - device.bottomClearance + g.momentBottom;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, sceneStyle]}
      accessibilityViewIsModal
      onAccessibilityEscape={done}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessible={false} importantForAccessibility="no">
        <GridGround />
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={fontScaleCap.title}
          style={[gadgetType.momentTitle, styles.centreText, { top: y(g.momentTitleY) }]}>
          {report.headline}
        </Text>
        {report.streak ? (
          <Text
            maxFontSizeMultiplier={fontScaleCap.title}
            style={[gadgetType.rowSub, styles.centreText, { top: y(g.momentSubY) }]}>
            {report.streak}
          </Text>
        ) : null}

        <View style={[styles.spike, { top: y(g.spikeY), left: centre(g.spikeWidth) }]} />
        {g.backReceipts.map((slip, index) => (
          <View
            key={index}
            style={[
              styles.slip,
              { top: y(slip.y), left: centre(g.weekReportWidth), transform: [{ rotate: `${slip.tilt}deg` }] },
            ]}>
            <Paper kind="week" contentStyle={{ height: slip.height + g.weekReportPadTop + g.weekReportPadBottom }}>
              {null}
            </Paper>
            <View style={styles.hole} />
          </View>
        ))}

        <Animated.View
          accessible
          accessibilityLabel={report.accessibilityLabel}
          style={[styles.slip, { top: y(g.reportY), left: centre(g.weekReportWidth) }, reportStyle]}>
          <Paper kind="week" contentStyle={styles.reportContent}>
            <View style={styles.pair}>
              <Text maxFontSizeMultiplier={1} style={gadgetType.receiptWeekTitle}>
                {report.label}
              </Text>
              <View style={styles.lamps}>
                {Array.from({ length: report.lamps }, (_, index) => (
                  <View key={index} style={styles.lamp} />
                ))}
              </View>
            </View>
            <Text maxFontSizeMultiplier={1} style={gadgetType.receiptWeek}>
              {report.range}
            </Text>
            <DashedRule gap={g.weekRuleGap} />
            <ReportRow left="LIFTS UP" right={String(report.liftsUp)} />
            <ReportRow left="RECORDS" right={`★ ${report.records}`} record />
            <ReportRow left="VOLUME" right={report.volume} />
            {report.best ? (
              <>
                <DashedRule gap={g.weekRuleGap} />
                <ReportRow left="BEST" right={report.best} bold />
              </>
            ) : null}
          </Paper>
          <View style={styles.hole} />
        </Animated.View>

        <View style={[styles.base, { top: y(g.baseY), left: centre(g.baseWidth) }]} />
      </Pressable>

      <View style={[styles.actions, { bottom }]} pointerEvents="box-none">
        <PillButton title="Share week" variant="dark" onPress={share} style={styles.share} testID="week-share" />
        <PillButton title="Done" onPress={done} style={styles.done} testID="week-done" />
      </View>
    </Animated.View>
  );
}

function ReportRow({ left, right, bold, record }: { left: string; right: string; bold?: boolean; record?: boolean }) {
  const style = bold ? gadgetType.receiptWeekBold : gadgetType.receiptWeek;
  return (
    <View style={styles.pair}>
      <Text maxFontSizeMultiplier={1} style={style}>
        {left}
      </Text>
      <Text maxFontSizeMultiplier={1} style={[style, record && styles.record]}>
        {right}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centreText: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  spike: {
    position: 'absolute',
    width: g.spikeWidth,
    height: g.spikeHeight,
    borderTopLeftRadius: g.spikeWidth / 2,
    borderTopRightRadius: g.spikeWidth / 2,
    experimental_backgroundImage: `linear-gradient(90deg, ${momentColors.spikeEdge}, ${momentColors.spikeMid}, ${momentColors.spikeEdge})`,
  },
  slip: { position: 'absolute', width: g.weekReportWidth },
  hole: {
    position: 'absolute',
    top: g.holeTop,
    left: (g.weekReportWidth - g.hole) / 2,
    width: g.hole,
    height: g.hole,
    borderRadius: g.hole / 2,
    backgroundColor: receiptColors.hole,
  },
  reportContent: {
    paddingTop: g.weekReportPadTop,
    paddingHorizontal: g.weekReportPadX,
    paddingBottom: g.weekReportPadBottom,
  },
  pair: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lamps: { flexDirection: 'row', gap: g.weekReportLampGap },
  lamp: {
    width: g.weekReportLamp,
    height: g.weekReportLamp,
    borderRadius: g.weekReportLamp / 2,
    backgroundColor: signal.done,
  },
  record: { color: receiptColors.record, fontFamily: gadgetType.receiptWeekBold.fontFamily },
  base: {
    position: 'absolute',
    width: g.baseWidth,
    height: g.baseHeight,
    borderRadius: g.baseHeight / 2,
    experimental_backgroundImage: `linear-gradient(180deg, ${momentColors.baseHi}, ${momentColors.baseLo})`,
    boxShadow: `0 ${g.baseLip}px 0 ${momentColors.baseLip}, 0 ${g.baseShadowY}px ${g.baseShadowBlur}px ${momentColors.baseShadow}`,
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: g.actionGap,
  },
  share: { width: g.shareWeekWidth, marginTop: 0 },
  done: { width: g.doneWidth, marginTop: 0 },
});
