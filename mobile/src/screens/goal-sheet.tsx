import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { PaperGrabber } from '@/components/paper';
import { showToast } from '@/components/toast';
import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, space, TOUCH_TARGET } from '@/constants/theme';
import {
  currentOneRM,
  goalForLift,
  goalStep,
  MAX_PINNED_GOALS,
  pinnedGoals,
  suggestedGoalTarget,
} from '@/domain/goals';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

/** Lets the sheet finish closing before the toast rises over Progress. */
const TOAST_DELAY_MS = 280;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `100`, `102.5`: the well's text. */
function formatTarget(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function parseTarget(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The goal sheet (trim-ui §13 Goals): a native form sheet with the lift as title, its current
 * estimated 1RM as a fact, one `hero` well pre-filled with the next round number above it,
 * `Pin to Progress` (with 3 pinned: `Replace on Progress`, choosing which pinned goal to swap
 * out), and ink `Set goal` at the thumb. Editing adds a red `Remove goal`, immediate with Undo.
 */
export function GoalSheetScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string | string[]; next?: string | string[] }>();
  const name = firstParam(params.name) ?? '';
  // `Set next goal` on a reached goal: the next round number above where the lift is now.
  const next = firstParam(params.next) === '1';
  const { goals, workoutHistory, units, setGoal, removeGoal, restoreGoal } = useWorkoutStore();
  const existing = goalForLift(goals, name);
  const current = useMemo(() => currentOneRM(name, workoutHistory), [name, workoutHistory]);
  const step = goalStep(units);

  const [text, setText] = useState(() =>
    formatTarget(
      existing && !next
        ? existing.target
        : suggestedGoalTarget(Math.max(current ?? 0, next && existing ? existing.target : 0), units),
    ),
  );
  const target = parseTarget(text);

  // Pinned goals other than this one: with 3 of them, pinning means replacing one.
  const others = pinnedGoals(goals).filter((goal) => goal.id !== existing?.id);
  const full = others.length >= MAX_PINNED_GOALS;
  const [pin, setPin] = useState(() => (existing ? existing.pinned : !full));
  const [replaceId, setReplaceId] = useState<string | null>(null);

  // A goal is something to reach: it sits above where the lift is now.
  const valid =
    target != null && (current == null || target > current || (!next && existing?.target === target));

  const nudge = (direction: 1 | -1) => {
    const base = target ?? suggestedGoalTarget(current, units);
    const next = direction > 0 ? Math.floor(base / step) * step + step : Math.ceil(base / step) * step - step;
    setText(formatTarget(Math.max(step, next)));
  };

  const save = () => {
    if (!valid || target == null) {
      return;
    }
    Keyboard.dismiss();
    const replacing = full && pin ? (replaceId ?? others[0]?.id ?? null) : null;
    setGoal({ exerciseName: name, target, pinned: pin, replaceId: replacing });
    router.back();
  };

  const remove = () => {
    if (!existing) {
      return;
    }
    const removed = removeGoal(existing.id);
    router.back();
    if (removed) {
      setTimeout(
        () => showToast({ title: 'Goal removed', onUndo: () => restoreGoal(removed) }),
        TOAST_DELAY_MS,
      );
    }
  };

  const unit = units;

  return (
    <>
      <Stack.Screen options={{ title: `${name} goal` }} />
      {/* A fit-to-contents form sheet takes one non-collapsable view (AGENTS.md → formSheet). */}
      <Pressable
        collapsable={false}
        accessible={false}
        onPress={Keyboard.dismiss}
        style={{ paddingHorizontal: space.gutter, paddingTop: space.gutter, gap: space.gutter }}>
        <PaperGrabber overlay />
        <View style={{ gap: space.tight }}>
          <Text style={type.title} accessibilityRole="header" numberOfLines={2}>
            {name}
          </Text>
          {current != null ? (
            <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]} testID="goal-current">
              {`Now ${formatTarget(Math.round(current))} ${unit}`}
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
              accessibilityLabel={`Goal, ${unit === 'lbs' ? 'pounds' : 'kilograms'}`}
              selectionColor={colors.label}
              maxFontSizeMultiplier={fontScaleCap.display}
              testID="goal-target"
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

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.inline, minHeight: TOUCH_TARGET }}>
            <Text style={[type.row, { flex: 1 }]}>{full ? 'Replace on Progress' : 'Pin to Progress'}</Text>
            <Switch
              value={pin}
              onValueChange={(value) => {
                setPin(value);
                if (value && full && replaceId == null) {
                  setReplaceId(others[0]?.id ?? null);
                }
              }}
              trackColor={{ true: colors.brand }}
              testID="goal-pin"
            />
          </View>
          {full && pin
            ? others.map((goal, index) => {
                const chosen = (replaceId ?? others[0]?.id) === goal.id;
                return (
                  <Pressable
                    key={goal.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: chosen }}
                    onPress={() => setReplaceId(goal.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.inline,
                      minHeight: TOUCH_TARGET,
                      borderTopWidth: index === 0 ? StyleSheet.hairlineWidth : 0,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.separator,
                      opacity: pressed ? PRESSED_OPACITY : 1,
                    })}>
                    <SymbolView
                      name={chosen ? 'checkmark.circle.fill' : 'circle'}
                      size={iconSize.row}
                      tintColor={chosen ? colors.brand : colors.tertiaryLabel}
                    />
                    <Text style={[type.row, { flex: 1 }]} numberOfLines={1}>
                      {goal.exerciseName}
                    </Text>
                    <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>
                      {`${formatTarget(goal.target)} ${unit}`}
                    </Text>
                  </Pressable>
                );
              })
            : null}
          {existing && !next ? (
            <Pressable
              accessibilityRole="button"
              onPress={remove}
              testID="goal-remove"
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
        </View>

        <Button title="Set goal" variant="black" disabled={!valid} onPress={save} testID="goal-save" />
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
