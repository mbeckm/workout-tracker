import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { STACK_FONT_SCALE } from '@/components/lift-row';
import { fontScaleCap, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import { formatPlanMetric } from '@/domain/helpers';
import { prescriptionFields, type PrescriptionField } from '@/domain/prescription-fields';
import type { ExercisePrescription } from '@/domain/types';
import { DURATION, EASE_IN_OUT, EASE_OUT, ENTER_OFFSET } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/** Expand / collapse in place (trim-ui §8): `enter`, ease-in-out. */
export const LIST_LAYOUT = LinearTransition.duration(DURATION.enter).easing(EASE_IN_OUT);

/** Home's row height (`LiftRow`): a 44pt touch target plus the air a `title` value needs. */
const ROW_HEIGHT = TOUCH_TARGET + space.tight;

/** `4 × 8` + `reps`, `3 × 30` + `s`, `20` + `min`: the number in `title`, its unit in `caption`. */
export function prescriptionParts(exercise: ExercisePrescription): { value: string; unit: string } {
  const metric = formatPlanMetric(exercise);
  if (metric.endsWith(' reps')) {
    return { value: metric.slice(0, -' reps'.length), unit: 'reps' };
  }
  if (metric.endsWith(' min')) {
    return { value: metric.slice(0, -' min'.length), unit: 'min' };
  }
  if (metric.endsWith('s')) {
    return { value: metric.slice(0, -1), unit: 's' };
  }
  return { value: metric, unit: '' };
}

/**
 * One exercise in the plan editor, drawn like Home's rows (trim-ui §13 Plan detail): `row` name
 * and the prescription in the trailing lane, `4 × 8` in `title` + `reps`, on hairlines. Tap opens
 * its Sets / Reps wells in place, with Remove and Move up / down under them; the lane's number
 * steps aside while the wells show it.
 */
export function PrescriptionRow({
  exercise,
  expanded,
  reduceMotion,
  showSeparator,
  onToggle,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  testID,
}: {
  exercise: ExercisePrescription;
  expanded: boolean;
  reduceMotion: boolean;
  showSeparator: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ExercisePrescription>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_FONT_SCALE;
  const fields = prescriptionFields(exercise);
  const { value, unit } = prescriptionParts(exercise);

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LIST_LAYOUT}
      style={{
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name}, ${formatPlanMetric(exercise).replace(' × ', ' sets of ')}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        testID={testID}
        style={({ pressed }) => ({
          flexDirection: stacked ? 'column' : 'row',
          alignItems: stacked ? 'stretch' : 'center',
          gap: stacked ? space.tight : space.inline,
          minHeight: ROW_HEIGHT,
          paddingVertical: space.related,
          opacity: pressed ? PRESSED_OPACITY : 1,
        })}>
        <Text style={[type.row, stacked ? null : { flex: 1, minWidth: 0 }]} numberOfLines={stacked ? 2 : 1}>
          {exercise.name}
        </Text>
        {expanded ? null : (
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(DURATION.fade) : FadeIn.duration(DURATION.enter).easing(EASE_OUT)}
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.tight, flexShrink: 0 }}>
            <Text style={[type.title, { fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={fontScaleCap.title}>
              {value}
            </Text>
            {unit ? (
              <Text style={type.caption} maxFontSizeMultiplier={fontScaleCap.title}>
                {unit}
              </Text>
            ) : null}
          </Animated.View>
        )}
      </Pressable>
      {expanded ? (
        <Animated.View
          entering={
            reduceMotion
              ? FadeIn.duration(DURATION.fade)
              : FadeInDown.duration(DURATION.enter)
                  .easing(EASE_OUT)
                  .withInitialValues({
                    opacity: 0,
                    transform: [{ translateY: -ENTER_OFFSET }],
                  })
          }
          exiting={
            reduceMotion
              ? FadeOut.duration(DURATION.fade)
              : FadeOutUp.duration(DURATION.exit).easing(EASE_OUT)
          }
          style={{ gap: space.inline, paddingTop: space.tight, paddingBottom: space.related }}>
          <View style={{ flexDirection: 'row', gap: space.inline }}>
            {fields.map((field) => (
              <PrescribeField
                key={field.key}
                field={field}
                exerciseName={exercise.name}
                onCommit={(next) => onChange(field.patch(next))}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.gutter }}>
            <RowAction
              title="Remove"
              accessibilityLabel={`Remove ${exercise.name}`}
              color={colors.systemRed}
              onPress={onRemove}
            />
            {onMoveUp ? (
              <RowAction
                title="Move up"
                accessibilityLabel={`Move ${exercise.name} up`}
                color={colors.label}
                onPress={onMoveUp}
              />
            ) : null}
            {onMoveDown ? (
              <RowAction
                title="Move down"
                accessibilityLabel={`Move ${exercise.name} down`}
                color={colors.label}
                onPress={onMoveDown}
              />
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function RowAction({
  title,
  accessibilityLabel,
  color,
  onPress,
}: {
  title: string;
  accessibilityLabel: string;
  color: string;
  onPress: () => void;
}) {
  const { type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH_TARGET,
        justifyContent: 'center',
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <Text style={[type.caption, { color }]}>{title}</Text>
    </Pressable>
  );
}

function PrescribeField({
  field,
  exerciseName,
  onCommit,
}: {
  field: PrescriptionField;
  exerciseName: string;
  onCommit: (value: number) => void;
}) {
  const { colors, type } = useTheme();
  const { label, value, min, max } = field;
  const maxDigits = String(max).length;
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(String(value));
    }
  }, [value]);

  const commit = (raw: string) => {
    const next = Math.min(max, Math.max(min, parseInt(raw, 10) || min));
    setText(String(next));
    onCommit(next);
  };

  return (
    <View style={{ flex: 1, gap: space.related }}>
      <Text style={type.caption}>{label}</Text>
      <TextInput
        value={text}
        selectionColor={colors.brand}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={`${exerciseName}, ${field.a11yLabel}`}
        accessibilityHint={`${min} to ${max}`}
        maxFontSizeMultiplier={1.3}
        testID={`prescribe-field-${field.key}`}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          commit(text);
        }}
        onChangeText={(next) => {
          const digits = next.replace(/[^0-9]/g, '').slice(0, maxDigits);
          setText(digits);
          const parsed = parseInt(digits, 10);
          if (parsed >= min && parsed <= max) {
            onCommit(parsed);
          }
        }}
        style={{
          ...type.title,
          // No lineHeight on a TextInput: iOS applies it to typed text but not the placeholder.
          lineHeight: undefined,
          height: TOUCH_TARGET,
          paddingVertical: 0,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.secondarySystemBackground,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}
