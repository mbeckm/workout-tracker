import { Dimensions } from 'react-native';

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
  /**
   * Trim's one brand hue (iOS systemIndigo): the primary action and the current selection
   * (Start, selected chips, the active tab, Finish, the focused well). trim-ui §5 Brand.
   */
  brand: string;
  /** Text and glyphs on `brand` fills. White in both schemes (5.7:1 light, 5.1:1 dark). */
  onBrand: string;
  systemBlue: string;
  systemGreen: string;
  systemRed: string;
  systemYellow: string;
  /** Streak secured: the lit flame on Home, and nothing else (trim-ui §5 Signals). */
  systemOrange: string;
  /** The streak flame while this week's goal is still open. */
  systemGray3: string;
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
  /** Dim behind custom sheets. Dark needs more, or it vanishes on a black page. */
  scrim: string;
};

export const lightColors: ThemeColors = {
  label: '#000000',
  secondaryLabel: '#3E3E4F',
  // Grays carry ~5–10% of the brand hue (trim-ui §5 Brand). Tertiary is 5.6:1 on white and
  // 4.7:1 on the secondary fill (AA for 15pt meta).
  tertiaryLabel: '#666678',
  separator: '#BFBFCA',
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#EAEAF2',
  tertiarySystemBackground: '#FFFFFF',
  brand: '#5856D6',
  onBrand: '#FFFFFF',
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemRed: '#FF3B30',
  systemYellow: '#FFCC00',
  systemOrange: '#FF9500',
  systemGray3: '#C0C0CD',
  systemGray4: '#C9C9D6',
  systemGray5: '#DCDCE8',
  onTint: '#ffffff',
  onGreen: '#ffffff',
  onLabel: '#ffffff',
  scrim: '#00000047',
};

/** Inky dark: an indigo-black ground, elevated lists, Apple dark green. */
export const darkColors: ThemeColors = {
  label: '#FFFFFF',
  secondaryLabel: '#9292A6',
  // Tinted toward the brand hue like every gray. 5.9:1 on the ground / 4.6:1 on the secondary fill.
  tertiaryLabel: '#88889D',
  separator: '#3B3A49',
  systemBackground: '#030308',
  secondarySystemBackground: '#20202D',
  tertiarySystemBackground: '#2F2F3D',
  brand: '#5E5CE6',
  onBrand: '#FFFFFF',
  systemBlue: '#0A84FF',
  systemGreen: '#30D158',
  systemRed: '#FF453A',
  systemYellow: '#FFD60A',
  systemOrange: '#FF9F0A',
  systemGray3: '#626172',
  systemGray4: '#494958',
  systemGray5: '#3C3C4B',
  onTint: '#FFFFFF',
  onGreen: '#000000',
  onLabel: '#000000',
  scrim: '#0000009E',
};

/** @deprecated Prefer `useTheme().colors`. Light default for modules outside React. */
export const colors = lightColors;

/**
 * Spacing scale. Space encodes relationship: the closer two things sit, the more they belong
 * together. Use the semantic names in `space`; reach for the raw scale only for something
 * `space` doesn't name. Any other number needs a comment saying why (optical alignment only).
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  s: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/**
 * iOS's own layout margin: where UIKit puts the native large title, the back button and
 * toolbar items. 16 on 6.1–6.3" iPhones, 20 from 414pt wide (Plus, Max, Air). Trim is
 * portrait-only, so the window width is fixed for the app's life.
 */
const SYSTEM_MARGIN = Dimensions.get('window').width >= 414 ? 20 : spacing.md;

/** What each step of the spacing scale is for. See trim-ui → Spacing. */
export const space = {
  /** Name → its meta line inside one row (17 over 15). */
  pair: spacing.xxs,
  /** Text → an inline mark (check, crown); stacked lines of one fact block. */
  tight: spacing.xs,
  /** Items of one group: a display name → its meta, a caption → the content it labels, pill → pill. */
  related: spacing.sm,
  /** Horizontal gap between a leading tile/icon and its text; between the two wells. */
  inline: spacing.s,
  /** Inside an object surface (list surface, well, tile), and a row's vertical padding. */
  inset: spacing.md,
  /** Page left/right margin on screens without a native large title; page top below the safe area. */
  gutter: spacing.lg,
  /**
   * Page left/right margin under a native large title (tab roots, plan and session detail):
   * the system's own margin, so content shares the title's leading edge (trim-ui → Layout).
   */
  margin: SYSTEM_MARGIN,
  /** Between sections of a screen. */
  section: spacing.xl,
  /** The pause after the winner, and above the thumb CTA when content allows. */
  pause: spacing.xxl,
} as const;

/** Radii. Always with `borderCurve: 'continuous'`. Nested shapes: inner = outer − inset. */
export const radius = {
  /** Small tiles (≤ 40pt), chart callouts. */
  sm: 8,
  /** Object surfaces and wells. */
  md: 12,
  /** Custom sheet top corners. */
  lg: 16,
  /** Pills: buttons, chips, toasts, dots. */
  full: 9999,
} as const;

/** Pressed rows, text buttons and glyphs dim to this. Pills scale instead (`PRESS_SCALE`). */
export const PRESSED_OPACITY = 0.6;

/** Minimum touch target, via size or `hitSlop`. */
export const TOUCH_TARGET = 44;

