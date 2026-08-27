import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultSnapshot, normalizeSnapshot, type WorkoutSnapshot } from './snapshot';

export type { WorkoutSnapshot } from './snapshot';

const SNAPSHOT_KEY = 'scratchWorkout.appState.v1';

export async function loadSnapshot(): Promise<WorkoutSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }
    return normalizeSnapshot(JSON.parse(raw)) ?? defaultSnapshot;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: WorkoutSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-fatal: Expo Go still runs without storage.
  }
}
