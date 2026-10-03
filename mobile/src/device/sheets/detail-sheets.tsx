import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontScaleCap, gadgetType, progressGeometry as geo, progressType, signal } from '@/constants/theme';
import { BODY_METRICS, type BodyMetricKey } from '@/domain/check-in';
import { goalForLift } from '@/domain/goals';
import {
  formatProgressChartSummary,
  isProgressWindowLocked,
  PROGRESS_WINDOWS,
  type ProgressPoint,
  type ProgressWindow,
} from '@/domain/progress';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import {
  bodyDetailModel,
  bodyGoalView,
  bodyLabel,
  formatChangeLine,
  formatProgressNumber,
  formatSessionDate,
  liftDetailModel,
  type DetailModel,
} from '@/device/progress-model';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

import { SectionLabel, Segmented, SheetCard, SheetHeader, SheetRow, SheetScroll } from './primitives';
import { LcdChart, useProgressWindow } from './progress-parts';
import { viaMenu } from './progress-sheet';

/**
 * Lift detail (QA2, screen 19; SPEC §6; trim-ui §11, §13): `Estimated max`, the big number with
 * its unit, the change over the range, the lcd chart with the goal line, the range (1M and 3M
 * free, the rest `PRO` → the paywall `progress_history`), then the range's sessions. `Goal`
 * in the header sets, replaces, unpins or removes the goal (PRODUCT-DECISIONS 63).
 */
export function LiftSheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { units, workoutHistory, isPro, goals } = useWorkoutStore();
  const name = params.name ?? '';
  const via = viaMenu(params);
  const [window, setWindow] = useProgressWindow(isPro);
  const model = useMemo(
    () => liftDetailModel(name, workoutHistory, window, units),
    [name, units, window, workoutHistory],
  );
  const goal = goalForLift(goals, name);

  return (
    <SheetScroll
      header={
        <SheetHeader
          title={name}
          left={{ kind: 'back', onPress: () => swapSheet('progress', { from: via }) }}
          right={{
            kind: 'text',
            label: 'Goal',
            accessibilityLabel: goal ? `Goal ${formatProgressNumber(goal.target, 1)} ${units}` : 'Set a goal',
            onPress: () => swapSheet('goal', { name, from: 'lift', via }),
          }}
        />
      }>
      <DetailBody
        model={model}
        caption="Estimated max"
        chartLabel="Estimated max"
        window={window}
        onWindow={setWindow}
        isPro={isPro}
        goal={goal?.target ?? null}
        emptyText="No sessions"
        sessionsLabel="SESSIONS"
        testID="lift-sheet"
      />
    </SheetScroll>
  );
}

/**
 * Body detail (D11; trim-ui §13 Lift detail): lift detail without the lift-only parts. The
 * caption is the latest check-in's date, `+` in the header opens the check-in, and a Goal row
 * sets the measurement's goal (PRODUCT-DECISIONS 65).
 */
export function BodySheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { bodyCheckIns, bodyGoals, units, isPro } = useWorkoutStore();
  const metric = (BODY_METRICS.some((item) => item.key === params.metric) ? params.metric : 'bodyweightKg') as BodyMetricKey;
  const via = viaMenu(params);
  const [window, setWindow] = useProgressWindow(isPro);
  const model = useMemo(
    () => bodyDetailModel(metric, bodyCheckIns, window, units),
    [bodyCheckIns, metric, units, window],
  );
  const goal = bodyGoalView(metric, bodyGoals, bodyCheckIns, units);
  const latest = model.series.length > 0 ? model.series[model.series.length - 1] : null;
  const openGoal = () => swapSheet('goal', { metric, from: 'body', via });

  return (
    <SheetScroll
      header={
        <SheetHeader
          title={bodyLabel(metric)}
          left={{ kind: 'back', onPress: () => swapSheet('progress', { from: via }) }}
          right={{
            kind: 'text',
            label: '+',
            accessibilityLabel: 'Check in',
            onPress: () => swapSheet('checkin', { from: 'body', metric, via }),
          }}
        />
      }>
      <DetailBody
        model={model}
        caption={latest ? formatSessionDate(latest.date) : bodyLabel(metric)}
        chartLabel={bodyLabel(metric)}
        window={window}
        onWindow={setWindow}
        isPro={isPro}
        goal={goal?.target ?? null}
        emptyText={model.series.length === 0 ? 'No check-ins' : 'No check-ins in range'}
        sessionsLabel="CHECK-INS"
        testID="body-sheet"
        // A goal needs a measurement to start from (body-goal sheet).
        goalRow={
          goal || latest ? (
            <View style={styles.goalRow}>
              <SheetCard>
                <SheetRow
                  size="compact"
                  title={goal ? 'Goal' : 'Set a goal'}
                  sub={goal?.sub}
                  trailing={goal ? undefined : '+'}
                  onPress={openGoal}
                  testID="body-goal-row"
                />
              </SheetCard>
            </View>
          ) : null
        }
      />
    </SheetScroll>
  );
}

