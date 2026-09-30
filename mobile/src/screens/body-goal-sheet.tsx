import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Button } from '@/components/button';
import { formatGoalValue } from '@/components/goal-block';
import { PaperGrabber } from '@/components/paper';
import { showToast } from '@/components/toast';
import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import {
  bodyGoalFor,
  bodyGoalForDisplay,
  bodyGoalFromDisplay,
  bodyGoalStep,
  latestBodyValue,
} from '@/domain/body-goals';
import { BODY_METRICS, type BodyMetricKey } from '@/domain/check-in';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/** Lets the sheet finish closing before the toast rises over body detail. */
const TOAST_DELAY_MS = 280;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseTarget(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The goal sheet for a body measurement (trim-ui §13 Goals, PRODUCT-DECISIONS 65): the lift goal
 * sheet's form without pinning. The measurement as title, where it is now as a fact, one `hero`
 * well pre-filled with it, − / + in the metric's step, and ink `Set goal`. A target under now aims
 * down, over it up; the goal takes its direction from that, so nothing asks. Editing adds a red
 * `Remove goal`, immediate with Undo.
 */
export function BodyGoalSheetScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ metric?: string | string[]; next?: string | string[] }>();
  const metricKey = firstParam(params.metric) as BodyMetricKey;
  const label = BODY_METRICS.find((item) => item.key === metricKey)?.label ?? 'Body';
  const next = firstParam(params.next) === '1';
  const { bodyGoals, bodyCheckIns, units, setBodyGoal, removeBodyGoal, restoreBodyGoal } = useWorkoutStore();
  const existing = bodyGoalFor(bodyGoals, metricKey);
  const stored = latestBodyValue(bodyCheckIns, metricKey);
  const current = stored != null ? bodyGoalForDisplay(metricKey, stored, units) : null;
  const unit = metricKey === 'bodyweightKg' ? units : 'cm';
  const step = bodyGoalStep(metricKey, units);

  const [text, setText] = useState(() => {
    if (existing && !next) {
      return formatGoalValue(bodyGoalForDisplay(metricKey, existing.target, units));
    }
    return current != null ? formatGoalValue(Math.round(current / step) * step) : '';
  });
  const target = parseTarget(text);

  // A goal is somewhere else than now; keeping the current target is fine while editing.
  const unchanged =
    existing != null && !next && target === Number(formatGoalValue(bodyGoalForDisplay(metricKey, existing.target, units)));
  const valid = stored != null && target != null && (unchanged || target !== Number(formatGoalValue(current ?? 0)));

  const nudge = (direction: 1 | -1) => {
    const base = target ?? current ?? step;
    const value = direction > 0 ? Math.floor(base / step) * step + step : Math.ceil(base / step) * step - step;
    setText(formatGoalValue(Math.max(step, value)));
  };

  const save = () => {
    if (!valid || target == null || stored == null) {
      return;
    }
    Keyboard.dismiss();
    if (!unchanged) {
      setBodyGoal({ metric: metricKey, target: bodyGoalFromDisplay(metricKey, target, units), start: stored });
    }
    router.back();
  };

  const remove = () => {
    if (!existing) {
      return;
    }
    const removed = removeBodyGoal(existing.id);
    router.back();
    if (removed) {
      setTimeout(
        () => showToast({ title: 'Goal removed', onUndo: () => restoreBodyGoal(removed) }),
        TOAST_DELAY_MS,
      );
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: `${label} goal` }} />
      {/* A fit-to-contents form sheet takes one non-collapsable view (AGENTS.md → formSheet). */}
      <Pressable
        collapsable={false}
        accessible={false}
        onPress={Keyboard.dismiss}
        style={{ paddingHorizontal: space.gutter, paddingTop: space.gutter, gap: space.gutter }}>
        <PaperGrabber overlay />
        <View style={{ gap: space.tight }}>
          <Text style={type.title} accessibilityRole="header" numberOfLines={2}>
            {label}
          </Text>
          {current != null ? (
            <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]} testID="body-goal-current">
              {`Now ${formatGoalValue(current)} ${unit}`}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.secondarySystemBackground,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: space.related,
              paddingVertical: space.inset,
            }}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel={`Goal, ${unit === 'lbs' ? 'pounds' : unit === 'kg' ? 'kilograms' : 'centimeters'}`}
              selectionColor={colors.brand}
              maxFontSizeMultiplier={fontScaleCap.display}
              testID="body-goal-target"
              // No lineHeight on a TextInput (AGENTS.md): the placeholder and typed text differ.
              style={{
                fontSize: type.hero.fontSize,
                fontWeight: type.hero.fontWeight,
                letterSpacing: type.hero.letterSpacing,
                color: colors.label,
                fontVariant: ['tabular-nums'],
                padding: 0,
                textAlign: 'center',
              }}
            />
            <Text style={type.title} maxFontSizeMultiplier={fontScaleCap.title}>
              {unit}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.separator,
            }}>
            <Nudge label="−" spoken={`Minus ${step}`} onPress={() => nudge(-1)} />
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
            <Nudge label="+" spoken={`Plus ${step}`} onPress={() => nudge(1)} />
          </View>
        </View>

        {existing && !next ? (
          <Pressable
            accessibilityRole="button"
            onPress={remove}
            testID="body-goal-remove"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.inline,
              minHeight: TOUCH_TARGET,
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}>
            <SymbolView name="trash" size={iconSize.row} weight="medium" tintColor={colors.systemRed} />
            <Text style={[type.row, { color: colors.systemRed }]}>Remove goal</Text>
          </Pressable>
        ) : null}

        <Button title="Set goal" variant="black" disabled={!valid} onPress={save} testID="body-goal-save" />
      </Pressable>
    </>
  );
}

function Nudge({ label, spoken, onPress }: { label: string; spoken: string; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <Text style={[type.title, { color: colors.secondaryLabel }]}>{label}</Text>
    </Pressable>
  );
}
