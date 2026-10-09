import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';

/** SPEC §8, named Core Haptics patterns (keep in step with `buildPatterns` in the Swift module). */
export type HapticPattern =
  | 'wheelNotch'
  | 'wheelNotchMajor'
  | 'key'
  | 'bigKeyPress'
  | 'logSet'
  | 'rockerMove'
  | 'restGo'
  | 'finishComplete'
  | 'receiptPrint'
  | 'stamp'
  | 'cartridgeClick'
  | 'dayTick'
  | 'swatch'
  | 'wheelStop'
  | 'assemblySnap'
  | 'assemblyArrive'
  | 'assemblyBang'
  | 'displayTap'
  | 'planReady';

export type ContinuousPattern = 'holdFinish' | 'assemblyCharge' | 'assemblyApproach';

/** First open (D74): the parts snap on a whole step higher each time. */
export type SnapSound = 'snap-1' | 'snap-2' | 'snap-3' | 'snap-4' | 'snap-5' | 'snap-6' | 'snap-7';

/** SPEC §9. `print` is 18 stepper ticks 100 ms apart, played natively. */
export type DeviceSound =
  | 'cartridge'
  | 'print'
  | 'stamp'
  | 'key'
  | 'press'
  | 'rocker'
  | 'notch'
  | 'swatch'
  | 'blip'
  | 'ready'
  | 'alarm'
  | 'arrive'
  | 'charge'
  | 'bang'
  | 'boot'
  | 'spin'
  | 'pulse'
  | 'reskin'
  | SnapSound;

type TrimDeviceNative = {
  supportsHaptics: boolean;
  play(pattern: HapticPattern): void;
  startContinuous(pattern: ContinuousPattern): void;
  stopContinuous(): void;
  playSound(name: DeviceSound): void;
};

// Null on web, Android and dev builds from before the module: then expo-haptics stands in.
const native = requireOptionalNativeModule<TrimDeviceNative>('TrimDevice');

const ignore = () => undefined;
const selection = () => void Haptics.selectionAsync().catch(ignore);
const impact = (style: Haptics.ImpactFeedbackStyle) =>
  void Haptics.impactAsync(style).catch(ignore);
const success = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);

/** SPEC §8's Fallback column. */
const FALLBACK: Record<HapticPattern, () => void> = {
  wheelNotch: selection,
  wheelNotchMajor: selection,
  key: () => impact(Haptics.ImpactFeedbackStyle.Light),
  bigKeyPress: () => impact(Haptics.ImpactFeedbackStyle.Medium),
  logSet: () => impact(Haptics.ImpactFeedbackStyle.Rigid),
  rockerMove: () => impact(Haptics.ImpactFeedbackStyle.Light),
  // Beep-beep … beep-beep, like the native alarm.
  restGo: () => {
    for (const at of [0, 140, 500, 640]) {
      setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Heavy), at);
    }
  },
  finishComplete: success,
  receiptPrint: ignore,
  stamp: () => impact(Haptics.ImpactFeedbackStyle.Heavy),
  cartridgeClick: () => {
    impact(Haptics.ImpactFeedbackStyle.Rigid);
    setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Heavy), 65);
  },
  dayTick: selection,
  swatch: selection,
  wheelStop: () => impact(Haptics.ImpactFeedbackStyle.Heavy),
  assemblySnap: () => impact(Haptics.ImpactFeedbackStyle.Rigid),
  assemblyArrive: () => impact(Haptics.ImpactFeedbackStyle.Soft),
  displayTap: selection,
  planReady: success,
  assemblyBang: () => {
    impact(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Medium), 110);
  },
};

/** Hold to finish's ramp length (SPEC §8); the fallback lands its heavy impact here. */
const HOLD_FINISH_MS = 1100;
let holdTimer: ReturnType<typeof setTimeout> | null = null;

function clearHoldTimer() {
  if (holdTimer != null) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

/** True when the Swift module is in this build (Core Haptics and sounds). */
export const isNativeDeviceAvailable = native != null;

export function play(pattern: HapticPattern): void {
  if (native) {
    native.play(pattern);
  } else {
    FALLBACK[pattern]();
  }
}

/** Starts a continuous pattern; `stopContinuous` (release) cancels it. */
export function startContinuous(pattern: ContinuousPattern): void {
  if (native) {
    native.startContinuous(pattern);
    return;
  }
  // The first-open swells have no fallback: the hits around them say it all.
  if (pattern === 'assemblyCharge' || pattern === 'assemblyApproach') return;
  clearHoldTimer();
  impact(Haptics.ImpactFeedbackStyle.Soft);
  holdTimer = setTimeout(() => {
    holdTimer = null;
    impact(Haptics.ImpactFeedbackStyle.Heavy);
  }, HOLD_FINISH_MS);
}

export function stopContinuous(): void {
  if (native) {
    native.stopContinuous();
  } else {
    clearHoldTimer();
  }
}

/** No sound without the native module. Callers check the Sounds setting (`useSounds`). */
export function playSound(name: DeviceSound): void {
  native?.playSound(name);
}

export {
  CartridgeInsert,
  isCartridgeInsertAvailable,
  type CartridgeInsertLayout,
  type CartridgeInsertProps,
  type CartridgeInsertScreen,
} from './cartridge-insert';
export { DeviceLaunch, isDeviceLaunchAvailable, type DeviceLaunchPose, type DeviceLaunchProps } from './device-launch';

export { canRecognizeText, prepareImageForUpload, recognizeTextInImage } from './text';