/**
 * Where the native large title sits, for the one head Trim draws itself (Home's streak,
 * trim-ui §4 Under a large title): the navigation bar's toolbar row between the safe area and
 * the title's line box, and the bar's own air under that line box. Measured on iOS 26 against
 * Plans, so Home's head lands on the other tabs' title to the point.
 */
export const LARGE_TITLE_TOP = 57;
export const LARGE_TITLE_BOTTOM = 8;

/**
 * SF Symbol point sizes. A symbol next to text takes that text's size so it sits on the
 * same optical line; standalone controls use `control`.
 */
export const iconSize = {
  /** Beside 15 captions; row chevrons and ↗. */
  caption: 13,
  /** Beside 17 rows: checks, crowns, plus in a list. */
  row: 17,
  /** Standalone tap targets: back, clear, drag handle, header glyphs. */
  control: 22,
} as const;

/**
 * The leading glyph lane on command and setting rows (Settings, plan and day editors): a `row`
 * glyph centred in a `control`-wide slot, so every row's text starts on one edge.
 */
export const ROW_GLYPH_SLOT = iconSize.control;

/**
 * Dynamic Type caps (`maxFontSizeMultiplier`). Large type on fixed stages is capped so the
 * layout holds; text at 17 and below is never capped below `text`.
 */
export const fontScaleCap = {
  display: 1.2,
  title: 1.4,
  text: 2,
} as const;

/**
 * The type ramp. Eight sizes (64 · 40 · 34 · 28 · 22 · 17 · 15 · 13), three weights
 * (700 names and commands, 500 rows and quiet values, 400 supporting text). Use a role as-is;
 * don't override size, weight or tracking. Override `color` only with another label tier or a
 * semantic color from trim-ui → Color.
 */
export function makeType(themeColors: ThemeColors) {
  const hero = {
    fontSize: 64,
    fontWeight: '700' as const,
    lineHeight: 68,
    letterSpacing: -0.04 * 64,
    color: themeColors.label,
  };
  const display = {
    fontSize: 40,
    fontWeight: '700' as const,
    lineHeight: 46,
    letterSpacing: -0.03 * 40,
    color: themeColors.label,
  };
  const displayCompact = {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
    letterSpacing: -0.03 * 34,
    color: themeColors.label,
  };
  // The native large title's own metrics (UIKit `.largeTitle`, bold). SF's size-specific
  // tracking comes from the font itself, as in the navigation bar, so no letterSpacing here:
  // Trim's −3% would make Home's head visibly tighter than the other tabs' titles.
  const largeTitle = {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
    color: themeColors.label,
  };
  const tabTitle = {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.03 * 28,
    color: themeColors.label,
  };
  const value = {
    fontSize: 28,
    fontWeight: '500' as const,
    lineHeight: 34,
    letterSpacing: -0.02 * 28,
    color: themeColors.label,
  };
  const title = {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.02 * 22,
    color: themeColors.label,
  };
  const lede = {
    fontSize: 22,
    fontWeight: '500' as const,
    lineHeight: 28,
    letterSpacing: -0.02 * 22,
    color: themeColors.label,
  };
  const row = { fontSize: 17, fontWeight: '500' as const, lineHeight: 22, color: themeColors.label };
  const body = { fontSize: 17, fontWeight: '400' as const, lineHeight: 22, color: themeColors.label };
  const button = {
    fontSize: 17,
    fontWeight: '700' as const,
    lineHeight: 22,
    color: themeColors.label,
  };
  const caption = {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: themeColors.tertiaryLabel,
  };
  const footnote = {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: themeColors.tertiaryLabel,
  };

  return {
    /** The one result on a moment screen: `Done`, the 1RM on a lift, the onboarding choice. */
    hero,
    /** @deprecated Page titles are the native large title (trim-ui → Typography). Migrating screens only. */
    display,
    /** A subject that can run long on a fixed stage: log exercise name, onboarding and paywall headlines. */
    displayCompact,
    /**
     * The native large title's metrics, for the one head Trim draws itself: Home's streak, which
     * must land exactly where the other tabs' native titles do (trim-ui §3, §4).
     */
    largeTitle,
    /** @deprecated Tab roots use the native large title; Home's head uses `largeTitle`. */
    tabTitle,
    /** Quiet large numbers: logged set lines, onboarding counts. */
    value,
    /** Status and sheet titles: `Set 2 of 4`, `3 of 5`, a sheet's day name. */
    title,
    /** The one line under the welcome hero. Nowhere else. */
    lede,
    /** A list item's name. */
    row,
    /** Text buttons (Cancel, Not now), form values, running text. */
    body,
    /** Pill and header-weight action labels. */
    button,
    /** Meta under a name, fact captions, section captions. Tertiary. */
    caption,
    /** Legal lines, chart axes. Tertiary. */
    footnote,

    /** @deprecated Use `tabTitle`. */
    planTitle: tabTitle,
    /** @deprecated Use `display`. */
    displayDay: display,
    /** @deprecated Use `value`. */
    residue: value,
    /** @deprecated Use `button` for actions, `row` for names. */
    headline: button,
    /** @deprecated Use `caption`. */
    subhead: caption,
    /** @deprecated Use `caption`. */
    kicker: caption,
    /** @deprecated Use `caption`. */
    kickerMedium: caption,
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
