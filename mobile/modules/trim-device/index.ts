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
  | 'swatch';

export type ContinuousPattern = 'holdFinish';

/** SPEC §9. `print` is 18 stepper ticks 100 ms apart, played natively. */
export type DeviceSound = 'cartridge' | 'print' | 'stamp' | 'key';

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
  restGo: success,
  finishComplete: success,
  receiptPrint: ignore,
  stamp: () => impact(Haptics.ImpactFeedbackStyle.Heavy),
  cartridgeClick: () => {
    impact(Haptics.ImpactFeedbackStyle.Rigid);
    setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Heavy), 65);
  },
  dayTick: selection,
  swatch: selection,
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
} from './cartridge-insert';
