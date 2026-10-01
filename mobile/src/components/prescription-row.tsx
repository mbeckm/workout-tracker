import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { STACK_FONT_SCALE } from '@/components/lift-row';
import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import { formatPlanMetric } from '@/domain/helpers';
import { prescriptionFields, type PrescriptionField } from '@/domain/prescription-fields';
import type { ExercisePrescription } from '@/domain/types';
import { DURATION, EASE_IN_OUT, EASE_OUT, ENTER_OFFSET, SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/** Expand / collapse in place (trim-ui §8): `enter`, ease-in-out. */
export const LIST_LAYOUT = LinearTransition.duration(DURATION.enter).easing(EASE_IN_OUT);

/** Home's row height (`LiftRow`): a 44pt touch target plus the air a `title` value needs. */
const ROW_HEIGHT = TOUCH_TARGET + space.tight;
/** How far a row travels left before letting go removes it (or a flick that would get there). */
const REMOVE_TRAVEL = 96;
/** The highlight on a row that just arrived from the picker: hold, then dissolve. */
const ARRIVAL_HOLD_MS = 500;
const ARRIVAL_FADE_MS = 700;

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

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
 * its wells in place (the log's well: the number to type, − / + under it), with Move up / down;
 * swipe left removes it (with Undo). `arrived`: it just came from the picker, so it lights up
 * once like a new Plans row.
 */
export function PrescriptionRow({
  exercise,
  expanded,
  reduceMotion,
  showSeparator,
  arrived = false,
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
  arrived?: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ExercisePrescription>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale >= STACK_FONT_SCALE;
  const fields = prescriptionFields(exercise);
  const { value, unit } = prescriptionParts(exercise);

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const glow = useSharedValue(arrived ? 1 : 0);

  useEffect(() => {
    if (!arrived) {
      return;
    }
    glow.set(1);
    glow.set(
      withDelay(
        ARRIVAL_HOLD_MS,
        withTiming(0, { duration: ARRIVAL_FADE_MS, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
      ),
    );
  }, [arrived, glow]);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        // Leftward only, and only once it's clearly sideways, so the page still scrolls.
        .activeOffsetX(-12)
        .failOffsetX(12)
        .failOffsetY([-12, 12])
        .enabled(!expanded)
        .onStart(() => {
          startX.set(translateX.get());
        })
        .onUpdate((event) => {
          translateX.set(Math.min(0, startX.get() + event.translationX));
        })
        .onEnd((event) => {
          const projected = translateX.get() + project(event.velocityX);
          if (projected < -REMOVE_TRAVEL) {
            translateX.set(
              withTiming(-width, { duration: DURATION.exit, easing: EASE_OUT }, (finished) => {
                if (finished) {
                  scheduleOnRN(onRemove);
                }
              }),
            );
            return;
          }
          translateX.set(withSpring(0, { ...SPRING.fling, velocity: event.velocityX }));
        }),
    [expanded, onRemove, startX, translateX, width],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.get() }] }));
  const trashStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, -translateX.get() / REMOVE_TRAVEL),
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const a11yActions = [
    { name: 'activate', label: expanded ? 'Close' : 'Edit sets and reps' },
    { name: 'remove', label: 'Remove' },
    ...(onMoveUp ? [{ name: 'moveUp', label: 'Move up' }] : []),
    ...(onMoveDown ? [{ name: 'moveDown', label: 'Move down' }] : []),
  ];
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'remove':
        onRemove();
        break;
      case 'moveUp':
        onMoveUp?.();
        break;
      case 'moveDown':
        onMoveDown?.();
        break;
      default:
        onToggle();
    }
  };

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LIST_LAYOUT}
      style={{
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      {/* What a left swipe uncovers: the red trash, at the trailing edge. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            justifyContent: 'center',
          },
          trashStyle,
        ]}>
        {expanded ? null : <SymbolView name="trash" size={iconSize.row} weight="medium" tintColor={colors.systemRed} />}
      </Animated.View>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ backgroundColor: colors.systemBackground }, rowStyle]}>
          {/* The arrival highlight sits under the content, edge to edge like a list row's. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: -space.margin,
                right: -space.margin,
                backgroundColor: colors.systemGray5,
              },
              glowStyle,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${exercise.name}, ${formatPlanMetric(exercise).replace(' × ', ' sets of ')}`}
            accessibilityState={{ expanded }}
            accessibilityActions={a11yActions}
            onAccessibilityAction={onAccessibilityAction}
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
                      .withInitialValues({ opacity: 0, transform: [{ translateY: -ENTER_OFFSET }] })
              }
              exiting={reduceMotion ? FadeOut.duration(DURATION.fade) : FadeOutUp.duration(DURATION.exit).easing(EASE_OUT)}
              style={{ gap: space.related, paddingTop: space.tight, paddingBottom: onMoveUp || onMoveDown ? 0 : space.inset }}>
              <View style={{ flexDirection: 'row', gap: space.inline }}>
                {fields.map((field) => (
                  <PrescribeWell
                    key={field.key}
                    field={field}
                    exerciseName={exercise.name}
                    onCommit={(next) => onChange(field.patch(next))}
                  />
                ))}
              </View>
              {onMoveUp || onMoveDown ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.gutter }}>
                  {onMoveUp ? (
                    <RowAction title="Move up" accessibilityLabel={`Move ${exercise.name} up`} onPress={onMoveUp} />
                  ) : null}
                  {onMoveDown ? (
                    <RowAction title="Move down" accessibilityLabel={`Move ${exercise.name} down`} onPress={onMoveDown} />
                  ) : null}
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function RowAction({
  title,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
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
      <Text style={[type.caption, { color: colors.label }]}>{title}</Text>
    </Pressable>
  );
}

/**
 * The log's well, sized for an editor (trim-ui §13 Log: type to jump, tap ± to nudge): the
 * number in `title` to type into, − / + under it in steps of 1.
 */
function PrescribeWell({
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

  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, (parseInt(text, 10) || value) + delta));
    setText(String(next));
    onCommit(next);
  };

  const stepperStyle = ({ pressed }: { pressed: boolean }) => ({
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    opacity: pressed ? PRESSED_OPACITY : 1,
  });

  return (
    <View style={{ flex: 1, gap: space.related }}>
      <Text style={type.caption} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <View
        style={{
          borderRadius: radius.md,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: colors.secondarySystemBackground,
        }}>
        <TextInput
          value={text}
          selectionColor={colors.brand}
          keyboardType="number-pad"
          selectTextOnFocus
          accessibilityLabel={`${exerciseName}, ${field.a11yLabel}`}
          accessibilityHint={`${min} to ${max}`}
          maxFontSizeMultiplier={fontScaleCap.title}
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
            height: TOUCH_TARGET + space.tight,
            paddingVertical: 0,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
            color: colors.label,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            minHeight: TOUCH_TARGET,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.systemGray4,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Fewer ${field.a11yLabel}`}
            onPress={() => nudge(-1)}
            style={stepperStyle}>
            <Text style={[type.caption, { color: colors.secondaryLabel }]}>−</Text>
          </Pressable>
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.systemGray4 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More ${field.a11yLabel}`}
            onPress={() => nudge(1)}
            style={stepperStyle}>
            <Text style={[type.caption, { color: colors.secondaryLabel }]}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
