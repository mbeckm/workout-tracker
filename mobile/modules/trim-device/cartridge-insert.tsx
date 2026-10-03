import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** The device finishes (`FinishId` in src/constants/theme.ts). */
type FinishId = '212' | '101' | '305' | '408';

/** Optional positions measured from the JS device, so the last frame lines up with it. */
export type CartridgeInsertLayout = {
  topRowY?: number;
  displayY?: number;
  displayHeight?: number;
  wellY?: number;
};

export type CartridgeInsertProps = {
  /** The device's finish (body colours). */
  finish: FinishId;
  /** Printed on the cartridge label and on the display once loaded. */
  planName: string;
  /** Day titles: the label's list, the lamp count and `0/n`. */
  days: string[];
  /** false → true plays from the start; true → false resets to the first frame. */
  playing: boolean;
  /** Skip the moment: land on the end state and fire both events at once (SPEC §7). */
  reduceMotion: boolean;
  /** The Sounds setting (D14). The click haptic always plays. Default true. */
  soundsOn?: boolean;
  /** Safe-area insets, for SPEC §4's layout rule (defaults: 47 / 34, the reference frame). */
  safeTop?: number;
  safeBottom?: number;
  deviceLayout?: CartridgeInsertLayout;
  /**
   * The art is drawn (it renders off the main thread) and the first frame is up. Until then
   * the view is transparent and the clock waits, so mount it over the JS device and hide that
   * device here.
   */
  onSceneReady?: () => void;
  /** Exactly at the click (≈1780 ms): the cartridge seats, the haptic and sound play natively. */
  onSeated?: () => void;
  /** After the swing back (≈3000 ms), or right after `onSeated` when skipped. */
  onFinished?: () => void;
  /** Dev only: freeze the timeline at this many ms (no events). */
  pauseAt?: number;
  /** Dev only: timeline speed (0.25 = four times slower). */
  speed?: number;
  style?: StyleProp<ViewStyle>;
};

// The module exists only in native builds from Phase 9 on: null on web and in older dev builds.
const nativeModule = requireOptionalNativeModule('TrimCartridgeInsert');

/** True when this build has the SceneKit insert. Otherwise use the JS 2.5D fallback (Phase 6). */
export const isCartridgeInsertAvailable = nativeModule != null;

const NativeInsert: ComponentType<CartridgeInsertProps> | null = isCartridgeInsertAvailable
  ? requireNativeView<CartridgeInsertProps>('TrimCartridgeInsert')
  : null;

/**
 * The 3D plan activation (PLAN Phase 9, SPEC §7): full screen, dark grid, the cartridge clicks
 * in. Tapping it skips to the end. Its last frame is the device face-on showing `LOADED`, so
 * the JS device takes over from there. Renders nothing when the native view isn't available.
 */
export function CartridgeInsert(props: CartridgeInsertProps) {
  if (NativeInsert == null) {
    return null;
  }
  return <NativeInsert {...props} />;
}
