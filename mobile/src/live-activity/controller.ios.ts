import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';

import type { WorkoutActivityProps } from '../../widgets/workout-activity-props';
import type { WorkoutLiveActivitySync } from './types';
import { workoutLogUrl } from './url';

const FOCUS_KEY = 'scratchWorkout.liveActivityFocus.v1';

type LiveActivityHandle = {
  update(props: WorkoutActivityProps): Promise<void>;
  end(dismissalPolicy: 'immediate'): Promise<void>;
};

type WorkoutActivityFactory = {
  start(props: WorkoutActivityProps, url?: string): LiveActivityHandle;
  getInstances(): LiveActivityHandle[];
};

let native:
  | {
      widgetsDirectory: string;
      WorkoutActivity: WorkoutActivityFactory;
    }
  | null
  | undefined;
let instance: LiveActivityHandle | null = null;
let focus: { planId: string; dayId: string; exerciseId: string } | null = null;
let syncGeneration = 0;
let startedExerciseId: string | null = null;

function nativeWidgets() {
  if (native !== undefined) {
    return native;
  }
  if (!requireOptionalNativeModule('ExpoWidgets')) {
    native = null;
    return null;
  }
  try {
    const widgets: { widgetsDirectory: string } = require('expo-widgets');
    const workout: { default: WorkoutActivityFactory } = require('../../widgets/WorkoutActivity');
    native = {
      widgetsDirectory: widgets.widgetsDirectory,
      WorkoutActivity: workout.default,
    };
  } catch (error) {
    console.warn('[live-activity] failed to load WorkoutActivity', error);
    native = null;
  }
  return native;
}

function rememberFocus(next: { planId: string; dayId: string; exerciseId: string }) {
  focus = next;
  void AsyncStorage.setItem(FOCUS_KEY, JSON.stringify(next));
}

function clearFocus() {
  focus = null;
  void AsyncStorage.removeItem(FOCUS_KEY);
}

function safeFileToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
}

function imageFileName(exerciseId: string, url: string): string {
  const ext = /\.gif(?:$|[?#])/i.test(url) ? 'gif' : 'jpg';
  return `${safeFileToken(exerciseId)}.${ext}`;
}

async function stageExerciseImage(
  widgetsDirectory: string,
  exerciseId: string,
  url: string,
): Promise<string | undefined> {
  if (!widgetsDirectory) {
    return undefined;
  }
  const directory = new Directory(widgetsDirectory);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  const file = new File(directory, imageFileName(exerciseId, url));
  if (!file.exists) {
    await File.downloadFileAsync(url, file, { idempotent: true });
  }
  return file.uri;
}

function toProps(input: WorkoutLiveActivitySync, imageUri: string | undefined): WorkoutActivityProps {
  const rest = input.rest != null && input.rest.endsAtMs > Date.now() ? input.rest : null;
  return {
    exerciseName: input.exerciseName,
    exerciseImageUri: imageUri,
    openUrl: workoutLogUrl({
      planId: input.planId,
      dayId: input.dayId,
      exerciseId: input.exerciseId,
    }),
    isResting: rest != null,
    restStartEpochMs: rest?.startedAtMs ?? 0,
    restEndEpochMs: rest?.endsAtMs ?? 0,
  };
}

export async function syncWorkoutLiveActivity(input: WorkoutLiveActivitySync): Promise<void> {
  const widgets = nativeWidgets();
  if (!widgets) {
    return;
  }

  const generation = syncGeneration + 1;
  syncGeneration = generation;
  rememberFocus({ planId: input.planId, dayId: input.dayId, exerciseId: input.exerciseId });

  let imageUri: string | undefined;
  if (input.imageURL) {
    try {
      imageUri = await stageExerciseImage(widgets.widgetsDirectory, input.exerciseId, input.imageURL);
    } catch {
      imageUri = undefined;
    }
  }
  if (generation !== syncGeneration) {
    return;
  }

  const props = toProps(input, imageUri);
  try {
    const existing = instance ?? widgets.WorkoutActivity.getInstances()[0] ?? null;
    // ActivityKit's tap URL is fixed at start(). Restart when the exercise changes so
    // Lock Screen / Island taps open the current exercise, not the first one.
    if (existing && startedExerciseId != null && startedExerciseId !== input.exerciseId) {
      try {
        await existing.end('immediate');
      } catch {
      }
      instance = null;
      startedExerciseId = null;
    } else if (existing) {
      instance = existing;
      await existing.update(props);
      return;
    }
    instance = widgets.WorkoutActivity.start(props, props.openUrl);
    startedExerciseId = input.exerciseId;
  } catch (error) {
    console.warn('[live-activity] start/update failed', error);
    instance = null;
    startedExerciseId = null;
  }
}

export async function endWorkoutLiveActivity(): Promise<void> {
  const current = instance;
  instance = null;
  startedExerciseId = null;
  clearFocus();
  const widgets = nativeWidgets();
  if (!widgets) {
    return;
  }
  try {
    await current?.end('immediate');
    await Promise.all(widgets.WorkoutActivity.getInstances().map((activity) => activity.end('immediate')));
  } catch {
  }
}

export function peekWorkoutFocus(planId: string, dayId: string): string | undefined {
  if (focus?.planId === planId && focus.dayId === dayId) {
    return focus.exerciseId;
  }
  return undefined;
}

export function rememberWorkoutFocus(next: {
  planId: string;
  dayId: string;
  exerciseId: string;
}): void {
  rememberFocus(next);
}

export async function loadWorkoutFocus(
  planId: string,
  dayId: string,
): Promise<string | undefined> {
  const memory = peekWorkoutFocus(planId, dayId);
  if (memory) {
    return memory;
  }
  try {
    const raw = await AsyncStorage.getItem(FOCUS_KEY);
    if (!raw) {
      return undefined;
    }
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored == null) {
      return undefined;
    }
    if (!('planId' in stored) || !('dayId' in stored) || !('exerciseId' in stored)) {
      return undefined;
    }
    if (stored.planId !== planId || stored.dayId !== dayId || typeof stored.exerciseId !== 'string') {
      return undefined;
    }
    focus = { planId, dayId, exerciseId: stored.exerciseId };
    return stored.exerciseId;
  } catch {
  }
  return undefined;
}
