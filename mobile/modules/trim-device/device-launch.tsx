import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType, ReactNode } from 'react';
import { View, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

/** The device finishes (`FinishId` in src/constants/theme.ts). */
type FinishId = '212' | '101' | '707' | '089' | '077' | '777';

export type DeviceLaunchPose = { at: number; y: number; sx: number; sy: number; turn: number };

export type DeviceLaunchProps = {
  /** The finish the body wears; a change mid-flight re-dresses it (photographs the children again). */
  finish: FinishId;
  /** false → true photographs the children and plays; true → false hands back to them. */
  playing: boolean;
  duration: number;
  /** Keyframes, `at` 0–1 of `duration`, `y` on a `poseHeight`-tall screen, `turn` in degrees. */
  pose: readonly DeviceLaunchPose[];
  /** One cubic-bezier `[x1, y1, x2, y2]` per segment of `pose`. */
  curves: readonly (readonly number[])[];
  poseHeight: number;
  /** The body's depth and corner radius (the insert's 44 and 52). */
  depth: number;
  bodyRadius: number;
  /** The slab's first frame is up: the JS device can hide. */
  onSceneReady?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

// Null on web and in builds from before the launch view.
const nativeModule = requireOptionalNativeModule('TrimDeviceLaunch');

/** True when this build can throw the device in 3D. Otherwise the tour's 2D slab stands in. */
export const isDeviceLaunchAvailable = nativeModule != null;

const NativeLaunch: ComponentType<DeviceLaunchProps> | null = isDeviceLaunchAvailable
  ? requireNativeView<DeviceLaunchProps>('TrimDeviceLaunch')
  : null;

/**
 * The tour's launch (decision 85) on the cartridge insert's SceneKit body. It wraps the JS device:
 * idle, a plain container; playing, the device photographed onto a 44 pt deep slab and flown on
 * `pose`. Without the native view, a plain `View`.
 */
export function DeviceLaunch({ children, style, ...props }: DeviceLaunchProps) {
  if (NativeLaunch == null) {
    return <View style={style}>{children}</View>;
  }
  return (
    <NativeLaunch {...props} style={style}>
      {children}
    </NativeLaunch>
  );
}
