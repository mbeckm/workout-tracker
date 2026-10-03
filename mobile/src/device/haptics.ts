import { useCallback } from 'react';

import * as TrimDevice from '../../modules/trim-device';
import type { DeviceSound, HapticPattern } from '../../modules/trim-device';
import { useWorkoutStore } from '@/store/workout-store';

export type { DeviceSound, HapticPattern, SnapSound } from '../../modules/trim-device';

const pattern = (name: HapticPattern) => () => TrimDevice.play(name);

/**
 * The device's haptics (SPEC §8), one call per event. Core Haptics through the TrimDevice
 * module; expo-haptics where it isn't in the build (web, older dev builds).
 */
export const haptics = {
  /** Wheel notch (weight, time, reps). */
  wheelNotch: pattern('wheelNotch'),
  /** Every 5th notch, or a whole 10 kg. */
  wheelNotchMajor: pattern('wheelNotchMajor'),
  key: pattern('key'),
  bigKeyPress: pattern('bigKeyPress'),
  logSet: pattern('logSet'),
  rockerMove: pattern('rockerMove'),
  /** Rest reaches 0:00. */
  restGo: pattern('restGo'),
  finishComplete: pattern('finishComplete'),
  /** 18 ticks 100 ms apart, matching the receipt's feed steps. */
  receiptPrint: pattern('receiptPrint'),
  stamp: pattern('stamp'),
  cartridgeClick: pattern('cartridgeClick'),
  /** A day ticks in while the plan loads. */
  dayTick: pattern('dayTick'),
  swatch: pattern('swatch'),
  /** The onboarding wheel hits 2 or 6 days. */
  wheelStop: pattern('wheelStop'),
  /** First open: a part snaps onto the body. */
  assemblySnap: pattern('assemblySnap'),
  /** First open: the body settles after floating in. */
  assemblyArrive: pattern('assemblyArrive'),
  /** First open: the Start key slams home. */
  assemblyBang: pattern('assemblyBang'),
  /** First open: the rumble while the Start key charges; runs out on its own at the bang. */
  startAssemblyCharge: () => TrimDevice.startContinuous('assemblyCharge'),
  /** First open skipped mid-charge. */
  stopAssemblyCharge: () => TrimDevice.stopContinuous(),
  /** Hold to finish: the ramp starts on press-in. */
  startHoldFinish: () => TrimDevice.startContinuous('holdFinish'),
  /** Release, or the ring closed: cancels the ramp. */
  stopHoldFinish: () => TrimDevice.stopContinuous(),
} as const;

export type DeviceHaptics = typeof haptics;

/** The named patterns. Stable across renders; call them on the JS thread (`scheduleOnRN` from a worklet). */
export function useHaptics(): DeviceHaptics {
  return haptics;
}

/**
 * Plays a device sound (SPEC §9) unless Sounds is off in Settings (D14). The silent switch
 * silences them natively (ambient session). No sound on web or without the module.
 */
export function playDeviceSound(name: DeviceSound, soundsOn: boolean): void {
  if (soundsOn) {
    TrimDevice.playSound(name);
  }
}

/** `play(sound)` that follows the Sounds setting. */
export function useSounds(): (name: DeviceSound) => void {
  const { soundsOn } = useWorkoutStore();
  return useCallback((name: DeviceSound) => playDeviceSound(name, soundsOn), [soundsOn]);
}
