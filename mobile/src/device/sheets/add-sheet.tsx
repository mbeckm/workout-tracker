import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { catalogKey, recordExerciseSelection } from '@/catalog';
import { plansGeometry as geo } from '@/constants/theme';
import type { ExercisePrescription } from '@/domain/types';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { addExercises, addLiftsTitle, dayDisplayName } from '@/device/plans-model';
import { useWorkoutStore } from '@/store/workout-store';

import { ExercisePicker } from './exercise-picker';
import { PillButton, SheetHeader, SheetScroll, StickyActionBar } from './primitives';

/** The editor's own params, carried through the add sheet so ✕ and Add put it back as it was. */
export function editorParams(params: SheetParams, extra: SheetParams = {}): SheetParams {
  const { planId, via, new: isNew, dirty } = params;
  return { planId, via, new: isNew, dirty, ...extra };
}

/**
 * Add lifts (PA3, screen 23): `Add to Push 1`, the picker in multi mode, and a sticky
 * `Add N lifts` that appends the picked lifts to the day with their catalog sets and reps.
 * ✕ goes back to the editor without adding anything.
 */
export function AddLiftsSheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { plans, editPlan } = useWorkoutStore();
  const plan = plans.find((item) => item.id === params.planId);
  const dayIndex = plan?.days.findIndex((item) => item.id === params.dayId) ?? -1;
  const day = dayIndex >= 0 ? plan?.days[dayIndex] : undefined;
  const [picked, setPicked] = useState<ExercisePrescription[]>([]);

  const takenKeys = new Set((day?.exercises ?? []).map((item) => catalogKey(item)));
  const pickedKeys = new Set(picked.map((item) => catalogKey(item)));

  const back = () => {
    Keyboard.dismiss();
    swapSheet('editor', editorParams(params));
  };

  const toggle = (exercise: ExercisePrescription) => {
    const key = catalogKey(exercise);
    setPicked((current) =>
      current.some((item) => catalogKey(item) === key)
        ? current.filter((item) => catalogKey(item) !== key)
        : [...current, exercise],
    );
  };

  const add = () => {
    if (!plan || !day || picked.length === 0) {
      return;
    }
    Keyboard.dismiss();
    editPlan(plan.id, (current) => addExercises(current, day.id, picked));
    for (const exercise of picked) {
      void recordExerciseSelection(exercise);
    }
    swapSheet('editor', editorParams(params, { dirty: '1', dayId: day.id }));
  };

  return (
    <SheetScroll
      header={
        <SheetHeader
          title={day ? `Add to ${dayDisplayName(day, dayIndex)}` : 'Add lifts'}
          left={{ kind: 'close', onPress: back }}
        />
      }
      actionBar={
        <StickyActionBar>
          <PillButton
            title={addLiftsTitle(picked.length)}
            onPress={add}
            disabled={picked.length === 0}
            style={styles.pill}
            testID="add-lifts"
          />
        </StickyActionBar>
      }>
      <View testID="add-sheet">
        <ExercisePicker mode="multi" pickedKeys={pickedKeys} takenKeys={takenKeys} onToggle={toggle} />
      </View>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  pill: { width: 'auto', paddingHorizontal: geo.pillPadX },
});