/** The readout, chart, range and sessions both detail sheets share. */
function DetailBody({
  model,
  caption,
  chartLabel,
  window,
  onWindow,
  isPro,
  goal,
  emptyText,
  goalRow,
  sessionsLabel,
  testID,
}: {
  model: DetailModel;
  caption: string;
  chartLabel: string;
  window: ProgressWindow;
  onWindow: (window: ProgressWindow) => void;
  isPro: boolean;
  goal: number | null;
  emptyText: string;
  goalRow?: ReactNode;
  sessionsLabel: string;
  testID: string;
}) {
  const [scrubbed, setScrubbed] = useState<ProgressPoint | null>(null);
  const { points, decimals, unit } = model;
  const hero = scrubbed?.value ?? model.latest;
  // The change over the range, from its first point to the value shown (trim-ui §11 rule 4).
  const change = hero != null && points.length >= 2 ? hero - points[0].value : null;
  const changeText =
    change != null ? formatChangeLine(change, decimals, window, points[0].date, scrubbed != null) : null;

  const pickWindow = (next: ProgressWindow) => {
    if (next === window) {
      return;
    }
    if (isProgressWindowLocked(next, isPro)) {
      void requirePro('progress_history').then((unlocked) => {
        if (unlocked) onWindow(next);
      });
      return;
    }
    onWindow(next);
  };

  const options = PROGRESS_WINDOWS.map((value) => ({
    value,
    label: value,
    badge: isProgressWindowLocked(value, isPro) ? 'PRO' : undefined,
  }));

  const chartSummary = formatProgressChartSummary(chartLabel, points, (value) =>
    `${formatProgressNumber(value, decimals)} ${unit}`,
  );

  return (
    <View testID={testID}>
      <View style={styles.head}>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={progressType.readoutCaption}>
          {scrubbed ? formatSessionDate(scrubbed.date) : caption}
        </Text>
        <View
          style={styles.bigRow}
          accessible
          accessibilityLabel={hero != null ? `${formatProgressNumber(hero, decimals)} ${unit}` : 'No value yet'}>
          <Text maxFontSizeMultiplier={fontScaleCap.title} style={[gadgetType.bigNumber, styles.tabular]}>
            {hero != null ? formatProgressNumber(hero, decimals) : '--'}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap.title} style={progressType.bigUnit}>
            {` ${unit}`}
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[progressType.changeLine, styles.tabular]}
          // Holds its line while empty, so the chart doesn't jump between ranges.
          accessibilityElementsHidden={changeText == null}>
          {changeText ?? ' '}
        </Text>
      </View>

      <LcdChart
        points={points}
        goal={points.length > 0 ? goal : null}
        // A window always ends at the latest point, so its last dot is the record.
        record={model.record}
        emptyText={emptyText}
        onScrub={setScrubbed}
        accessibilityLabel={chartSummary}
      />

      <Segmented options={options} value={window} onChange={pickWindow} />

      {goalRow}

      {model.sessions.length > 0 ? (
        <>
          <SectionLabel>{sessionsLabel}</SectionLabel>
          <SheetCard>
            {model.sessions.map((session) => (
              <View key={session.id} accessible accessibilityLabel={session.accessibilityLabel} style={styles.session}>
                <View style={styles.sessionText}>
                  <Text maxFontSizeMultiplier={fontScaleCap.text} style={progressType.sessionTitle}>
                    {session.title}
                  </Text>
                  {session.sub ? (
                    <Text
                      maxFontSizeMultiplier={fontScaleCap.text}
                      style={[progressType.sessionSub, styles.tabular, styles.sessionSub]}>
                      {session.sub}
                    </Text>
                  ) : null}
                </View>
                <Text
                  maxFontSizeMultiplier={fontScaleCap.text}
                  style={[progressType.sessionValue, styles.tabular, session.record && styles.record]}>
                  {session.record ? `★ ${session.value}` : session.value}
                </Text>
              </View>
            ))}
          </SheetCard>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: geo.headInset },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  tabular: { fontVariant: ['tabular-nums'] },
  goalRow: { marginTop: geo.chartTop },
  session: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: geo.rowGap,
    paddingVertical: geo.sessionPadY,
    paddingHorizontal: geo.sessionPadX,
  },
  sessionText: { flex: 1, minWidth: 0 },
  sessionSub: { marginTop: geo.sessionSubTop },
  record: { color: signal.record },
});
