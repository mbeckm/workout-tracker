import { useMemo, useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type Animated from 'react-native-reanimated';

import { track } from '@/analytics/analytics';
import { showToast } from '@/components/toast';
import {
  fontScaleCap,
  gadgetType,
  progressGeometry as geo,
  sheetColors,
  sheetGeometry,
  signal,
} from '@/constants/theme';
import { bodyGoalsReachedBy } from '@/domain/body-goals';
import {
  BODY_METRICS,
  bodyMetricForDisplay,
  bodyweightToKg,
  checkInMetrics,
  type BodyCheckIn,
  type BodyMetricKey,
  type CheckInMetric,
} from '@/domain/check-in';
import { latestCheckIn } from '@/domain/progress';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { parseDecimalInput, sanitizeDecimalInput } from '@/device/progress-model';
import { useWorkoutStore } from '@/store/workout-store';

import { backToOrigin } from './goal-sheet';
import { SheetCard, SheetHeader, SheetScroll } from './primitives';

const ACCESSORY_ID = 'check-in-accessory';
/** A focused field scrolls to about this far under the header. */
const FOCUS_OFFSET = sheetGeometry.headerHeight * 2;

function formatFieldValue(value: number | undefined, metric: CheckInMetric): string {
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return metric.unit === 'cm' ? String(value) : value.toFixed(1);
}

/**
 * The body check-in (D11; the old `check-in` logic) as a dark sheet: every measurement as a
 * row with the last value as its placeholder, `Save` in the header once a field has a value,
 * Next / Done on the keyboard. Saving says `Check-in saved`, or the goal it reached.
 */
export function CheckInSheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { bodyCheckIns, bodyGoals, saveCheckIn, units } = useWorkoutStore();
  const back = backToOrigin(params, swapSheet);
  const fields = useMemo(() => checkInMetrics(units), [units]);
  const latest = useMemo(() => latestCheckIn(bodyCheckIns), [bodyCheckIns]);
  const [draft, setDraft] = useState<Partial<Record<BodyMetricKey, string>>>({});
  const [focused, setFocused] = useState<BodyMetricKey | null>(null);
  const inputs = useRef<Partial<Record<BodyMetricKey, TextInput | null>>>({});
  const rowHeight = useRef(0);
  const cardY = useRef(0);
  const scroll = useRef<Animated.ScrollView>(null);
  const saving = useRef(false);

  const parsed = useMemo(() => {
    const next: Partial<BodyCheckIn> = {};
    for (const metric of fields) {
      const value = parseDecimalInput(draft[metric.key] ?? '');
      if (value != null) {
        next[metric.key] = metric.key === 'bodyweightKg' ? bodyweightToKg(value, units) : value;
      }
    }
    return next;
  }, [draft, fields, units]);
  const count = Object.keys(parsed).length;

  const save = () => {
    if (count === 0 || saving.current) {
      return;
    }
    saving.current = true;
    Keyboard.dismiss();
    const saved = saveCheckIn(parsed);
    track('check_in_saved', { fields: count });
    // A goal this check-in reaches is the news; otherwise the plain confirmation.
    const reached = bodyGoalsReachedBy(saved, bodyGoals)[0];
    const title = reached
      ? `${BODY_METRICS.find((metric) => metric.key === reached.metric)?.label ?? 'Body'} goal reached`
      : 'Check-in saved';
    back();
    showToast({ title });
  };

  const onFocus = (key: BodyMetricKey) => {
    setFocused(key);
    // Rows are one height, split by 1pt rules.
    const index = fields.findIndex((field) => field.key === key);
    const y = cardY.current + index * (rowHeight.current + 1);
    scroll.current?.scrollTo({ y: Math.max(0, y - FOCUS_OFFSET), animated: true });
  };

  const focusNext = () => {
    const index = fields.findIndex((field) => field.key === focused);
    const next = fields[index + 1];
    if (next) {
      inputs.current[next.key]?.focus();
    } else {
      Keyboard.dismiss();
    }
  };
  const lastFocused = focused === fields[fields.length - 1]?.key;

  return (
    <SheetScroll
      scrollRef={scroll}
      header={
        <SheetHeader
          title="Check in"
          left={{ kind: 'back', onPress: back }}
          right={{ kind: 'text', label: 'Save', onPress: save, disabled: count === 0 }}
        />
      }>
      <View
        testID="check-in-sheet"
        onLayout={(event) => {
          cardY.current = event.nativeEvent.layout.y;
        }}>
        <SheetCard>
          {fields.map((field) => {
            const text = draft[field.key] ?? '';
            const filled = parseDecimalInput(text) != null;
            const stored = latest?.[field.key];
            const placeholder =
              formatFieldValue(stored == null ? undefined : bodyMetricForDisplay(field.key, stored, units), field) ||
              '--';
            const spokenUnit = field.unit === 'cm' ? 'centimeters' : field.unit === 'lbs' ? 'pounds' : 'kilograms';
            return (
              <Pressable
                key={field.key}
                onPress={() => inputs.current[field.key]?.focus()}
                onLayout={(event) => {
                  rowHeight.current = event.nativeEvent.layout.height;
                }}
                accessible={false}
                style={styles.row}>
                <Text maxFontSizeMultiplier={fontScaleCap.text} style={[gadgetType.rowTitle, styles.label]}>
                  {field.label}
                </Text>
                <TextInput
                  ref={(node) => {
                    inputs.current[field.key] = node;
                  }}
                  value={text}
                  onChangeText={(next) =>
                    setDraft((current) => ({ ...current, [field.key]: sanitizeDecimalInput(next) }))
                  }
                  onFocus={() => onFocus(field.key)}
                  onBlur={() => setFocused((current) => (current === field.key ? null : current))}
                  keyboardType="decimal-pad"
                  keyboardAppearance="dark"
                  inputAccessoryViewID={Platform.OS === 'ios' ? ACCESSORY_ID : undefined}
                  accessibilityLabel={`${field.label}, ${spokenUnit}`}
                  placeholder={placeholder}
                  placeholderTextColor={sheetColors.sectionLabel}
                  selectionColor={signal.orange}
                  maxFontSizeMultiplier={fontScaleCap.text}
                  testID={`check-in-${field.key}`}
                  // No lineHeight on a TextInput (AGENTS.md): a fixed height keeps the placeholder still.
                  style={styles.input}
                />
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={fontScaleCap.text}
                  style={[gadgetType.rowSub, styles.unit, filled && styles.unitFilled]}>
                  {field.unit}
                </Text>
              </Pressable>
            );
          })}
        </SheetCard>
      </View>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={ACCESSORY_ID} backgroundColor={sheetColors.card}>
          <View style={styles.accessory}>
            <Pressable
              accessibilityRole="button"
              onPress={lastFocused ? () => Keyboard.dismiss() : focusNext}
              hitSlop={sheetGeometry.controlTop / 2}
              style={({ pressed }) => [styles.accessoryButton, pressed && styles.accessoryPressed]}>
              <Text maxFontSizeMultiplier={fontScaleCap.title} style={[gadgetType.control, styles.accessoryInk]}>
                {lastFocused ? 'Done' : 'Next'}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: geo.rowGap,
    paddingLeft: sheetGeometry.itemPadX,
    paddingRight: geo.rowGap,
    minHeight: geo.plainRowHeight,
  },
  label: { flex: 1, minWidth: 0 },
  input: {
    fontFamily: gadgetType.rowTitle.fontFamily,
    fontSize: gadgetType.rowTitle.fontSize,
    fontWeight: gadgetType.rowTitle.fontWeight,
    color: sheetColors.ink,
    fontVariant: ['tabular-nums'],
    height: geo.fieldHeight,
    minWidth: geo.fieldMinWidth,
    padding: 0,
    textAlign: 'right',
  },
  unit: { minWidth: geo.fieldUnit, color: sheetColors.sectionLabel },
  unitFilled: { color: sheetColors.muted },
  accessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: sheetGeometry.controlInset,
    paddingVertical: geo.accessoryPadY,
    borderTopWidth: 1,
    borderTopColor: sheetColors.rule,
  },
  accessoryButton: {
    height: sheetGeometry.control,
    paddingHorizontal: sheetGeometry.controlPadX,
    borderRadius: sheetGeometry.control / 2,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessoryPressed: { backgroundColor: sheetColors.cardRaised },
  accessoryInk: { color: signal.orange },
});
