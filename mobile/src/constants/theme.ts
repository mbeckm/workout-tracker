import { Dimensions, Platform } from 'react-native';

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
  // `lede`'s metrics with a different job: a number that sits quietly in a row's trailing lane.
  const valueCompact = {
    fontSize: 22,
    fontWeight: '500' as const,
    lineHeight: 28,
    letterSpacing: -0.02 * 22,
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
    /**
     * Quiet numbers in a row's trailing lane: Home's loads, Done's and a trained day's changes
     * (`62.5` beside its `kg`). A load is read, not announced, so Medium, not `title`'s Bold.
     */
    valueCompact,
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

/* ------------------------------------------------------------------------------------------ *
 * Gadget redesign (design/gadget/SPEC.md §2–4). The device, its display, the dark sheets and
 * the moments. Everything the gadget draws comes from here; the old tokens above stay until
 * the old screens are gone (PLAN §4.6).
 * ------------------------------------------------------------------------------------------ */

/** The finish keys (mirrors `Finish` in `domain/finish.ts`, kept local so theme has no imports). */
export type FinishId = '212' | '101' | '305' | '408';

/** What changes per finish (SPEC §2 Device). */
export type FinishColors = {
  /** Top of the body gradient. */
  body1: string;
  /** Bottom of the body gradient. */
  body2: string;
  /** Engraved `.lab` text. */
  label: string;
  /** The 1pt shadow under engraved text. */
  labelShadow: string;
  /** The lip under every raised key (and the metal big key's lip). */
  keyEdge: string;
  /** Big key, primary: radial highlight → body, and its lip. Graphite on Signal. */
  bigKeyHi: string;
  bigKeyLo: string;
  bigKeyLip: string;
  /** Inset top highlight on the primary big key. */
  bigKeyHighlight: string;
  /** Inset bottom shade on the primary big key (transparent on Signal). */
  bigKeyShade: string;
  /** The soft cast shadow under the primary big key. */
  bigKeyGlow: string;
  /** Status bar text on this finish. */
  statusBar: 'dark' | 'light';
  /** Swatch name. */
  name: string;
  /** Text on this finish's swatch (finishes sheet): number and name. */
  swatchInk: string;
  swatchSub: string;
};

export const finishColors: Record<FinishId, FinishColors> = {
  '212': {
    body1: '#E4E2DC',
    body2: '#D2CFC8',
    label: '#7C7A73',
    labelShadow: 'rgba(255,255,255,0.7)',
    keyEdge: '#A9A69E',
    bigKeyHi: '#FF8A45',
    bigKeyLo: '#F2550F',
    bigKeyLip: '#B83A05',
    bigKeyHighlight: 'rgba(255,255,255,0.45)',
    bigKeyShade: 'rgba(150,40,0,0.25)',
    bigKeyGlow: 'rgba(200,70,10,0.3)',
    statusBar: 'dark',
    name: 'Aluminium',
    swatchInk: '#1C1B18',
    swatchSub: '#6E6B64',
  },
  '101': {
    body1: '#3A3936',
    body2: '#232220',
    label: '#8C8A84',
    labelShadow: 'rgba(0,0,0,0.6)',
    keyEdge: '#A9A69E',
    bigKeyHi: '#FF8A45',
    bigKeyLo: '#F2550F',
    bigKeyLip: '#B83A05',
    bigKeyHighlight: 'rgba(255,255,255,0.45)',
    bigKeyShade: 'rgba(150,40,0,0.25)',
    bigKeyGlow: 'rgba(200,70,10,0.3)',
    statusBar: 'light',
    name: 'Graphite',
    swatchInk: '#F3F2EE',
    swatchSub: '#8C8A84',
  },
  '305': {
    body1: '#FF7A35',
    body2: '#DE470A',
    label: '#FFE2CF',
    labelShadow: 'rgba(120,30,0,0.35)',
    keyEdge: '#9E3A0A',
    // On Signal the primary big key is graphite (an orange key on an orange body disappears).
    bigKeyHi: '#4A4843',
    bigKeyLo: '#22211F',
    bigKeyLip: '#0E0E0D',
    bigKeyHighlight: 'rgba(255,255,255,0.2)',
    bigKeyShade: 'rgba(0,0,0,0)',
    bigKeyGlow: 'rgba(0,0,0,0.3)',
    statusBar: 'light',
    name: 'Signal',
    swatchInk: '#FFFFFF',
    swatchSub: '#FFE2CF',
  },
  '408': {
    body1: '#EFE6D3',
    body2: '#D9CBB0',
    label: '#7A6F5C',
    labelShadow: 'rgba(255,255,255,0.7)',
    keyEdge: '#A9A69E',
    bigKeyHi: '#FF8A45',
    bigKeyLo: '#F2550F',
    bigKeyLip: '#B83A05',
    bigKeyHighlight: 'rgba(255,255,255,0.45)',
    bigKeyShade: 'rgba(150,40,0,0.25)',
    bigKeyGlow: 'rgba(200,70,10,0.3)',
    statusBar: 'dark',
    name: 'Bone',
    swatchInk: '#3A3326',
    swatchSub: '#7A6F5C',
  },
};

/** Shared by every finish (SPEC §2 Shared, Body overlays, Big key; prototype CSS). */
export const deviceColors = {
  // Raised keys (.rk, the rocker body)
  key1: '#F4F3EF',
  key2: '#DEDBD4',
  keyInk: '#2A2925',
  /** inset 0 1 0 on every raised key. */
  keyHighlight: '#FFFFFF',
  /** 0 6 10 cast shadow under a raised key. */
  keyDrop: 'rgba(0,0,0,0.1)',
  // Body overlays. SVG stops ignore rgba alpha on iOS, so SVG paints take a colour + opacity.
  sheen: '#FFFFFF',
  sheenOpacity: 0.35,
  brushLight: '#FFFFFF',
  brushLightOpacity: 0.06,
  brushDark: '#000000',
  brushDarkOpacity: 0.02,
  /** The body's inner rim: inset 0 2 0, and a 1.5 inner outline. */
  bodyRim: 'rgba(255,255,255,0.65)',
  bodyRimOutline: 'rgba(255,255,255,0.35)',
  /** The light catch under recessed parts (display, well, plate): 0 1 0. */
  recessRim: 'rgba(255,255,255,0.5)',
  recessRimStrong: 'rgba(255,255,255,0.6)',
  // Wheel
  wheelLight: '#F2F1ED',
  wheelDark: '#C4C1B9',
  /** The wheel's inner shadows (inset 0 ±16 16), a boxShadow colour. */
  wheelInset: 'rgba(0,0,0,0.22)',
  wheelDrop: 'rgba(0,0,0,0.08)',
  // Well around the big key
  well: 'rgba(0,0,0,0.14)',
  wellShade: 'rgba(0,0,0,0.28)',
  // The rocker's recessed middle strip
  plate: '#C9C6BE',
  plateShade: 'rgba(0,0,0,0.25)',
  // The recessed lamp plate (finish mode)
  recessedPlate: 'rgba(0,0,0,0.12)',
  // Lamps in the rocker strip
  lampOff: '#8E8A80',
  lampPart: '#C08A68',
  lampDoneShine: 'rgba(255,255,255,0.25)',
  // Lamps on the recessed plate
  plateLampOff: 'rgba(0,0,0,0.28)',
  plateLampShade: 'rgba(0,0,0,0.4)',
  // Big key: metal (Skip, Done, Plans)
  metalHi: '#FAF9F6',
  metalLo: '#D6D2CA',
  metalGlow: 'rgba(0,0,0,0.14)',
  // Big key: disabled (the primary key through CSS grayscale(1), at .5 opacity)
  disabledHi: '#9E9E9E',
  disabledLo: '#717171',
  disabledLip: '#515151',
  /** Pressed big key: inset highlight and the small contact shadow. */
  bigKeyPressedHighlight: 'rgba(255,255,255,0.3)',
  bigKeyPressedDrop: 'rgba(0,0,0,0.2)',
  /** Text on the primary big key. */
  bigKeyInk: '#FFFFFF',
} as const;

/** The display (SPEC §2 Display). */
export const lcd = {
  lcd: '#121211',
  /** The lcd ground at 0 alpha, for top/bottom fades over scrolling rows. */
  lcdClear: 'rgba(18,18,17,0)',
  lcdShade: 'rgba(0,0,0,0.8)',
  amber: '#FF6A1A',
  /** The hold ring's glow and the lamp halo, amber at ~35%. */
  amberGlow: 'rgba(255,106,26,0.35)',
  amberDim: '#7A3E1C',
  amberOff: '#3A2214',
  /** Pressed tint behind a tappable display word (the exercise name). */
  amberPress: '#2A1A10',
  doneRow: '#FF6A1A',
  doneRowInk: '#121211',
  doneRowMeta: '#5A1E00',
  todoRow: '#1C1610',
} as const;

/** Dark, flat sheets (SPEC §2 Sheets, §6). */
export const sheetColors = {
  sheet: '#151514',
  sheetClear: 'rgba(21,21,20,0)',
  card: '#232321',
  /** Highlighted row inside a card (Today's current lift). */
  cardRaised: '#2C2A27',
  rule: '#2E2E2B',
  ink: '#F3F2EE',
  /** Body copy a step below ink (how-to steps, muscle chips). */
  inkSoft: '#D9D6CF',
  muted: '#8C8A84',
  sectionLabel: '#6E6C66',
  control: '#262624',
  controlInk: '#C9C6BF',
  /** Tracks and done chips. */
  track: '#33322F',
  pillLight: '#FBFAF7',
  pillLightInk: '#1C1B18',
  pillDark: '#2E2D2A',
  /** Text on orange fills (chips, ticks, badges). */
  onOrange: '#1C0E05',
  shadow: 'rgba(0,0,0,0.35)',
  scrim: 'rgba(20,18,15,0.4)',
  toast: '#2A2925',
  /** The finish card's warm glow behind the mini device. */
  finishGlowHi: '#3A2A20',
  finishGlowLo: '#1E1915',
  /** The selected swatch's ring. */
  ring: '#FFFFFF',
  swatchShadow: 'rgba(0,0,0,0.5)',
} as const;

/** The menu's 3D object icons (knob, gauge, receipt, toggles, cartridge). */
export const objectColors = {
  ridgeDark: '#BDB8AD',
  ridgeLight: '#E4E0D7',
  lip: '#6E6B64',
  capHi: '#FAF9F6',
  capLo: '#D9D6CF',
  gaugeRim: '#CFCBC3',
  paper: '#FFFEFA',
  paperInk: '#2A2925',
  paperLine: '#B9B6AE',
  plasticHi: '#ECEAE4',
  plasticLo: '#C9C5BC',
} as const;

/** Signals (SPEC §2): orange acts, green is done, yellow is a record. */
export const signal = {
  orange: '#FF6A1A',
  bigKey: '#F2550F',
  done: '#5DAA68',
  doneGlow: 'rgba(93,170,104,0.45)',
  record: '#F5C542',
} as const;

/** Receipt paper (SPEC §2, §6 Receipt). */
export const receiptColors = {
  paperTop: '#FCFAF4',
  paperBottom: '#EFEADF',
  paperEdge: '#F1ECE0',
  ink: '#34322D',
  inkMini: '#4A4741',
  muted: '#8E8B83',
  pr: '#C2410C',
  rule: '#B9B6AE',
  slot: '#000000',
  /** The slot's lower lip (`0 1 0 #333`). */
  slotLip: '#333333',
  /** Mini receipt and week report titles. */
  title: '#1C1B18',
  /** Ink bleed under thermal text (`text-shadow 0 0 .5px`). */
  inkBleed: 'rgba(52,50,45,0.5)',
  /** The paper's cast shadow (`drop-shadow 0 12 18`). */
  shadow: 'rgba(0,0,0,0.45)',
  // SVG paints take a colour + opacity (stops ignore rgba alpha on iOS).
  /** The shade where the paper leaves the slot (black .16 → 0 over 22). */
  slotShade: '#000000',
  slotShadeOpacity: 0.16,
  /** Faint thermal lines, 1 in every 3. */
  thermalLine: '#5A503C',
  thermalLineOpacity: 0.035,
  /** The week report's record count (QC2: yellow darkened to read on paper). */
  record: '#A8780A',
  /** The spike hole punched through a receipt (the ground shows through). */
  hole: '#0E0E0D',
  /** A History week's unlit lamp (`.wl i`). */
  wallLampOff: '#3A3936',
} as const;

/** Moments on the dark grid ground (SPEC §1 Moments; QC2, HR2). */
export const momentColors = {
  ground: '#0E0E0D',
  /** Grid lines: white at .04, every 28. */
  gridLine: '#FFFFFF',
  gridLineOpacity: 0.04,
  /** The spike: a metal rod, dark edges, light middle. */
  spikeEdge: '#8E8A80',
  spikeMid: '#F4F3EF',
  /** The spike's base and its lip. */
  baseHi: '#ECEAE4',
  baseLo: '#B9B5AC',
  baseLip: '#6E6B64',
  baseShadow: 'rgba(0,0,0,0.5)',
  ink: '#F3F2EE',
  muted: '#8C8A84',
} as const;

/** Font weights the gadget uses (SF Rounded). */
export const weight = {
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

/** Font families (registered by expo-font; SF Rounded is the system's rounded design). */
export const fontFamily = {
  lcd: 'Doto-Black',
  // iOS resolves `ui-rounded` to SF Rounded; browsers need the fallback list.
  rounded: Platform.OS === 'web' ? 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif' : 'ui-rounded',
  receipt: 'IBMPlexMono-Medium',
  receiptBold: 'IBMPlexMono-Bold',
} as const;

const lcdRole = (fontSize: number, lineHeight = fontSize) => ({
  fontFamily: fontFamily.lcd,
  fontSize,
  lineHeight,
  color: lcd.amber,
});
const roundedRole = (
  fontSize: number,
  lineHeight: number,
  fontWeight: (typeof weight)[keyof typeof weight],
  letterSpacing = 0,
) => ({
  fontFamily: fontFamily.rounded,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
});

/**
 * The gadget's type roles (SPEC §3). LCD roles are amber by default; dim them with
 * `lcd.amberDim`. LCD text is never scaled (`maxFontSizeMultiplier={1}`); key glyphs cap at
 * `fontScaleCap.display` (1.2).
 */
export const gadgetType = {
  /** The weight on the drum; sets × reps in edit. */
  lcdHero: lcdRole(104),
  /** The drum's weight from 1000 up (PLAN §7: shrinks to fit). */
  lcdHeroCompact: lcdRole(88),
  /** Rest time. */
  lcdBig: lcdRole(56),
  /** ALL DONE, END EARLY?, the plan name while loading. */
  lcdTitle: lcdRole(44, 48),
  /** `×8` under the drum. */
  lcdReps: lcdRole(56),
  /** The drum's previous and next steps. */
  lcdStep: lcdRole(40),
  /** `INSERT PLAN` on an empty slot (prototype 40/44). */
  lcdPrompt: lcdRole(40, 44),
  /** The lift name in device edit. */
  lcdName: lcdRole(28, 32),
  /** Day row titles. */
  lcdRow: lcdRole(20, 24),
  /** Finish stats (`n OF m SETS` over the volume). */
  lcdStat: lcdRole(20, 34),
  /** The expanded day row's lift lines. */
  lcdList: lcdRole(16, 27),
  /** Display headers (`hd`) and footers. */
  lcdSmall: lcdRole(15, 18),
  /** Small display labels (SETS / REPS in edit), sheet section labels. */
  lcdCaption: lcdRole(13, 16),
  /** Day row meta. */
  lcdMeta: lcdRole(12, 14),
  /** The PR stamp. */
  lcdStamp: lcdRole(11, 13),
  /** Glyphs on round keys (☰, ↶, ✕). */
  keyGlyph: { ...roundedRole(22, 26, weight.heavy), color: deviceColors.keyInk },
  /** Glyphs on tall keys (+, −) and the rocker ends (‹ ›). */
  keyGlyphLarge: { ...roundedRole(26, 30, weight.heavy), color: deviceColors.keyInk },
  /** Words on tall keys (+15, −15). */
  keyWord: { ...roundedRole(17, 22, weight.heavy), color: deviceColors.keyInk },
  /** Small words on tall keys (Back). */
  keyWordSmall: { ...roundedRole(15, 20, weight.heavy), color: deviceColors.keyInk },
  /** The big key's label. */
  bigKeyLabel: roundedRole(24, 28, weight.heavy),
  /** Engraved body labels (`.lab`): uppercase, label colour, 1pt labelShadow. */
  engraved: roundedRole(10, 12, weight.heavy, 1.5),
  sheetTitle: { ...roundedRole(18, 22, weight.heavy), color: sheetColors.ink },
  sheetHero: { ...roundedRole(28, 32, weight.heavy, -0.5), color: sheetColors.ink },
  bigNumber: { ...roundedRole(54, 58, weight.heavy, -1.5), color: sheetColors.ink },
  rowTitle: { ...roundedRole(17, 22, weight.heavy), color: sheetColors.ink },
  rowSub: { ...roundedRole(15, 20, weight.semibold), color: sheetColors.muted },
  sectionLabel: { ...lcdRole(13, 16), letterSpacing: 1, color: sheetColors.sectionLabel },
  receipt: { fontFamily: fontFamily.receipt, fontSize: 13, lineHeight: 20, color: receiptColors.ink },
  receiptBold: { fontFamily: fontFamily.receiptBold, fontSize: 13, lineHeight: 20, color: receiptColors.ink },
  receiptMini: { fontFamily: fontFamily.receipt, fontSize: 9, lineHeight: 13, color: receiptColors.inkMini },
  /** A mini receipt's day (`.mini b`). */
  receiptMiniTitle: { fontFamily: fontFamily.receiptBold, fontSize: 11, lineHeight: 13, color: receiptColors.title },
  /** A mini receipt's PR line (`.prt`). */
  receiptMiniPr: { fontFamily: fontFamily.receiptBold, fontSize: 9, lineHeight: 13, color: receiptColors.pr },
  /** The week report on the spike (QC2 `.p`, `.p b`). */
  receiptWeek: { fontFamily: fontFamily.receipt, fontSize: 12, lineHeight: 18, color: receiptColors.ink },
  receiptWeekBold: { fontFamily: fontFamily.receiptBold, fontSize: 12, lineHeight: 18, color: receiptColors.ink },
  receiptWeekTitle: { fontFamily: fontFamily.receiptBold, fontSize: 14, lineHeight: 18, color: receiptColors.title },
  /** A moment's headline on the grid ground (QC2 `Week 12 done`). */
  momentTitle: { ...roundedRole(30, 34, weight.heavy, -0.5), color: sheetColors.ink },
  /** Menu item titles (`.item b`). */
  itemTitle: { ...roundedRole(20, 24, weight.heavy, -0.3), color: sheetColors.ink },
  /** Round sheet controls (‹, ✕, Done). */
  control: { ...roundedRole(17, 22, weight.heavy), color: sheetColors.controlInk },
  /** Pill buttons. */
  pill: roundedRole(18, 22, weight.heavy),
  chip: roundedRole(13, 16, weight.heavy),
  /** Segmented control labels. */
  seg: { ...roundedRole(14, 18, weight.heavy), color: sheetColors.muted },
  swatchNumber: lcdRole(22, 26),
  swatchName: roundedRole(13, 16, weight.bold),
  toast: { ...roundedRole(15, 20, weight.heavy), color: deviceColors.bigKeyInk },
} as const;

/** Radii the gadget adds (SPEC §4, §6). Always `borderCurve: 'continuous'`. */
export const gadgetRadius = {
  stamp: 6,
  lcdRow: 16,
  lcdFrame: 20,
  tallKey: 22,
  wheel: 24,
  card: 24,
  key: 28,
  display: 28,
  sheet: 38,
  control: 20,
  chip: 13,
  seg: 16,
  segButton: 12,
  swatch: 20,
  toast: 16,
  miniDevice: 22,
  miniScreen: 10,
} as const;

/** Sheet geometry (SPEC §6, prototype CSS). */
export const sheetGeometry = {
  headerHeight: 68,
  control: 40,
  controlTop: 14,
  controlInset: 16,
  controlPadX: 14,
  sidePad: 12,
  bottomPad: 40,
  cardGap: 10,
  itemPadX: 18,
  itemPadY: 16,
  itemGap: 16,
  object: 56,
  sectionTop: 18,
  sectionX: 16,
  sectionBottom: 10,
  pillHeight: 56,
  pillWidth: 200,
  pillTop: 18,
  usebarTop: 20,
  usebarBottom: 34,
  chipHeight: 26,
  chipPadX: 10,
  segPad: 4,
  segHeight: 32,
  swatchW: 112,
  swatchH: 92,
  swatchPadX: 14,
  swatchPadY: 12,
  swatchGap: 10,
  swatchTilt: -4,
  swatchLift: 4,
  swatchRing: 3,
  finishCard: 200,
  miniDeviceW: 128,
  miniDeviceH: 104,
  miniDeviceTilt: -6,
  toastTop: 60,
  toastPadX: 16,
  toastPadY: 10,
  /** Sheet top edges: most, tall, Today, finishes. */
  tops: { default: 96, tall: 60, today: 200, finishes: 430 },
} as const;

/** The receipt, mini receipts and the week report (SPEC §6 Receipt, History wall; prototype `.paper`, `.mini`; QC2). */
export const receiptGeometry = {
  /** The slot (`.slot`): 12 tall, inset 16 inside the sheet's side padding. */
  slotHeight: 12,
  slotRadius: 6,
  slotInset: 16,
  /** The paper hangs from the slot's middle (`.clip` margin-top −6, `.paper` margin 4 28 0). */
  clipOverlap: 6,
  paperTop: 4,
  paperInset: 28,
  /** Room under the paper for its shadow (`.clip` padding-bottom 20). */
  clipBottom: 20,
  padTop: 22,
  padX: 20,
  padBottom: 30,
  /** The torn bottom: teeth 14 wide, 9 deep (45° flanks, so the valleys sit 7 above the points). */
  toothWidth: 14,
  toothDepth: 9,
  /** The dashed rule (`hr` margin 10 0). */
  ruleGap: 10,
  ruleDash: 3,
  /** The indented set line (`&nbsp; `). */
  indent: 16,
  /** The shade where the paper leaves the slot. */
  shadeHeight: 22,
  /** Thermal lines: 1 pt in every 3. */
  thermalPeriod: 3,
  /** The paper's shadow (`drop-shadow 0 12 18`). */
  shadowY: 12,
  shadowBlur: 18,
  /** Share and Done side by side (`.pill-btn` widths 130 and 170, gap 10). */
  actionGap: 10,
  shareWidth: 130,
  doneWidth: 170,
  /** `Share week` on the week moment needs a little more than `Share`. */
  shareWeekWidth: 150,
  // Mini receipts (`.mini`, `.rgrid`, `.wkh`)
  miniColumns: 3,
  miniGap: 10,
  miniGridInset: 4,
  miniPadTop: 10,
  miniPadX: 9,
  miniPadBottom: 16,
  miniToothWidth: 10,
  miniToothDepth: 6,
  miniRuleGap: 5,
  miniShadowY: 6,
  miniShadowBlur: 8,
  /** Each mini's tilt by its place in the week (degrees). */
  miniTilts: [0, 1.5, -1, 1, -1.5],
  miniPressScale: 0.96,
  weekTop: 16,
  weekX: 12,
  weekBottom: 10,
  weekLamp: 9,
  weekLampGap: 6,
  /** The empty wall's blank receipt. */
  emptyWidth: 200,
  emptyHeight: 120,
  emptyTop: 48,
  // The week report on the spike (QC2, at the 390 × 844 reference)
  weekReportWidth: 230,
  weekReportPadTop: 28,
  weekReportPadX: 18,
  weekReportPadBottom: 22,
  weekToothWidth: 12,
  weekToothDepth: 8,
  weekRuleGap: 8,
  weekReportLamp: 10,
  weekReportLampGap: 6,
  hole: 10,
  holeTop: 12,
  momentTitleY: 70,
  momentSubY: 112,
  spikeY: 200,
  spikeWidth: 6,
  spikeHeight: 420,
  reportY: 170,
  /** The two blank receipts already on the spike: top, content height (padding comes on top, as QC2), tilt. */
  backReceipts: [
    { y: 360, height: 200, tilt: -6 },
    { y: 342, height: 210, tilt: 4 },
  ],
  reportTilt: 1.5,
  baseY: 610,
  baseWidth: 140,
  baseHeight: 30,
  baseLip: 8,
  baseShadowY: 18,
  baseShadowBlur: 30,
  /** The report drops onto the spike from 120 above, tilted −4°. */
  dropFrom: 120,
  dropTilt: -4,
  momentShadowY: 8,
  momentShadowBlur: 12,
  gridCell: 28,
  momentBottom: 44,
} as const;

/** Device geometry at the 390 × 844 reference (SPEC §4). Keys keep these sizes on every phone. */
export const device = {
  /** Body edge to the keys and the display. */
  edge: 20,
  /** The display's inner padding. */
  displayPad: 22,
  /** Day rows inset inside the display, and their gap. */
  rowInset: 14,
  rowGap: 8,
  rowHeight: 62,
  /** The expanded row: base height plus one line per lift (max 4). */
  rowExpandedBase: 70,
  rowExpandedLine: 27,
  /** Top of the top row under the safe area at the reference (56 − 47 status bar ≈ 9). */
  topRowY: 56,
  displayY: 140,
  displayHeight: 420,
  /** Round keys. */
  keySize: 56,
  keyLip: 3,
  keyPress: 3,
  /** Tall left keys. */
  tallKeyWidth: 64,
  tallKeyHeight: 76,
  tallKeyGap: 12,
  /** The rocker (raised key body) and its parts. */
  rockerWidth: 198,
  rockerHeight: 56,
  rockerEnd: 46,
  rockerStrip: 30,
  rockerTilt: 10,
  rockerPerspective: 300,
  lamp: 10,
  lampGap: 7,
  /** Compressed lamps when a day has > 12 lifts (PLAN §7). */
  lampCompact: 8,
  lampGapCompact: 4,
  /** The recessed lamp plate (finish mode). */
  plateWidth: 190,
  plateHeight: 44,
  plateLamp: 12,
  plateLampGap: 10,
  /** The gap between the rocker and its engraved label. */
  labelGap: 6,
  /** Big key, its well and the hold ring. */
  bigKeySize: 146,
  bigKeyLip: 6,
  bigKeyPress: 6,
  wellSize: 170,
  holdRingRadius: 80,
  holdRingStroke: 6,
  /** The wheel. */
  wheelWidth: 64,
  wheelHeight: 180,
  wheelRidgeLight: 5,
  wheelRidgeDark: 2,
  wheelShade: 16,
  /** One notch of wheel travel. */
  wheelNotch: 16,
  wheelLip: 3,
  wheelStowX: 40,
  wheelStowScale: 0.9,
  /** The weight drum. */
  drumFrameHeight: 124,
  drumFrameInset: 10,
  drumFrameStroke: 2,
  drumStepTravel: 24,
  /** Drum rows inside the display (prototype `#drum`): above, current, below, the frame and the top fade. */
  drumAboveY: 64,
  drumCurrentY: 122,
  drumBelowY: 240,
  drumFrameY: 112,
  drumFadeY: 50,
  drumFadeHeight: 60,
  /** Display header top and footer bottom. */
  displayHeaderY: 20,
  displayFooterY: 22,
  /**
   * The log footer (`×8` and `LAST 80×8`). Doto at 56/56 sits 6pt higher in RN than in CSS, so
   * the row's bottom is 16, not 22, and the `lcdSmall` text beside it is lifted 11 to share the
   * baseline (measured against screen 04 on iOS).
   */
  repsFooterY: 16,
  lcdSmallBesideReps: 11,
  /** The PR stamp on a done row. */
  stampPadX: 6,
  stampPadY: 1,
  stampBorder: 2,
  stampOffsetRight: 46,
  stampOffsetTop: -7,
  /** Day row inner padding. */
  rowPadX: 14,
  rowPadY: 10,
  rowMetaGap: 6,
  rowListGap: 12,
  /** Selected row outline. */
  rowOutline: 2,
  /** A selected done row: a ring outside it, clear of the orange by a gap of lcd ground. */
  rowRingGap: 2,
  /** The fade over rows that scroll under the display's edge. */
  rowFadeHeight: 24,
  /** `INSERT PLAN`'s top on an empty slot (prototype 150). */
  promptY: 150,
  /** Blinking display text's dim phase (`blinkx`: opacity .25). */
  blinkDimOpacity: 0.25,
  /** The stamp's start: scale 2.4, rotate −12° (SPEC §7). */
  stampFromScale: 2.4,
  stampFromAngle: -12,
  /** Finish-mode set grid: 9 columns, lamps 10 tall. */
  gridColumns: 9,
  gridLamp: 10,
  gridGap: 8,
  /** Rest ring. */
  restRingRadius: 95,
  restRingStroke: 12,
  /** Bottom clearance above the home indicator at the reference; 16 on iPhone SE. */
  bottomClearance: 34,
  bottomClearanceCompact: 16,
  /** Display content fade+rise distance. */
  displayRise: 8,
  /** Stamp angle on done rows. */
  stampAngle: 7,
  /** Pressed key and lamp-dim opacities. */
  keyDisabledOpacity: 0.45,
  rockerEndDisabledOpacity: 0.3,
  bigKeyDisabledOpacity: 0.5,
} as const;

/* ----------------------------------------------------------------------------------------- *
 * Progress and lift detail (Phase 7; SPEC §6 Progress, Lift detail; prototype `.goal`,
 * `.plift`, `.lbig`, `.chart`, `.srow`).
 * ----------------------------------------------------------------------------------------- */

/** Progress's type roles (prototype CSS). Numbers that change in place are tabular. */
export const progressType = {
  /** `Bench 100` under a goal ring (`.goal b`). */
  goalTitle: { ...roundedRole(14, 18, weight.heavy), color: sheetColors.ink },
  /** `at 92` (`.goal span`). */
  goalSub: { ...roundedRole(12, 16, weight.bold), color: sheetColors.muted },
  /** `85%` inside the ring. */
  goalPercent: { ...roundedRole(14, 18, weight.heavy), color: sheetColors.ink },
  /** A lift row's name (`.plift .n`). */
  liftName: { ...roundedRole(16, 20, weight.heavy), color: sheetColors.ink },
  /** A lift row's value (`.plift .v`). */
  liftValue: { ...roundedRole(17, 20, weight.heavy), color: sheetColors.ink },
  /** A lift row's change (`.plift .d`). */
  liftChange: { ...roundedRole(12, 14, weight.heavy), color: sheetColors.controlInk },
  /** `Estimated max` over the big number. */
  readoutCaption: { ...roundedRole(16, 20, weight.semibold), color: sheetColors.inkSoft },
  /** The unit beside the big number (`.lbig span`). */
  bigUnit: { ...roundedRole(22, 26, weight.heavy), color: sheetColors.ink },
  /** The change line under the big number (`.lchg`). */
  changeLine: { ...roundedRole(15, 20, weight.heavy), color: sheetColors.controlInk },
  /** `GOAL 100` on the chart, `NO SESSIONS` on an empty panel. */
  chartLabel: lcdRole(11, 13),
  /** A session row (`.srow`): date, sets, value. */
  sessionTitle: { ...roundedRole(16, 20, weight.heavy), color: sheetColors.ink },
  sessionSub: { ...roundedRole(13, 17, weight.semibold), color: sheetColors.muted },
  sessionValue: { ...roundedRole(16, 20, weight.heavy), color: sheetColors.ink },
  /** The goal sheet's target field (bigNumber without a line height: a TextInput). */
  goalInput: { fontFamily: fontFamily.rounded, fontSize: 54, fontWeight: weight.heavy, letterSpacing: -1.5 },
} as const;

/** Progress geometry (prototype CSS; SPEC §6). */
export const progressGeometry = {
  /** GOALS: three cards, 9 apart, 4 in from the content edge. */
  goalGap: 9,
  goalInset: 4,
  goalCardHeight: 136,
  goalCardRadius: 22,
  goalCardPadTop: 12,
  goalCardPadX: 6,
  goalTitleTop: 6,
  /** The goal ring: 64, r26, stroke 6. */
  ring: 64,
  ringRadius: 26,
  ringStroke: 6,
  /** Lift rows (`.plift`): 12 × 18 padding, 12 gap; the value lane is 70 wide. */
  rowPadY: 12,
  rowPadX: 18,
  rowGap: 12,
  valueLane: 70,
  /** A row with a name only (empty state, Check in): as tall as a lift row. */
  plainRowHeight: 62,
  /** Sparklines: 70 × 24, stroke 2.5; the line spans x 2…68 and y 4…20 (`spark()`). */
  sparkW: 70,
  sparkH: 24,
  sparkStroke: 2.5,
  sparkInsetX: 2,
  sparkTop: 4,
  sparkBottom: 20,
  sparkDot: 2.5,
  /** Lift detail head (`.lhead`): 16 in. */
  headInset: 16,
  /** The lcd chart (`.chart`): 230 tall, r24, 14 under the change line. */
  chartTop: 14,
  chartHeight: 230,
  /** Plot area inside the chart: 18 from the sides, 16 from the top, 170 tall (`chart()`). */
  chartPadX: 18,
  chartPadTop: 16,
  chartPlot: 170,
  /** Three faint rules at y 60, 120, 180. */
  chartRules: [60, 120, 180],
  chartLine: 3,
  chartDot: 3,
  chartLastDot: 6,
  /** Dots on every session up to this many; beyond it only the last one. */
  chartDotsMax: 24,
  goalLineStroke: 1.5,
  goalLineDash: [4, 5],
  /** `GOAL 100` sits 6 above the line, 10 from the right edge. */
  goalLabelGap: 6,
  goalLabelRight: 10,
  /** The scrub guide and its dot. */
  scrubGuide: 1,
  scrubDot: 12,
  /** Session rows (`.srow`): 13 × 18. */
  sessionPadY: 13,
  sessionPadX: 18,
  sessionSubTop: 2,
  /** Check-in rows: a fixed field height (no lineHeight on a TextInput, AGENTS.md). */
  fieldHeight: 44,
  fieldMinWidth: 80,
  fieldUnit: 32,
  /** The keyboard's Next / Done bar. */
  accessoryPadY: 6,
  /** The goal sheet: the target field, its − / + keys, the replace choice's tick (`.tick`). */
  targetHeight: 64,
  targetMinWidth: 120,
  nudgeHeight: 56,
  tick: 30,
} as const;

/** Progress colours beyond the sheet palette (prototype `.tick`). */
export const progressColors = {
  /** An unticked round tick's ring. */
  tickRing: '#4A4945',
} as const;

/* ----------------------------------------------------------------------------------------- *
 * Plans: the rack, the editor and the add lifts sheet (Phase 6; SPEC §6 Plans rack, Editor,
 * Add lifts; prototype `.shelf`, `.cart`, `.ptitle`, `.dh`, `.erow`, `.num`, `.addl`,
 * `.addday`, `.search`, `.mus`, `.pickrow`, `.tick`).
 * ----------------------------------------------------------------------------------------- */

/** Plans colours beyond the sheet palette. */
export const plansColors = {
  /** A shelf (`.shelf`). */
  shelf: '#1C1C1A',
  /** The shelf's flash as cartridges file in (`@keyframes flash`). */
  shelfFlash: '#2A2622',
  /** A cartridge's top highlight (`inset 0 2px 0 #fff`). */
  cartHighlight: '#FFFFFF',
  /** The cartridge's grip ridges (`.cart u`). */
  grip: '#B9B4AA',
  /** The sets × reps chip's inner shade (`.num` inset 0 2 4). */
  numShade: 'rgba(0,0,0,0.6)',
  /** A dragged lift's lift-off shadow. */
  dragShadow: 'rgba(0,0,0,0.45)',
} as const;

/** Plans type roles (prototype CSS). */
export const plansType = {
  /** A shelf's plan name (`.shelf .sn b`). */
  shelfName: { ...roundedRole(19, 23, weight.heavy), color: sheetColors.ink },
  /** `4 days, 12 lifts` (`.shelf .ss`). */
  shelfSub: { ...roundedRole(13, 16, weight.semibold), color: sheetColors.muted },
  /** The `Active` badge (`.act`). */
  badge: { ...roundedRole(11, 13, weight.heavy), color: sheetColors.onOrange },
  /** A cartridge's label window (`.cart i`, Doto 9 on a 24 line). */
  cartLabel: lcdRole(9, 24),
  /** The editor's plan name (`.ptitle b`); a TextInput while renaming (no line height). */
  planTitleInput: { fontFamily: fontFamily.rounded, fontSize: 28, fontWeight: weight.heavy, letterSpacing: -0.5 },
  /** A day header (`.dh b`). */
  dayTitle: { ...roundedRole(20, 24, weight.heavy), color: sheetColors.ink },
  dayTitleInput: { fontFamily: fontFamily.rounded, fontSize: 20, fontWeight: weight.heavy },
  /** `3 lifts`, the day's `…` (`.dh span`). */
  dayCount: { ...roundedRole(13, 16, weight.bold), color: sheetColors.muted },
  /** A lift row's name, `Add lift` (`.erow`). */
  row: { ...roundedRole(16, 19, weight.bold), color: sheetColors.ink },
  /** The sets × reps chip (`.num`, Doto 15). */
  num: lcdRole(15, 18),
  /** `Add day` (`.addday`). */
  addDay: { ...roundedRole(16, 19, weight.heavy), color: sheetColors.ink },
  /** The search field (`.search`); a TextInput, so no line height. */
  search: { fontFamily: fontFamily.rounded, fontSize: 16, fontWeight: weight.bold },
  /** The search glyph (`⌕`). */
  searchGlyph: { ...roundedRole(16, 19, weight.bold), color: sheetColors.muted },
  /** Muscle chips (`.mus .mchip`). */
  muscleChip: { ...roundedRole(14, 18, weight.heavy), color: sheetColors.inkSoft },
  /** A picker row (`.pickrow b`, `.pickrow .s`). */
  pickName: { ...roundedRole(16, 19, weight.bold), color: sheetColors.ink },
  pickSub: { ...roundedRole(13, 16, weight.semibold), color: sheetColors.muted },
  /** The tick's ✓ (`.tick`). */
  tick: { ...roundedRole(15, 18, weight.heavy), color: sheetColors.onOrange },
} as const;

/** Plans geometry (prototype CSS; SPEC §6). */
export const plansGeometry = {
  // The rack (`.shelf`, `.cart`)
  shelfHeight: 150,
  shelfPadY: 14,
  shelfPadX: 18,
  shelfGap: 12,
  shelfOutline: 3,
  nameGap: 8,
  subTop: 2,
  badgeHeight: 22,
  badgePadX: 9,
  badgeRadius: 11,
  cartWidth: 48,
  cartHeight: 64,
  cartRadius: 10,
  cartGap: 8,
  cartHighlight: 2,
  labelInset: 5,
  labelTop: 8,
  labelHeight: 24,
  labelRadius: 4,
  gripInsetX: 10,
  gripBottom: 8,
  gripHeight: 10,
  /** Ridges: 2 on, 2 off. */
  gripLine: 2,
  gripPitch: 4,
  /** Filing: each cartridge drops from 120 above, tilted −8° (SPEC §7). */
  fileFrom: -120,
  fileTilt: -8,
  /** The flash holds its colour for the first 40% (`@keyframes flash`). */
  flashHold: 0.4,
  /** The empty rack's fact sits this far below the header. */
  emptyTop: 48,
  // The editor (`.ptitle`, `.dh`, `.erow`, `.num`, `.addday`, `.usebar`)
  titleTop: -6,
  titleX: 16,
  titleGap: 10,
  titleHeight: 32,
  dayTop: 20,
  dayX: 16,
  dayBottom: 8,
  dayHeight: 24,
  /** The day header's `…`: a 44 target around a short glyph. */
  dayMore: 44,
  rowPadY: 10,
  rowPadLeft: 18,
  rowPadRight: 12,
  rowGap: 12,
  numRadius: 10,
  numPadX: 10,
  numPadY: 6,
  numShadowY: 2,
  numShadowBlur: 4,
  addDayTop: 6,
  addDayX: 4,
  addDayHeight: 56,
  addDayRadius: 20,
  addDayRing: 2,
  /** `Use plan` and `Add N lifts` hug their words (`padding: 0 28px`). */
  pillPadX: 28,
  /** Room under the last card: 20, or 100 above a sticky pill. */
  tail: 20,
  tailOverPill: 100,
  /** Swipe a lift left past this to remove it (a flick projects 0.1 s ahead), then it slides away. */
  removeWidth: 96,
  swipeSlop: 12,
  swipeProjection: 0.1,
  swipeAway: 4,
  /** Day name suggestions while renaming a day (the old name sheet's chips). */
  suggestionTop: 2,
  dragScale: 1.03,
  dragShadowY: 8,
  dragShadowBlur: 18,
  dragLongPress: 300,
  // Add lifts (`.search`, `.mus`, `.pickrow`, `.tick`)
  searchHeight: 46,
  searchRadius: 23,
  searchPadX: 16,
  searchX: 4,
  searchGap: 8,
  chipsTop: 12,
  chipsBottom: 12,
  chipsPadX: 16,
  chipGap: 8,
  chipHeight: 32,
  chipPadX: 14,
  chipRadius: 14,
  pickPadY: 12,
  pickPadX: 18,
  pickGap: 12,
  tick: 30,
  tickRing: 2,
} as const;
