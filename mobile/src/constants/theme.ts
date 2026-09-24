/** iOS semantic colors as hex so Expo Go cannot crash on dynamic Color tokens. */

export type AppearancePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  separator: string;
  systemBackground: string;
  secondarySystemBackground: string;
  tertiarySystemBackground: string;
  systemBlue: string;
  systemGreen: string;
  systemRed: string;
  systemYellow: string;
  systemGray4: string;
  systemGray5: string;
  /** Text on blue tint fills. Always white. */
  onTint: string;
  /**
   * Text on `systemGreen` fills (Log set / Finish / Done). White in light; black in dark,
   * where white on #30D158 is 2.0:1 and black is 10.4:1 (Apple Fitness convention).
   */
  onGreen: string;
  /** Text on `label` fills (Start / Continue). Inverts with scheme. */
  onLabel: string;
};

export const lightColors: ThemeColors = {
  label: '#000000',
  secondaryLabel: '#3C3C43',
  // #8E8E93 was 3.3:1 on white / 2.9:1 on #F2F2F7. #6C6C70 is 5.2:1 / 4.7:1 (AA for 15pt meta).
  tertiaryLabel: '#6C6C70',
  separator: '#C6C6C8',
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemRed: '#FF3B30',
  systemYellow: '#FFCC00',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  onTint: '#ffffff',
  onGreen: '#ffffff',
  onLabel: '#ffffff',
};

/** Inky dark: black ground, elevated lists, Apple dark green. */
export const darkColors: ThemeColors = {
  label: '#FFFFFF',
  secondaryLabel: '#98989F',
  // #636366 was 3.5:1 on black / 2.8:1 on #1C1C1E. #8E8E93 is 6.4:1 / 5.2:1.
  tertiaryLabel: '#8E8E93',
  separator: '#38383A',
  systemBackground: '#000000',
  secondarySystemBackground: '#1C1C1E',
  tertiarySystemBackground: '#2C2C2E',
  systemBlue: '#0A84FF',
  systemGreen: '#30D158',
  systemRed: '#FF453A',
  systemYellow: '#FFD60A',
  systemGray4: '#48484A',
  systemGray5: '#3A3A3C',
  onTint: '#FFFFFF',
  onGreen: '#000000',
  onLabel: '#000000',
};

/** @deprecated Prefer `useTheme().colors`. Light default for modules outside React. */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  s: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export function makeType(themeColors: ThemeColors) {
  return {
    display: {
      fontSize: 56,
      fontWeight: '700' as const,
      lineHeight: 64,
      letterSpacing: -2,
      color: themeColors.label,
    },
    planTitle: {
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 34,
      letterSpacing: -0.03 * 28,
      color: themeColors.label,
    },
    largeTitle: {
      fontSize: 34,
      fontWeight: '700' as const,
      lineHeight: 41,
      letterSpacing: -0.03 * 34,
      color: themeColors.label,
    },
    displayDay: {
      fontSize: 40,
      fontWeight: '700' as const,
      lineHeight: 46,
      letterSpacing: -0.03 * 40,
      color: themeColors.label,
    },
    hero: {
      fontSize: 64,
      fontWeight: '700' as const,
      lineHeight: 68,
      letterSpacing: -0.04 * 64,
      color: themeColors.label,
    },
    title: {
      fontSize: 22,
      fontWeight: '700' as const,
      lineHeight: 28,
      letterSpacing: -0.02 * 22,
      color: themeColors.label,
    },
    lede: { fontSize: 22, fontWeight: '500' as const, lineHeight: 28, color: themeColors.label },
    residue: {
      fontSize: 28,
      fontWeight: '500' as const,
      lineHeight: 34,
      letterSpacing: -0.02 * 28,
      color: themeColors.label,
    },
    headline: { fontSize: 17, fontWeight: '600' as const, color: themeColors.label },
    body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22, color: themeColors.label },
    row: { fontSize: 17, fontWeight: '500' as const, lineHeight: 22, color: themeColors.label },
    subhead: {
      fontSize: 15,
      fontWeight: '500' as const,
      lineHeight: 20,
      color: themeColors.secondaryLabel,
    },
    kicker: {
      fontSize: 15,
      fontWeight: '500' as const,
      lineHeight: 20,
      color: themeColors.secondaryLabel,
    },
    kickerMedium: {
      fontSize: 15,
      fontWeight: '500' as const,
      lineHeight: 20,
      color: themeColors.secondaryLabel,
    },
    wellLabel: {
      fontSize: 15,
      fontWeight: '500' as const,
      letterSpacing: 0.04 * 15,
      lineHeight: 20,
      color: themeColors.secondaryLabel,
    },
    caption: {
      fontSize: 13,
      fontWeight: '500' as const,
      lineHeight: 18,
      color: themeColors.secondaryLabel,
    },
  };
}

export type ThemeType = ReturnType<typeof makeType>;

/** @deprecated Prefer `useTheme().type`. Light default for modules outside React. */
export const type = makeType(lightColors);

export function colorsForScheme(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

export function resolveColorScheme(
  preference: AppearancePreference,
  systemScheme: ColorScheme | null | undefined,
): ColorScheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function appearanceLabel(preference: AppearancePreference): string {
  switch (preference) {
    case 'system':
      return 'System';
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default: {
      const _exhaustive: never = preference;
      return _exhaustive;
    }
  }
}
