import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * SPEC measures everything in a 390 × 844 frame whose status bar is 47 tall (iPhone 14). A
 * y measured from that frame's top becomes `insets.top + (y − REFERENCE_SAFE_TOP)` on any phone.
 */
export const REFERENCE_WIDTH = 390;
export const REFERENCE_SAFE_TOP = 47;

/** A y from the reference frame's top, moved under this phone's safe area. */
export function fromReferenceTop(y: number, insetsTop: number): number {
  return insetsTop + y - REFERENCE_SAFE_TOP;
}

/** `fromReferenceTop` for the current phone. */
export function useReferenceTop(): (y: number) => number {
  const { top } = useSafeAreaInsets();
  return (y: number) => fromReferenceTop(y, top);
}
