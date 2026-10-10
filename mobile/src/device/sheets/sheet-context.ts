import { createContext, useContext } from 'react';
import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

/** What the host hands the sheet it's showing (scroll hand-off, focus, close). */
export type SheetChrome = {
  /** The content's scroll offset: the swipe-down only takes over at the top. */
  scrollY: SharedValue<number>;
  /** The content's native scroll gesture, recognised alongside the host's pan. */
  scrollGesture: GestureType;
  /** Bumps on every open and swap, so the header takes VoiceOver focus again. */
  focusKey: number;
  /** Closes the sheet (✕, Done). */
  close: () => void;
  /** The sheet lifts its content above the keyboard (name fields, search). */
  keyboard: boolean;
  /** Bottom-anchored sheets only: the content's full height, so the sheet fits it. */
  fit?: (height: number) => void;
};

export const SheetChromeContext = createContext<SheetChrome | null>(null);

export function useSheetChrome(): SheetChrome {
  const value = useContext(SheetChromeContext);
  if (!value) {
    throw new Error('Sheet primitives must render inside SheetHost');
  }
  return value;
}
