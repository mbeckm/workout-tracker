import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { EditorActionRow } from '@/components/editor-chrome';
import { PaperGrabber } from '@/components/paper';
import { radius, space, TOUCH_TARGET } from '@/constants/theme';
import { clonePrescription, withDay } from '@/domain/helpers';
import { newId, type WorkoutDay, type WorkoutPlan } from '@/domain/types';
import { useUndoableDeletes } from '@/store/undoable-deletes';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The name sheet (trim-ui §10 Rename; PRODUCT-DECISIONS 70): a plan's or a day's name as a text
 * field in a native sheet, saved as the sheet closes (an empty or unchanged name keeps the old
 * one). For a day it also holds the day's own actions, so day controls live with the day and
 * never mix with the plan's (those are the plan editor's `…` menu). `focus=1` opens the keyboard
 * straight away, for Rename.
 */
export function EditSheetScreen() {
  const { colors, type } = useTheme();
  const params = useLocalSearchParams<{ planId?: string; dayId?: string; focus?: string }>();
  const planId = firstParam(params.planId);
  const dayId = firstParam(params.dayId);
  const router = useRouter();
  const navigation = useNavigation();
  const { plans, updatePlan } = useWorkoutStore();
  const { removeDay } = useUndoableDeletes();
  const plan = plans.find((item) => item.id === planId);
  const dayIndex = plan?.days.findIndex((item) => item.id === dayId) ?? -1;
  const day = dayIndex >= 0 ? plan?.days[dayIndex] : undefined;
  const isDay = dayId != null;
  const original = (isDay ? day?.title : plan?.name) ?? '';
  const [name, setName] = useState(original.trim());
  const nameRef = useRef(name);
  const doneRef = useRef(false);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // Save on the way out, however the sheet closes (drag, Return, an action).
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      const latest = planRef.current;
      const next = nameRef.current.trim();
      if (doneRef.current || !latest || !next || next === original.trim()) {
        return;
      }
      if (isDay && dayId) {
        updatePlan(withDay(latest, dayId, (current) => ({ ...current, title: next })));
      } else if (!isDay) {
        updatePlan({ ...latest, name: next });
      }
    });
  }, [dayId, isDay, navigation, original, updatePlan]);

  if (!plan || (isDay && !day)) {
    return <View style={{ flex: 1, backgroundColor: colors.systemBackground }} />;
  }

  // The name edit and the action land as one change, then the sheet closes.
  const withName = (latest: WorkoutPlan): WorkoutPlan => {
    const next = nameRef.current.trim();
    if (!next || next === original.trim() || !dayId) {
      return latest;
    }
    return withDay(latest, dayId, (current) => ({ ...current, title: next }));
  };

  const act = (transform: (latest: WorkoutPlan) => WorkoutPlan) => {
    const latest = planRef.current;
    if (latest) {
      updatePlan(transform(withName(latest)));
    }
    doneRef.current = true;
    router.back();
  };

  const duplicate = () =>
    act((latest) => {
      const index = latest.days.findIndex((item) => item.id === dayId);
      const source = latest.days[index];
      if (!source) {
        return latest;
      }
      const copy: WorkoutDay = {
        id: newId(),
        title: `${source.title.trim() || 'Day'} copy`,
        exercises: source.exercises.map(clonePrescription),
      };
      const days = [...latest.days.slice(0, index + 1), copy, ...latest.days.slice(index + 1)];
      return { ...latest, days, daysPerWeek: days.length };
    });

  const move = (delta: -1 | 1) =>
    act((latest) => {
      const index = latest.days.findIndex((item) => item.id === dayId);
      const to = index + delta;
      if (index < 0 || to < 0 || to >= latest.days.length) {
        return latest;
      }
      const days = [...latest.days];
      [days[index], days[to]] = [days[to], days[index]];
      return { ...latest, days };
    });

  const remove = () => {
    // Removing the day (with Undo): its name edit goes with it.
    const latest = planRef.current;
    doneRef.current = true;
    router.back();
    if (latest && dayId) {
      removeDay(latest, dayId);
    }
  };

  const dayCount = plan.days.length;

  return (
    <View collapsable={false} style={{ paddingHorizontal: space.gutter, paddingTop: space.gutter }}>
      <PaperGrabber overlay />
      <Text style={[type.caption, { paddingBottom: space.related }]}>{isDay ? 'Day name' : 'Plan name'}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus={params.focus === '1'}
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={() => router.back()}
        placeholder={isDay ? `Day ${dayIndex + 1}` : 'New plan'}
        placeholderTextColor={colors.tertiaryLabel}
        selectionColor={colors.brand}
        maxLength={40}
        accessibilityLabel={isDay ? 'Day name' : 'Plan name'}
        testID="edit-sheet-name"
        style={{
          ...type.row,
          // No lineHeight on a TextInput: iOS applies it to typed text but not the placeholder.
          lineHeight: undefined,
          height: TOUCH_TARGET + space.related,
          paddingHorizontal: space.inset,
          paddingVertical: 0,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.secondarySystemBackground,
          color: colors.label,
        }}
      />
      {isDay ? (
        <View style={{ paddingTop: space.inset }}>
          <EditorActionRow title="Duplicate day" symbol="plus.square.on.square" onPress={duplicate} testID="day-duplicate" />
          {dayIndex > 0 ? <EditorActionRow title="Move up" symbol="arrow.up" onPress={() => move(-1)} /> : null}
          {dayIndex < dayCount - 1 ? (
            <EditorActionRow title="Move down" symbol="arrow.down" onPress={() => move(1)} />
          ) : null}
          {dayCount > 1 ? (
            <EditorActionRow title="Remove day" symbol="trash" tone="destructive" onPress={remove} testID="day-remove" />
          ) : null}
        </View>
      ) : null}
      <View style={{ height: space.gutter }} />
      <Stack.Screen options={{ headerShown: false, title: isDay ? 'Day' : 'Plan' }} />
    </View>
  );
}
