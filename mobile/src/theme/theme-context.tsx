// gadget: delete in Phase 10, with the old screens that still call `useTheme`.
import {
  darkColors,
  makeType,
  type AppearancePreference,
  type ColorScheme,
  type ThemeColors,
  type ThemeType,
} from '@/constants/theme';

type ThemeContextValue = {
  appearance: AppearancePreference;
  scheme: ColorScheme;
  colors: ThemeColors;
  type: ThemeType;
};

/**
 * The gadget has no light/dark appearance (PLAN D2): the device's look is its finish, and
 * sheets and moments are always dark. The screens not yet ported (onboarding, the paywall, the
 * old routes) still read colours through `useTheme`, so it returns the dark palette, always.
 * Never call `Appearance.setColorScheme`: it changes the window, alerts included.
 */
const DARK: ThemeContextValue = {
  appearance: 'dark',
  scheme: 'dark',
  colors: darkColors,
  type: makeType(darkColors),
};

export function useTheme(): ThemeContextValue {
  return DARK;
}
