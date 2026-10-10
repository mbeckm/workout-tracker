import { Dimensions, Platform } from 'react-native';

/**
 * The old light/dark preference. The gadget has no appearance (the device's look is its finish,
 * sheets are always dark; decision 73), but snapshots still carry the field, so the store keeps it.
 */
export type AppearancePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

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
  /** Glyph that carries a 56pt round key alone: Undo last set. */
  key: 30,
} as const;

/**
 * Dynamic Type caps (`maxFontSizeMultiplier`). Large type on fixed stages is capped so the
 * layout holds; text at 17 and below is never capped below `text`.
 */
export const fontScaleCap = {
  display: 1.2,
  title: 1.4,
  text: 2,
} as const;

/* ------------------------------------------------------------------------------------------ *
 * Gadget redesign (design/gadget/SPEC.md §2–4). The device, its display, the dark sheets and
 * the moments. Everything the gadget draws comes from here.
 * ------------------------------------------------------------------------------------------ */

/** The finish keys (mirrors `Finish` in `domain/finish.ts`, kept local so theme has no imports). */
export type FinishId = '212' | '101' | '707' | '089' | '077' | '777';

/** Each finish is a whole machine: a body and the screen that comes with it (decision 80). */
export type ScreenId = 'amber' | 'night' | 'paper' | 'pea' | 'phosphor' | 'vfd';

/** How the body's surface is drawn (`DeviceBody`). */
export type BodyMaterial = 'brushed' | 'powder' | 'plastic' | 'holo';

/** The extra hardware a finish draws on its body (`FinishMarks`). */
export type FinishMarksId = 'pocket' | 'bunker' | 'field';

/** The shared device colours a finish may repaint (keys, wheel, plate, lamps, metal key, rims). */
type OverridableKey =
  | 'key1'
  | 'key2'
  | 'keyInk'
  | 'keyHighlight'
  | 'wheelLight'
  | 'wheelDark'
  | 'plate'
  | 'lampOff'
  | 'metalHi'
  | 'metalLo'
  | 'bodyRim'
  | 'bodyRimOutline'
  | 'recessRim'
  | 'recessRimStrong'
  | 'bigKeyInk';

/** A string or number token, widened from its `as const` literal. */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : T[K] };

/** A frame around the display (Pocket's slate bezel, Bunker's CRT housing). */
export type FinishBezel = {
  top: string;
  bottom: string;
  radius: number;
  /** Pocket's one big corner. */
  radiusBottomRight?: number;
  padH: number;
  padTop: number;
  padBottom: number;
  /** The display's own corner inside the bezel. */
  displayRadius: number;
};

/** What changes per finish (SPEC §2 Device, decision 80). */
export type FinishColors = {
  /** Top of the body gradient. */
  body1: string;
  /** Bottom of the body gradient. */
  body2: string;
  /** Diagonal stops instead of body1 → body2 (Holo's foil). */
  bodyStops?: readonly string[];
  material: BodyMaterial;
  /** The top sheen's opacity. */
  sheen: number;
  /** The screen this machine ships with. */
  screen: ScreenId;
  /** Engraved `.lab` text. */
  label: string;
  /** The 1pt shadow under engraved text. */
  labelShadow: string;
  /** The lip under every raised key (and the metal big key's lip). */
  keyEdge: string;
  /** The tall left keys when they differ from the round keys (Pocket's maroon pair). */
  tallKey?: { key1: string; key2: string; ink: string; edge: string };
  /** The lit lamp on the body (the rocker strip, the week plate). */
  lampOn: string;
  /** Big key, primary: radial highlight → body, and its lip. */
  bigKeyHi: string;
  bigKeyLo: string;
  bigKeyLip: string;
  /** Inset top highlight on the primary big key. */
  bigKeyHighlight: string;
  /** Inset bottom shade on the primary big key. */
  bigKeyShade: string;
  /** The soft cast shadow under the primary big key. */
  bigKeyGlow: string;
  bezel?: FinishBezel;
  marks?: FinishMarksId;
  /** Status bar text on this finish. */
  statusBar: 'dark' | 'light';
  /** Swatch name. */
  name: string;
  /** Text on this finish's swatch (finishes sheet): number and name. */
  swatchInk: string;
  swatchSub: string;
} & { [K in OverridableKey]?: string };

/** The orange big key every finish but Pocket, Bunker and Holo uses (deepened for white ink, 4.3:1). */
const ORANGE_KEY = {
  bigKeyHi: '#FF8443',
  bigKeyLo: '#D9480A',
  bigKeyLip: '#9A3004',
  bigKeyHighlight: 'rgba(255,255,255,0.45)',
  bigKeyShade: 'rgba(150,40,0,0.25)',
  bigKeyGlow: 'rgba(200,70,10,0.3)',
} as const;

export const finishColors: Record<FinishId, FinishColors> = {
  '212': {
    body1: '#E6E4DE',
    body2: '#CFCCC4',
    material: 'brushed',
    sheen: 0.35,
    screen: 'amber',
    // 3.5:1 under `WEEK n` and at the bottom of the body (was #7C7A73, 2.7:1 at the bottom).
    label: '#6A6862',
    labelShadow: 'rgba(255,255,255,0.75)',
    keyEdge: '#A9A69E',
    lampOn: '#FF6A1A',
    ...ORANGE_KEY,
    statusBar: 'dark',
    name: 'Aluminium',
    swatchInk: '#1C1B18',
    swatchSub: '#6E6B64',
  },
  '101': {
    body1: '#3D3C39',
    body2: '#1D1C1A',
    material: 'brushed',
    sheen: 0.16,
    screen: 'night',
    label: '#C0BEB8',
    labelShadow: 'rgba(0,0,0,0.65)',
    keyEdge: '#0E0E0D',
    key1: '#4F4E4A',
    key2: '#31302D',
    keyInk: '#EDEBE5',
    keyHighlight: 'rgba(255,255,255,0.2)',
    wheelLight: '#5C5A55',
    wheelDark: '#232220',
    plate: '#1A1918',
    lampOff: '#3E3D3A',
    metalHi: '#5E5D59',
    metalLo: '#3A3936',
    bodyRim: 'rgba(255,255,255,0.16)',
    bodyRimOutline: 'rgba(255,255,255,0.08)',
    recessRim: 'rgba(255,255,255,0.12)',
    recessRimStrong: 'rgba(255,255,255,0.14)',
    lampOn: '#FF6A1A',
    ...ORANGE_KEY,
    statusBar: 'light',
    name: 'Graphite',
    swatchInk: '#F3F2EE',
    swatchSub: '#A9A69E',
  },
  '707': {
    body1: '#727254',
    body2: '#4A4933',
    material: 'powder',
    sheen: 0.16,
    screen: 'paper',
    label: '#EEEAD4',
    labelShadow: 'rgba(0,0,0,0.5)',
    keyEdge: '#2A291C',
    key1: '#EEE9D6',
    key2: '#CFC8AE',
    keyInk: '#2E2D1F',
    wheelLight: '#E8E2CC',
    wheelDark: '#A9A286',
    plate: '#3A3927',
    lampOff: '#5E5D46',
    metalHi: '#F9F5E8',
    metalLo: '#D6CFB6',
    bodyRim: 'rgba(255,255,255,0.2)',
    bodyRimOutline: 'rgba(255,255,255,0.08)',
    recessRim: 'rgba(255,255,255,0.2)',
    recessRimStrong: 'rgba(255,255,255,0.22)',
    lampOn: '#FF6A1A',
    ...ORANGE_KEY,
    marks: 'field',
    statusBar: 'light',
    name: 'Field',
    swatchInk: '#EEEAD4',
    swatchSub: '#C9C5AE',
  },
  '089': {
    body1: '#DBD9D1',
    body2: '#C3C0B6',
    material: 'plastic',
    sheen: 0.28,
    screen: 'pea',
    label: '#4A4C57',
    labelShadow: 'rgba(255,255,255,0.6)',
    keyEdge: '#222328',
    key1: '#585961',
    key2: '#393A41',
    keyInk: '#E6E6EB',
    keyHighlight: 'rgba(255,255,255,0.25)',
    tallKey: { key1: '#AE3A6B', key2: '#7E1D48', ink: '#FFFFFF', edge: '#54122F' },
    wheelLight: '#DAD8D0',
    wheelDark: '#A6A39A',
    plate: '#2F3036',
    lampOff: '#55565E',
    metalHi: '#676870',
    metalLo: '#45464D',
    lampOn: '#FF3B30',
    bigKeyHi: '#B8437A',
    bigKeyLo: '#7E1D48',
    bigKeyLip: '#54122F',
    bigKeyHighlight: 'rgba(255,255,255,0.4)',
    bigKeyShade: 'rgba(60,0,20,0.25)',
    bigKeyGlow: 'rgba(0,0,0,0.22)',
    bezel: {
      top: '#666874',
      bottom: '#555763',
      radius: 12,
      radiusBottomRight: 56,
      padH: 14,
      padTop: 22,
      padBottom: 26,
      displayRadius: 4,
    },
    marks: 'pocket',
    statusBar: 'dark',
    name: 'Pocket',
    swatchInk: '#2F3990',
    swatchSub: '#5B5D69',
  },
  '077': {
    body1: '#6E6948',
    body2: '#47432D',
    material: 'powder',
    sheen: 0.12,
    screen: 'phosphor',
    label: '#E8E2C2',
    labelShadow: 'rgba(0,0,0,0.55)',
    keyEdge: '#5E4518',
    key1: '#E6C67A',
    key2: '#A9822F',
    keyInk: '#241806',
    keyHighlight: 'rgba(255,245,210,0.85)',
    wheelLight: '#E8CA80',
    wheelDark: '#8A6A2C',
    plate: '#2A281C',
    lampOff: '#5A5638',
    metalHi: '#F7E2A6',
    metalLo: '#B89040',
    bodyRim: 'rgba(255,255,255,0.15)',
    bodyRimOutline: 'rgba(255,255,255,0.06)',
    recessRim: 'rgba(255,255,255,0.14)',
    recessRimStrong: 'rgba(255,255,255,0.16)',
    bigKeyInk: '#FFF6E6',
    // A warning lamp: green on the body means done.
    lampOn: '#FFB23A',
    bigKeyHi: '#D9482C',
    bigKeyLo: '#962410',
    bigKeyLip: '#4E1207',
    bigKeyHighlight: 'rgba(255,255,255,0.32)',
    bigKeyShade: 'rgba(60,0,0,0.3)',
    bigKeyGlow: 'rgba(0,0,0,0.38)',
    bezel: {
      top: '#3A3A32',
      bottom: '#121210',
      radius: 42,
      padH: 14,
      padTop: 16,
      padBottom: 20,
      // Rounder than the other screens (a CRT), but the top row must clear the corners.
      displayRadius: 30,
    },
    marks: 'bunker',
    statusBar: 'light',
    name: 'Bunker',
    swatchInk: '#E8E2C2',
    swatchSub: '#B5AE8C',
  },
  '777': {
    body1: '#F7D6EA',
    body2: '#EBD5F8',
    bodyStops: ['#F7D6EA', '#D3E6FB', '#DAF8E8', '#FBF1CC', '#EBD5F8'],
    material: 'holo',
    sheen: 0.35,
    screen: 'vfd',
    label: '#6E6890',
    labelShadow: 'rgba(255,255,255,0.85)',
    keyEdge: '#B7B0CC',
    key1: '#FFFFFF',
    key2: '#E8E4F2',
    keyInk: '#3A3550',
    wheelLight: '#FFFFFF',
    wheelDark: '#C8C2DA',
    plate: '#D8D2E6',
    lampOff: '#B2ABC6',
    metalHi: '#FFFFFF',
    metalLo: '#DCD8E6',
    bodyRim: 'rgba(255,255,255,0.85)',
    bodyRimOutline: 'rgba(255,255,255,0.45)',
    lampOn: '#2FD3C4',
    bigKeyInk: '#2A2D38',
    bigKeyHi: '#FFFFFF',
    bigKeyLo: '#AEB3C2',
    bigKeyLip: '#767C8E',
    bigKeyHighlight: 'rgba(255,255,255,0.95)',
    bigKeyShade: 'rgba(60,60,90,0.2)',
    bigKeyGlow: 'rgba(120,100,160,0.32)',
    statusBar: 'dark',
    name: 'Holo',
    swatchInk: '#3A3550',
    swatchSub: '#6E6890',
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
  /** The lower inner edge of a display bezel. */
  bezelShade: 'rgba(0,0,0,0.3)',
} as const;

/** Everything a device part paints with: the shared colours, repainted by the finish. */
export type DevicePalette = Widen<typeof deviceColors> & Omit<FinishColors, OverridableKey>;

export function devicePalette(finish: FinishId): DevicePalette {
  const own = finishColors[finish];
  const shared: Widen<typeof deviceColors> = { ...deviceColors };
  for (const key of Object.keys(own) as (keyof FinishColors)[]) {
    const value = own[key];
    if (value !== undefined) (shared as Record<string, unknown>)[key] = value;
  }
  return shared as DevicePalette;
}

/** A display's texture: unlit dots, an LCD pixel grid, CRT scanlines, a VFD mesh, e-ink grain. */
export type ScreenTexture = 'dots' | 'grid' | 'scan' | 'mesh' | 'grain';

/**
 * A screen (SPEC §2 Display, decision 80). The keys keep the amber names the display code has
 * always used: `amber` is the screen's ink, `amberDim` its dim ink, and so on.
 */
export type ScreenColors = {
  name: string;
  lcd: string;
  /** The lcd ground at 0 alpha, for top/bottom fades over scrolling rows. */
  lcdClear: string;
  lcdShade: string;
  amber: string;
  /** The hold ring's glow and the lamp halo, ink at ~35%. */
  amberGlow: string;
  /** Dim ink: 3.7:1 or more on every screen, so it reads mid-set. */
  amberDim: string;
  amberOff: string;
  /** Pressed tint behind a tappable display word (the exercise name). */
  amberPress: string;
  doneRow: string;
  doneRowInk: string;
  doneRowMeta: string;
  todoRow: string;
  /** The text glow (phosphor bloom, VFD halo); a transparent glow draws nothing. */
  glow: string;
  glowRadius: number;
  /** Pea's LCD shadow: the digits cast a hard shadow down and right instead of glowing. */
  glowOffset: { width: number; height: number };
  texture: ScreenTexture;
  textureColor: string;
};

const NO_OFFSET = { width: 0, height: 0 } as const;

export const screenColors: Record<ScreenId, ScreenColors> = {
  amber: {
    name: 'Amber',
    lcd: '#121211',
    lcdClear: 'rgba(18,18,17,0)',
    lcdShade: 'rgba(0,0,0,0.8)',
    amber: '#FF6A1A',
    amberGlow: 'rgba(255,106,26,0.35)',
    // Raised from #7A3E1C (2.2:1) to 3.7:1 (decision 80).
    amberDim: '#B05A20',
    amberOff: '#3A2214',
    amberPress: '#2A1A10',
    doneRow: '#FF6A1A',
    doneRowInk: '#121211',
    doneRowMeta: '#5A1E00',
    todoRow: '#1C1610',
    glow: 'rgba(255,106,26,0.45)',
    glowRadius: 8,
    glowOffset: NO_OFFSET,
    texture: 'dots',
    textureColor: 'rgba(255,106,26,0.07)',
  },
  night: {
    name: 'White Night',
    lcd: '#000000',
    lcdClear: 'rgba(0,0,0,0)',
    lcdShade: 'rgba(0,0,0,0.9)',
    amber: '#F6F6F3',
    amberGlow: 'rgba(230,236,255,0.3)',
    amberDim: '#7E7E79',
    amberOff: '#262624',
    amberPress: '#1A1A1A',
    doneRow: '#F6F6F3',
    doneRowInk: '#000000',
    doneRowMeta: '#55554F',
    todoRow: '#151515',
    glow: 'rgba(215,228,255,0.35)',
    glowRadius: 6,
    glowOffset: NO_OFFSET,
    texture: 'dots',
    textureColor: 'rgba(255,255,255,0.035)',
  },
  paper: {
    name: 'Paper',
    lcd: '#E4E1D8',
    lcdClear: 'rgba(228,225,216,0)',
    lcdShade: 'rgba(0,0,0,0.28)',
    amber: '#191816',
    amberGlow: 'rgba(25,24,22,0.2)',
    amberDim: '#6B675E',
    amberOff: '#CFCBC0',
    amberPress: '#D6D2C6',
    doneRow: '#191816',
    doneRowInk: '#E6E3DA',
    doneRowMeta: '#8C887E',
    todoRow: '#D8D4CA',
    glow: 'rgba(0,0,0,0)',
    glowRadius: 0,
    glowOffset: NO_OFFSET,
    texture: 'grain',
    textureColor: 'rgba(0,0,0,0.05)',
  },
  pea: {
    name: 'Pea',
    lcd: '#AEBE62',
    lcdClear: 'rgba(174,190,98,0)',
    lcdShade: 'rgba(0,0,0,0.38)',
    amber: '#0E220C',
    amberGlow: 'rgba(14,34,12,0.25)',
    amberDim: '#30461B',
    amberOff: '#9AAA52',
    amberPress: '#A2B35A',
    doneRow: '#0E220C',
    doneRowInk: '#B3C266',
    doneRowMeta: '#7E9244',
    todoRow: '#A3B358',
    glow: 'rgba(14,34,12,0.16)',
    glowRadius: 0,
    glowOffset: { width: 2, height: 3 },
    texture: 'grid',
    textureColor: 'rgba(14,34,12,0.06)',
  },
  phosphor: {
    name: 'Phosphor',
    lcd: '#071A0C',
    lcdClear: 'rgba(7,26,12,0)',
    lcdShade: 'rgba(0,0,0,0.9)',
    amber: '#72FF98',
    amberGlow: 'rgba(92,255,134,0.4)',
    amberDim: '#45AC62',
    amberOff: '#123A1D',
    amberPress: '#0E2A15',
    doneRow: '#72FF98',
    doneRowInk: '#06140A',
    doneRowMeta: '#0C3A18',
    todoRow: '#0E2614',
    glow: 'rgba(92,255,134,0.7)',
    glowRadius: 10,
    glowOffset: NO_OFFSET,
    texture: 'scan',
    textureColor: 'rgba(0,0,0,0.2)',
  },
  vfd: {
    name: 'Ice VFD',
    lcd: '#051514',
    lcdClear: 'rgba(5,21,20,0)',
    lcdShade: 'rgba(0,0,0,0.85)',
    amber: '#80FCF0',
    amberGlow: 'rgba(98,245,230,0.4)',
    amberDim: '#3E9E96',
    amberOff: '#0F2E2B',
    amberPress: '#0B2321',
    doneRow: '#80FCF0',
    doneRowInk: '#04110F',
    doneRowMeta: '#0C3E3A',
    todoRow: '#0A2220',
    glow: 'rgba(98,245,230,0.6)',
    glowRadius: 8,
    glowOffset: NO_OFFSET,
    texture: 'mesh',
    textureColor: 'rgba(0,0,0,0.16)',
  },
};

/**
 * The amber screen. Sheets, onboarding and the paywall keep it whatever the finish (their lcd
 * chips are Trim's one hue); the device's display reads the machine's screen (`useScreen`).
 */
export const lcd = screenColors.amber;

/** How bodies and screens are drawn beyond their colours (decision 80). */
export const bodyFinish = {
  /** Holo's foil runs diagonally. */
  holoAngle: 125,
  /** The grain tile (assets/images/finish-grain.png) is 128pt square. */
  grainTile: 128,
  /** Grain over a powder-coated or plastic body, and over the e-ink screen. */
  grainOpacity: { powder: 0.07, plastic: 0.04, paper: 0.06 },
  /** The glass over every screen: a white glare fading out by 36%. */
  glass: 'rgba(255,255,255,0.09)',
  glassClear: 'rgba(255,255,255,0)',
  /** Screen textures, in points. */
  dotPitch: 5,
  dotRadius: 1.1,
  gridPitch: 4,
  scanPitch: 4,
  scanLine: 2,
  meshPitch: 4,
  /** The VFD's filament wires run across every 70pt. */
  filamentPitch: 70,
  filament: 'rgba(220,255,250,0.08)',
  /** The lit lamp's halo (the hold ring's glow), the lamp colour at 35%. */
  lampGlowOpacity: 0.35,
  /** The CRT's darker edges. */
  vignette: 'rgba(0,0,0,0.35)',
  vignetteClear: 'rgba(0,0,0,0)',
} as const;

/** The hardware a few machines draw on their bodies and bezels (`FinishMarks`). */
export const finishMarks = {
  pocket: {
    maroon: '#8E2352',
    navy: '#2F3990',
    ink: '#CBCCD5',
    led: '#FF3B30',
    ledGlow: 'rgba(255,59,48,0.9)',
    slot: 'rgba(0,0,0,0.18)',
    slotShade: 'rgba(0,0,0,0.3)',
    slotRim: 'rgba(255,255,255,0.5)',
    stripeH: 2,
    stripeGap: 3,
    ledSize: 9,
    slotW: 7,
    slotH: 30,
    slotGap: 9,
    slots: 6,
    slotAngle: -28,
    slotBottom: 18,
    slotRight: 30,
  },
  bunker: {
    screw: '#9A9272',
    screwRim: 'rgba(0,0,0,0.4)',
    screwSlot: 'rgba(0,0,0,0.6)',
    screwSize: 14,
    screwSlotW: 12,
    screwSlotH: 2,
    screwSlotAngle: 35,
    /** Screws sit 22pt in from the side, bottom ones 20pt up. */
    screwInset: 22,
    screwBottom: 20,
    hazardYellow: '#E8B931',
    hazardBlack: '#1A1A16',
    hazardW: 72,
    hazardH: 12,
    hazardStripe: 10,
    hazardLeft: 44,
    hazardBottom: 23,
    ring: 'rgba(226,194,118,0.55)',
    ringStroke: 3,
    ringGap: 4,
    stencil: 'rgba(232,185,49,0.85)',
    /** Worn paint at the corners. */
    wear: 'rgba(214,204,160,0.28)',
    wearClear: 'rgba(214,204,160,0)',
  },
  field: {
    stencil: 'rgba(238,234,212,0.6)',
    stencilLeft: 30,
    stencilBottom: 26,
    tabHi: '#FF8A45',
    tabLo: '#E2500F',
    tabW: 7,
    tabH: 44,
    tabRadius: 4,
  },
  radius: 3,
} as const;

/** The words printed on a machine (`DOT MATRIX`, `Trim POCKET`, `UNIT 077`, `FIELD 707`). */
export const marksType = {
  print: {
    fontFamily: Platform.OS === 'web' ? 'ui-rounded, system-ui, sans-serif' : 'ui-rounded',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.6,
  },
  logo: {
    fontFamily: Platform.OS === 'web' ? 'ui-rounded, system-ui, sans-serif' : 'ui-rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  stencil: {
    fontFamily: Platform.OS === 'web' ? 'ui-rounded, system-ui, sans-serif' : 'ui-rounded',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
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
  // iOS resolves `ui-monospace` to SF Mono (the onboarding wheel's number, D74).
  mono: Platform.OS === 'web' ? 'ui-monospace, "SF Mono", Menlo, monospace' : 'ui-monospace',
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
  /** The `×` between sets and reps in device edit (prototype 48/66). */
  lcdTimes: lcdRole(48, 66),
  /** A day ticking in while a plan loads (prototype 18/34). */
  lcdLoadDay: lcdRole(18, 34),
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
  /** The receipt (decision 90): `TRIM` in Doto, the record big, its lines in Plex Mono 11/16. */
  receiptMast: { fontFamily: fontFamily.lcd, fontSize: 18, lineHeight: 22, letterSpacing: 3, color: receiptColors.title },
  receiptHero: { fontFamily: fontFamily.lcd, fontSize: 46, lineHeight: 50, color: receiptColors.title },
  receiptHeroSmall: { fontFamily: fontFamily.lcd, fontSize: 28, lineHeight: 30, color: receiptColors.title },
  receiptStub: { fontFamily: fontFamily.receipt, fontSize: 11, lineHeight: 16, color: receiptColors.ink },
  receiptStubBold: { fontFamily: fontFamily.receiptBold, fontSize: 11, lineHeight: 16, color: receiptColors.ink },
  receiptStubName: { fontFamily: fontFamily.receiptBold, fontSize: 13, lineHeight: 18, letterSpacing: 1, color: receiptColors.ink },
  receiptStamp: { fontFamily: fontFamily.receiptBold, fontSize: 10, lineHeight: 11, color: receiptColors.pr },
  /** A History slip (H2): Plex Mono 11/15 bold, its big lines in Doto 26/28. */
  receiptSlip: { fontFamily: fontFamily.receiptBold, fontSize: 11, lineHeight: 15, color: receiptColors.ink },
  receiptSlipBig: { fontFamily: fontFamily.lcd, fontSize: 26, lineHeight: 28, color: receiptColors.title },
  receiptSlipMid: { fontFamily: fontFamily.lcd, fontSize: 18, lineHeight: 20, color: receiptColors.title },
  /** The finish screen's three stats (decision 90). */
  finishStat: { ...roundedRole(26, 30, weight.heavy, -0.4), color: sheetColors.ink },
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
  /** The exercise sheet (M4): the name, how-to steps and their Doto numbers, the YOU card. */
  exerciseName: { ...roundedRole(30, 34, weight.heavy, -0.5), color: sheetColors.ink },
  step: { ...roundedRole(15, 21, weight.semibold), color: sheetColors.inkSoft },
  stepNumber: lcdRole(15, 21),
  statValue: { ...roundedRole(20, 24, weight.heavy), color: sheetColors.ink },
  statLabel: { ...roundedRole(12, 16, weight.bold), color: sheetColors.muted },
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
  /** The exercise figure panel and the muscle chips (M4). */
  figure: 28,
  muscleChip: 14,
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
  /**
   * Transparent room around a swatch that's drawn as one bitmap: a rotated layer's edges alias
   * on iOS, a rotated bitmap with clear pixels around it is smoothed (feel pass). Holds the ring
   * and its drop shadow.
   */
  swatchEdgePad: 28,
  finishCard: 200,
  /** The menu's mini device sits 22 under the finish card's top (prototype menu). */
  miniDeviceTop: 22,
  miniDeviceW: 128,
  miniDeviceH: 104,
  miniDeviceTilt: -6,
  toastTop: 60,
  toastPadX: 16,
  toastPadY: 10,
  /** Sheet top edges: most, tall, Today, finishes. */
  tops: { default: 96, tall: 60, today: 200, finishes: 430 },
  /**
   * The finishes sheet is as tall as its content, anchored to the bottom, so a taller phone shows
   * more device, not more empty sheet. The host measures the content and glides to fit when
   * `Get Trim Pro` comes and goes; this is its height before the first measure (header, swatches,
   * Done), without the bottom inset.
   */
  swatchesHeight: 248,
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
  // The finish screen (decision 90, F3a): stats over the lifts, the receipt printing up at the bottom
  /** The three stats in one card. */
  statPadX: 18,
  statPadY: 16,
  statDeltaTop: 4,
  /** A lift's row: name left, its line against last time right. */
  liftRowHeight: 50,
  /** The receipt (stub): 244 wide, torn at the top (it feeds up out of the slot under it). */
  stubWidth: 244,
  stubPadTop: 22,
  stubPadX: 18,
  stubPadBottom: 16,
  stubToothWidth: 10,
  stubToothDepth: 6,
  stubRuleGap: 8,
  /** The double rule under `TRIM` (`.rule2`: 1.5 lines 3 apart). */
  stubRuleLine: 1.5,
  stubRuleSpace: 3,
  /** Space between record lines on a receipt with several. */
  stubRecordGap: 6,
  /** The barcode: bars 1–3 wide, 20 tall, inset 16. */
  barcodeHeight: 20,
  barcodeInset: 16,
  barcodeTop: 10,
  barcodeBars: [2, 2, 1, 3, 3, 1, 1, 4, 2, 2, 1, 1, 3, 2, 2, 3, 1, 2, 1, 4, 2, 1, 3, 1, 1, 2, 2, 3],
  /** The rubber stamp: a 62 ring, 2.5 line, bottom right over the barcode, tilted −12°. */
  stampSize: 62,
  stampLine: 2.5,
  stampRight: 10,
  stampBottom: 8,
  stampTilt: -12,
  /** It lands from 2.4× and −30°. */
  stampFromScale: 2.4,
  stampFromAngle: -30,
  /** The slot the receipt prints up out of, above the actions; inset from the sheet's sides. */
  stubSlotInset: 50,
  stubSlotTop: 24,
  /** The paper's shadow points up (it rises out of the slot). */
  stubShadowY: -6,
  stubShadowBlur: 14,
  // History (H2): clean rows; a workout that printed is its slip
  logRowHeight: 64,
  slipInsetX: 4,
  slipGap: 12,
  slipPadTop: 12,
  slipPadX: 16,
  slipPadBottom: 18,
  slipColumnGap: 12,
  /** Each slip's tilt by its place in History (degrees). */
  slipTilts: [-1, 1, -0.5, 0.75],
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
  /** The 2D stand-in for the rocker's rotateY (iOS composites 3D layers badly): 1 − cos 10°, and a 1.5° rock. */
  rockerTiltSqueeze: 0.015,
  rockerTiltRock: 1.5,
  lamp: 10,
  lampGap: 7,
  /** Compressed lamps when a day has > 12 lifts (PLAN §7). */
  lampCompact: 8,
  lampGapCompact: 4,
  /** Clear space inside the rocker strip at each end of the lamps. */
  lampStripInset: 4,
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
  /**
   * The clear space a drum row keeps from the `×8` footer. Short displays (iPhone SE) drop the
   * step below, then the step above, and centre the frame between the header and the footer.
   */
  drumClear: 8,
  /**
   * Under a header too tall for the step above (the log's name and set row), the frame sits this
   * far below the header and the step above drops.
   */
  drumHeaderClear: 32,
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

/** The exercise sheet (M4, prototype `.fig`, `.mchip`, `.step`). */
export const exerciseSheet = {
  figureHeight: 230,
  figureTop: 12,
  /** The floating ‹ over the figure (prototype left 28, top 26 in the sheet). */
  controlX: 28,
  controlY: 26,
  nameTop: 16,
  namePadX: 12,
  kitTop: 4,
  chipsTop: 14,
  chipHeight: 28,
  chipPadX: 12,
  chipGap: 6,
  stepPadX: 18,
  stepPadY: 12,
  stepGap: 14,
  stepNumberWidth: 14,
  statPadY: 16,
  statPadX: 8,
} as const;

/**
 * Trim's own movement figures (D5, prototype `FIG`): a light stick figure, dark equipment,
 * orange plates and handles, on a warm radial ground. SVG paints take a colour + opacity.
 */
export const figureColors = {
  body: '#E4E2DC',
  equipment: '#3A3936',
  pad: '#4A4843',
  bar: '#B9B6AE',
  plate: '#FF6A1A',
  cable: '#FF6A1A',
  groundHi: '#2E2620',
  groundLo: '#161412',
  /** The floating ‹ over the figure: the control colour at 85%. */
  control: 'rgba(38,38,36,0.85)',
} as const;

/** Log, rest and finish on the display, and the bottom row in those modes (SPEC §4–5, prototype). */
export const logGeometry = {
  /** Tall keys from the bottom row's top (y588): `+` at y592, `−` at y680, `Back` alone at y636. */
  tallKeyTop: 4,
  tallKeyBottom: 92,
  backKeyTop: 48,
  /** The tappable lift name (`.nm`): padding 2 8 pulled back by the same margin, r8. */
  namePadX: 8,
  namePadY: 2,
  nameRadius: 8,
  /** The log header: the lift name (`lcdRow`), then the set row this far under it. */
  nameSetGap: 6,
  /** The set lamps beside `SET 2/4`: 22 × 10 pills 8 apart, 12 wide 5 apart past 6 sets. */
  setLampWidth: 22,
  setLampWidthCompact: 12,
  setLampHeight: 10,
  setLampGap: 8,
  setLampGapCompact: 5,
  /** From the last lamp to `SET 2/4`. */
  setLampLabelGap: 12,
  /** From the reps number to `REPS`. */
  repsUnitGap: 8,
  /** Rest: the ring's 230 box, centred between header and footer (r95, stroke 12; the track dashed 3 on, 7 off). */
  restRingBox: 230,
  restRingDash: '3 7',
  /** The rest footer sits 20 from the bottom. */
  restFooterY: 20,
  /** Short displays (iPhone SE): the ring and its clock shrink to fit this far inside the header and footer. */
  restRingClear: 8,
  /** Finish: the title, the set grid (120 clear on the right) and the stats. */
  finishTitleY: 64,
  finishGridY: 150,
  finishGridRight: 120,
  finishStatsY: 220,
  /**
   * The set grid keeps this clear above the stats: 4 rows of 9 fit at full size. Longer days
   * compress the lamps (8 tall, 4 apart, the rocker's rule), then add columns so it never
   * reaches the stats.
   */
  finishGridClear: 6,
  /**
   * The roll call (decision 86): today's lifts as rows (`lcdRow`), 8 apart (room for the frame's
   * ring), centred under the header; a display too short for all of them shows a window around
   * the current lift.
   */
  rollRowHeight: 36,
  rollRowGap: 8,
  rollHeaderGap: 12,
  /**
   * The hand-off card (decision 87): `NEXT`, the lift's name in `lcdTitle` (up to 3 lines,
   * shrinking to fit) and its prescription, 14 apart, centred. It leaves by rising 150 and
   * shrinking to half, toward the header.
   */
  nextGap: 14,
  nextNameLines: 3,
  nextNameMinScale: 0.6,
  nextOutRise: 150,
  nextOutScale: 0.5,
  nextInScale: 0.97,
} as const;

/** Today (M3, screen 07; prototype `.lift`, `.bars`, `.info`). */
export const todayGeometry = {
  rowHeight: 70,
  rowPadLeft: 6,
  rowPadRight: 14,
  jumpPadX: 12,
  jumpPadY: 10,
  jumpRadius: 14,
  subGap: 2,
  rowGap: 12,
  /** The current row's orange inset on the left. */
  currentInset: 3,
  bar: 16,
  barHeight: 6,
  barRadius: 3,
  barGap: 4,
  info: 32,
  /** Swipe-left actions (Swap, Remove), each this wide. */
  action: 84,
  /** A lifted row while it's dragged. */
  dragScale: 1.03,
} as const;

export const todayColors = {
  /** An unlogged set bar. */
  barOff: '#3A3936',
  dragShadow: 'rgba(0,0,0,0.45)',
} as const;

/** The keypad sheet (D19). */
export const keypadGeometry = {
  key: 50,
  gap: 8,
  radius: 16,
  valueTop: 4,
  valueBottom: 16,
} as const;

/** Type the log's sheets add (Today rows, the keypad). */
export const logType = {
  /** Today's row sub (`Now, set 2/3`): 13/600 muted. */
  liftSub: { ...roundedRole(13, 16, weight.semibold), color: sheetColors.muted },
  /** Today's "i": an italic serif i, like the system's info glyph. */
  info: { fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 15, lineHeight: 18, fontWeight: weight.heavy, color: sheetColors.controlInk },
  keypadDigit: { ...roundedRole(26, 30, weight.bold), color: sheetColors.ink },
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
  /** A row with the lift's art tile: the tile sets the height (52 + 2 × 10 = 72). */
  pickArtPadY: 10,
  /** The art tile (decision 83): a small lcd with the lift's working frame. */
  artTile: 52,
  artTileRadius: 10,
  artTileRing: 1,
  /** A lift already in the day keeps its tile, quieter. */
  artTileTaken: 0.4,
  tick: 30,
  tickRing: 2,
} as const;

/** Device edit (PA2, screen 22; prototype `renderEdit`): where the display's parts sit. */
export const editGeometry = {
  /** The lift name's top (prototype 52). */
  nameY: 52,
  /** The sets × reps row's top (prototype 150); it moves up on short displays. */
  numbersY: 150,
  /** The row's height: the SETS label (16) + 6 + the number (100), plus the frame's overhang. */
  numbersHeight: 135,
  /**
   * The number under its label. CSS has 6, but Doto sits higher in an RN line box: 24 puts the
   * glyph 15 under the frame's top and the frame 7 under the label, as on screen 22.
   */
  numberGap: 24,
  /** The × sits on the numbers' baseline (Doto 48 drops lower in its line box than 104). */
  timesLift: 11,
  /** 104 Doto on a 100 line (prototype). */
  numberLine: 100,
  /** Between SETS, ×, REPS (`gap: 14`). */
  columnGap: 14,
  /** The frame round the wheel's value: 10 past each side, from 23 under the label's top (screen 22), 112 tall, r18. */
  frameOutset: 10,
  frameTop: 23,
  frameHeight: 112,
  frameRadius: 18,
  frameStroke: 2,
  /** Footer bottom (prototype 20). */
  footerY: 20,
  /** The lift name keeps two lines only with this much clear above the numbers (else one, shrunk). */
  nameClear: 8,
  /** The smallest a one-line lift name shrinks to. */
  nameMinScale: 0.6,
  /** The footer and the room the numbers keep above it. */
  footerRoom: 44,
  /** Value lengths (sets + value characters) that fit at 104, then 88; longer ones go to 56. */
  heroChars: 4,
  compactChars: 5,
  /** The SETS label under the tall keys (prototype y762, left keys at x22). */
  setsLabelY: 174,
} as const;

/** The plan insert (SPEC §7 Plan activation; prototype `.scene`, `.c3`, `.pulse`, `.slotglow`). */
export const insertColors = {
  /** The backdrop's radial (`#1D1C1A` → `#0B0B0A`). */
  backdropIn: '#1D1C1A',
  backdropOut: '#0B0B0A',
  gridLine: '#FFFFFF',
  gridLineOpacity: 0.14,
  vignette: '#000000',
  vignetteOpacity: 0.7,
  shadow: '#000000',
  shadowOpacity: 0.6,
  /** The cartridge's plastic, its top highlight and bottom shade, the back layers, the ridges. */
  cartHi: '#DAD7D0',
  cartLo: '#B7B3AA',
  cartHighlight: 'rgba(255,255,255,0.65)',
  cartShade: 'rgba(0,0,0,0.08)',
  cartBack: '#8E8A80',
  cartRidge: 'rgba(0,0,0,0.18)',
  cartLabelShade: 'rgba(0,0,0,0.8)',
  /** The slot glow and the pulse ring. */
  glow: '#FF6A1A',
  glowHalo: 'rgba(255,106,26,0.7)',
  pulseRing: 'rgba(255,106,26,0.5)',
  pulseHalo: 'rgba(255,106,26,0.25)',
  /** The body's depth layers: brightness from the front layer to the back one (`.edge`, .6). */
  depthFront: 0.72,
  depthBack: 0.42,
} as const;

export const insertGeometry = {
  /** The pull-back pose (SPEC §7): translateY 70, scale .68, rotateX −16°, rotateY −30°, rotateZ 2°. */
  pullY: 70,
  pullScale: 0.68,
  pullRotateX: -16,
  pullRotateY: -30,
  pullRotateZ: 2,
  /** `.phone { perspective: 1400px }`. */
  perspective: 1400,
  /** How far behind the screen the scene's backdrop sits, clear of the turned device's back half. */
  backdropDepth: 2000,
  /** The body as an object: r52, 44 deep in 22 layers. */
  bodyRadius: 52,
  bodyDepth: 44,
  depthLayers: 22,
  /** The click's dip: down 10, rotateX 4°, scale .985; rebound −4, −1°, 1.006; then 1, 0. */
  dipY: 10,
  dipRotateX: 4,
  dipScale: 0.985,
  reboundY: -4,
  reboundRotateX: -1,
  reboundScale: 1.006,
  settleY: 1,
  /** The cartridge (`.c3`): 160 × 190 at y −240, half into the body's depth, 5 layers thick. */
  cartWidth: 160,
  cartHeight: 190,
  cartTop: -240,
  cartDepth: 22,
  cartLayers: 5,
  cartLayerStep: 2,
  cartRadiusTop: 9,
  cartRadiusTopRight: 22,
  cartRadiusBottom: 6,
  /** Appears from 60 above, slides 180 down, overshoots to 192, settles 184 then 186. */
  cartFrom: -60,
  cartSlide: 180,
  cartOvershoot: 192,
  cartSettle1: 184,
  cartSettle2: 186,
  /** `.rid`: left 18, right 30, top 10, 14 tall, ridges 2 on 4 off. */
  ridgeLeft: 18,
  ridgeRight: 30,
  ridgeTop: 10,
  ridgeHeight: 14,
  ridgeLine: 2,
  ridgePitch: 6,
  ridgeRadius: 3,
  /** `.lbl`: 14 in, 34 down, 118 tall, r7, padding 10 12; name Doto 17/19, days 10/15. */
  labelInset: 14,
  labelTop: 34,
  labelHeight: 118,
  labelRadius: 7,
  labelPadY: 10,
  labelPadX: 12,
  labelDaysTop: 8,
  /** `.brand` and `.arrow`. */
  brandInset: 14,
  brandBottom: 10,
  arrowRight: 16,
  arrowBottom: 9,
  arrowHalf: 6,
  arrowHeight: 9,
  /** `.slotglow`: 180 × 10 at y −4, r5, an 18 blur. */
  glowWidth: 180,
  glowHeight: 10,
  glowTop: -4,
  glowBlur: 18,
  glowSpread: 6,
  /** `.pulse`: 340 round, centred 40% down; scale .35 → 1.25, opacity .9 → 0. */
  pulseSize: 340,
  pulseCentreY: 0.4,
  pulseFrom: 0.35,
  pulseTo: 1.25,
  pulseOpacity: 0.9,
  pulseRing: 2,
  pulseBlur: 40,
  pulseSpread: 6,
  /** `.gridfloor`: 44 cells, from 52% down, tilted 72° under a 500 perspective, 120% long, 60% wider each side. */
  gridCell: 44,
  gridTop: 0.52,
  gridTilt: 72,
  gridPerspective: 500,
  gridLength: 1.2,
  gridSpread: 0.6,
  gridLine: 1.5,
  /** The floor's mask: .2 at its far edge, full from 30% to 60%, gone at the end. */
  gridMaskStart: 0.2,
  gridMaskIn: 0.3,
  gridMaskOut: 0.6,
  /** The radial backdrop: 80% × 55% at 50% 42%; the vignette 75% × 65% at 50% 48%, clear to 55%. */
  backdropRx: 0.8,
  backdropRy: 0.55,
  backdropCy: 0.42,
  vignetteRx: 0.75,
  vignetteRy: 0.65,
  vignetteCy: 0.48,
  vignetteClear: 0.55,
  /** `.devshadow`: 270 × 46 at y720 of 844, from scale .6. */
  shadowWidth: 270,
  shadowHeight: 46,
  shadowY: 720 / 844,
  shadowFrom: 0.6,
  /** The boot: scaleY .02 → 1.04 (35%) → 1. */
  bootFrom: 0.02,
  bootPeak: 1.04,
  bootPeakAt: 0.35,
  /** Loaded: the plan name at 54, the days from 170 (34 apart), a 10-segment bar 16 tall, 4 apart, 22 up. */
  loadedNameY: 54,
  loadedListY: 170,
  loadedLine: 34,
  barSegments: 10,
  barHeight: 16,
  barGap: 4,
  barBottom: 22,
} as const;

/** The cartridge's printing in the insert (`.c3 .lbl b`, `.lbl span`, `.brand`). */
export const insertType = {
  cartName: lcdRole(17, 19),
  cartDays: { ...lcdRole(10, 15), color: lcd.amberDim },
  brand: { ...roundedRole(11, 13, weight.heavy, 2), color: insertColors.cartBack },
} as const;

/* ----------------------------------------------------------------------------------------- *
 * Finishes, onboarding and the paywall (Phase 8; SPEC §6 Finishes, boards N7, N9, N10, PB1).
 * ----------------------------------------------------------------------------------------- */

/** Onboarding and paywall type (PB1, N9, N10). Sentence case, SF Rounded. */
export const onboardingType = {
  /** A step's question (PB1 `Pick a plan` 30/34, N10 `Pick your finish`). */
  title: { ...roundedRole(30, 34, weight.heavy, -0.5), color: sheetColors.ink },
  /** Welcome's wordmark. */
  hero: { ...roundedRole(54, 58, weight.heavy, -1.5), color: sheetColors.ink },
  /** One line under a title (PB1 `4 days a week`, Welcome's lede). */
  sub: { ...roundedRole(17, 22, weight.semibold), color: sheetColors.muted },
  /** A pack's name (PB1 `.pack b`). */
  packTitle: { ...roundedRole(20, 24, weight.heavy, -0.3), color: sheetColors.ink },
  /** A pack's fact line (`.pack span.s`). */
  packSub: { ...roundedRole(14, 18, weight.semibold), color: sheetColors.muted },
  /** A cartridge's label window (Doto 9). */
  cartLabel: lcdRole(9, 11),
  /** The `+` in an empty cartridge slot. */
  cartPlus: { ...roundedRole(22, 26, weight.heavy), color: sheetColors.sectionLabel },
  /** Units and days: the chosen value and the others (residue). */
  choice: { ...roundedRole(64, 68, weight.heavy, -1.5), color: sheetColors.ink },
  choiceResidue: { ...roundedRole(28, 32, weight.heavy, -0.5), color: sheetColors.sectionLabel },
  /** The name field (no line height: a TextInput). */
  field: { fontFamily: fontFamily.rounded, fontSize: 22, fontWeight: weight.bold, color: sheetColors.ink },
  /** Days a week (D74): the wheel's number in SF Mono heavy, the steps around it dim. */
  wheelNumber: { fontFamily: fontFamily.mono, fontSize: 168, lineHeight: 176, fontWeight: weight.heavy, color: sheetColors.ink },
  /** The `PRO` mark on a locked swatch. */
  lock: lcdRole(10, 12),
  /** The paywall: the headline, a plan card's price and sub, feature rows, small print. */
  headline: { ...roundedRole(26, 30, weight.heavy, -0.5), color: sheetColors.ink },
  planPrice: { ...roundedRole(17, 22, weight.heavy), color: sheetColors.ink },
  planSub: { ...roundedRole(13, 17, weight.semibold), color: sheetColors.muted },
  featureTitle: { ...roundedRole(16, 20, weight.heavy), color: sheetColors.ink },
  featureDetail: { ...roundedRole(14, 18, weight.semibold), color: sheetColors.muted },
  note: { ...roundedRole(13, 17, weight.semibold), color: sheetColors.muted },
  link: { ...roundedRole(13, 17, weight.bold), color: sheetColors.controlInk },
  terms: { ...roundedRole(11, 15, weight.semibold), color: sheetColors.sectionLabel },
  /** `Not now` (top right). */
  notNow: { ...roundedRole(16, 20, weight.bold), color: sheetColors.controlInk },
  /** The knob's FREE and PRO marks (Doto, spaced). */
  knobMark: { ...lcdRole(15, 18), letterSpacing: 2 },
} as const;

/** Onboarding geometry (PB1, N10; 390 × 844 reference). */
export const onboardingGeometry = {
  /** Side margin of a step. */
  gutter: 16,
  /** The title's top under the back control. */
  titleTop: 16,
  subTop: 8,
  /** The light Continue pill: full width, 60 tall (PB1 `.cta`). */
  ctaHeight: 60,
  ctaBottom: 34,
  /** A pack (PB1 `.pack`): 150 tall, r26, 16 × 18 padding, the selected one ringed 3pt orange. */
  packHeight: 150,
  packRadius: 26,
  packPadY: 16,
  packPadX: 18,
  packGap: 12,
  packRing: 3,
  /** Cartridges (`.cart`): 40 × 64, r9 at the top and r5 at the bottom, a 5pt lip, 6 apart. */
  cartW: 40,
  cartH: 64,
  cartRadiusTop: 9,
  cartRadiusBottom: 5,
  cartLip: 5,
  cartGap: 6,
  cartWindowInset: 5,
  cartWindowTop: 7,
  cartWindowH: 24,
  cartWindowRadius: 4,
  cartGripInset: 9,
  cartGripBottom: 7,
  cartGripH: 10,
  cartGripPeriod: 4,
  cartGripRidge: 2,
  cartBlankRing: 2,
  /** Characters a label window holds (Doto 9 in 30pt). */
  cartLabelChars: 5,
  /** The name field: 56 tall, r20. */
  fieldHeight: 56,
  fieldRadius: 20,
  fieldPadX: 18,
  /** Units and days: the hero's box, so the baseline never moves. */
  choiceHeight: 68,
  choiceResidueDrop: 5,
  /** Welcome's device object, at most this share of the screen's height. */
  welcomeDeviceShare: 0.5,
  /**
   * Days a week (D74): a tall wheel in a metal bezel on the right, the number drum on the left.
   * One day per `daysStep` of travel; past 2 or 6 the wheel gives at `daysBand` of the finger.
   */
  daysWheelWidth: 104,
  daysWheelMaxHeight: 500,
  daysWheelBezel: 10,
  daysWheelRadius: 38,
  daysStep: 46,
  daysBand: 0.3,
  /** The rubber band never gives more than this (days), so the end number stays in view. */
  daysBandMax: 0.45,
  /** How far the release velocity throws the wheel (seconds of travel) before it settles. */
  daysThrow: 0.09,
  /** The drum: one row per day, the steps around the current one smaller and dimmer. */
  daysRow: 132,
  daysStepScale: 0.5,
  daysStepFade: 0.62,
  /** The amber notch between the drum and the wheel. */
  daysNotch: 10,
  /** The wheel's end stop fires this far past 2 or 6 (days). */
  daysStopAt: 0.12,
  /** The tall wheel's ridges (the device wheel's are 5 and 2). */
  daysRidgeLight: 7,
  daysRidgeDark: 4,
  /** Pick your finish: the device object takes what's left above the swatches. */
  finishDeviceShare: 0.56,
  /** The lock mark on a locked swatch (top right, 12 in). */
  lockInset: 10,
  lockPadX: 6,
  lockHeight: 18,
  lockRadius: 9,
} as const;

/** The device drawn as an object on the grid (onboarding): its body corner and drop shadow. */
export const deviceObject = {
  /** The reference frame the object is laid out in, then scaled. */
  width: 390,
  padTop: 28,
  padBottom: 30,
  displayHeight: 300,
  radius: 56,
  shadow: 'rgba(0,0,0,0.55)',
  shadowY: 24,
  shadowBlur: 48,
  /** Welcome: the object fades in and rises this far. */
  rise: 16,
} as const;

/** Days a week (D74): the tall wheel's cylinder shading, dark at both ends with a glint in the middle. */
export const daysWheelColors = {
  shade: '#000000',
  shadeOpacity: 0.55,
  glint: '#FFFFFF',
  glintOpacity: 0.14,
} as const;

/** First open (D74): the machine assembles itself in space. */
export const assemblyColors = {
  /** Space, darker than the moments' grid ground; the grid only appears at the bang. */
  ground: '#050505',
  star: '#FFFFFF',
  starWarm: '#FFDCBE',
  starOpacity: 0.55,
  starLargeOpacity: 0.3,
  haze: '#FF7832',
  hazeOpacity: 0.12,
  hazeCool: '#7890FF',
  hazeCoolOpacity: 0.07,
  /** The light behind the body, so its edges glow. */
  rim: '#FFECD2',
  rimOuter: '#FF8C3C',
  rimOpacity: 0.5,
  /** Amber: the outline flash, the sparks, the charge, the burst and the ring. */
  amber: lcd.amber,
  spark: '#FFDCB4',
  ring: 'rgba(255,106,26,0.55)',
} as const;

/** First open (D74): distances, scales and sizes, in the device object's 390 frame unless noted. */
export const assemblyGeometry = {
  /** The stars: two seeded layers drifting up at different speeds (screen points). */
  starCount: 70,
  starLargeCount: 18,
  starSize: 2,
  starLargeSize: 5,
  starDrift: 300,
  starLargeDrift: 640,
  /** The camera's distance for the body's tilt (perspective). */
  perspective: 900,
  /** The body floats in from deep space: small, tilted and turned; visible after this share of it. */
  arriveFade: 0.15,
  arriveScale: 0.06,
  arriveTilt: 48,
  arriveTurn: -28,
  arriveY: -120,
  /** Parts fly in from off the body: the display and the rocker from above, the rest from the sides. */
  fromTop: -820,
  fromSide: 440,
  fromSpin: 25,
  /** The whole body recoils this much on every hit. */
  kick: 1.045,
  /** The camera pushes in while the Start key charges, and snaps back at the bang. */
  pushIn: 1.08,
  /** The outline flash once the body has landed: up over this share, then down. */
  traceWidth: 2,
  traceGlow: 26,
  traceUp: 0.1,
  /** The light behind the body: its size against the body, while floating in, and at rest. */
  rimOverhang: 1.35,
  rimArrive: 0.7,
  rimRest: 0.2,
  /** A spark where each part lands. */
  spark: 90,
  sparkGrow: 1.6,
  /** The Start key hovers huge and trembles (degrees, alternating) before it slams; it fades in over `keyFade` of the hover. */
  keyFade: 0.12,
  keyHover: 2.7,
  keyHold: 2.2,
  keyLast: 2.06,
  tremble: [-1.5, 1.5, -2, 2.5, -3, 3.5, -4, 4.5, -5, 5.5] as readonly number[],
  /** The glow building behind the Start key. */
  chargeGlow: 200,
  chargeFrom: 0.6,
  chargePeak: 1.5,
  chargeGrow: 2.6,
  /** The glow's flash fades this long after the bang (ms). */
  chargeOut: 180,
  /** The display boots like the plan insert's: off, on, flicker, on (opacity steps over the boot). */
  bootSteps: [
    [0, 0],
    [0.2, 1],
    [0.35, 0.1],
    [0.5, 1],
    [0.65, 0.3],
    [0.8, 1],
  ] as readonly (readonly [number, number])[],
  scanOpacity: 0.45,
  burstOpacity: 0.55,
  /** The bang (screen points): the shake, the shockwave ring, the scan line on the display. */
  shake: [
    [-16, 12],
    [14, -11],
    [-11, 9],
    [9, -7],
    [-6, 5],
    [4, -3],
    [-2, 2],
    [1, -1],
  ] as readonly (readonly [number, number])[],
  ring: 300,
  ringFrom: 0.7,
  ringTo: 3.2,
  ringWidth: 2,
  scan: 30,
} as const;

/** The paywall (N9, D13). */
export const paywallGeometry = {
  topBar: 44,
  gutter: 16,
  /** The knob hero: the knob, its ridged ring and cap, the pointer, the arc and the marks. */
  knob: 128,
  knobRidges: 72,
  knobCapInset: 17,
  knobLip: 6,
  pointerW: 6,
  pointerH: 28,
  pointerTop: 10,
  arcGap: 12,
  arcStroke: 3,
  /** The knob's angle at FREE and at PRO (degrees; 0 points up). */
  freeAngle: -70,
  proAngle: 0,
  markGap: 6,
  /** The ridge count the turn ticks through (a detent haptic per step). */
  detents: 7,
  /** Feature rows: a lamp, then the title over its line. */
  featureGap: 8,
  featureLamp: 10,
  featureLampTop: 5,
  /** Plan pill cards (N9 `.plan`): 64 tall, r20, a 2pt quiet ring; selected 3pt orange. */
  planHeight: 64,
  planRadius: 20,
  planPadX: 18,
  planGap: 8,
  planRing: 2,
  planRingOn: 3,
  /** Trial timeline nodes. */
  node: 24,
  nodeRail: 2,
  ctaHeight: 56,
} as const;

/** Paywall colours (N9). */
export const paywallColors = {
  /** The warm glow behind the knob (N9 `.sheet` gradient top). */
  glow: '#2A2018',
  glowClear: 'rgba(42,32,24,0)',
  /** A plan card's quiet ring (`inset 0 0 0 2px #3A3936`). */
  planRing: '#3A3936',
  /** The arc from FREE (unlit). */
  arcOff: '#6E5A3A',
  /** The knob's pointer glow. */
  pointerGlow: 'rgba(255,106,26,0.8)',
  /** The knob's cast shadow. */
  knobShadow: 'rgba(0,0,0,0.6)',
  /** A lamp before each feature, off then lit. */
  lampOff: '#3A2214',
} as const;

/** Plan packs (PB1): the pack card and its cartridges. */
export const packColors = {
  /** `.pack` ground (the rack's shelf colour). */
  pack: '#1C1C1A',
  packHighlight: 'rgba(255,255,255,0.06)',
  cartHighlight: '#FFFFFF',
  cartGrip: '#B9B4AA',
  /** An empty slot's ring (`.cart.blank`). */
  blankRing: '#3A3936',
} as const;

/* ------------------------------------------------------------------------------------------ *
 * The guided tour (decision 85): Trim talks on its display, a focus ring on the control it
 * names, then the launch into the Graphite reward on Trim's dot-matrix room.
 * ------------------------------------------------------------------------------------------ */

export const tourType = {
  /** Trim's lines under the practice set. */
  lcdChat: lcdRole(16, 20),
  /** Trim's lines on a whole display (hello, the end). */
  lcdChatLarge: lcdRole(24, 30),
  /** `READY` over the last lines. */
  lcdReady: lcdRole(56, 60),
} as const;

export const tourColors = {
  /** The focus ring's glow (the brand orange at ~50%). */
  focusGlow: 'rgba(255,106,26,0.5)',
  /** The ground the gift's machines stand on (decision 95). */
  roomGround: '#0A0A09',
} as const;

export const tourGeometry = {
  /** Trim's chat strip at the foot of the display, and its dotted rule. */
  chatHeight: 108,
  chatRuleWidth: 2,
  chatRuleDash: 2,
  chatGap: 7,
  chatTop: 9,
  /** The display's own focus frame on the first line (tap my screen). */
  focusStroke: 3,
  focusOffset: 5,
  focusGlowRadius: 24,
  /**
   * The gift (decision 95). The old skin falls: down this many screen heights, tilting this far
   * about a pivot this far across its top edge.
   */
  dropFall: 1.1,
  dropTilt: 9,
  dropPivotX: 0.3,
  /** The row of six machines: each card this share of the screen's width, this far apart. */
  cardWidth: 0.6,
  cardGap: 18,
  /** A neighbour sits smaller and dimmer; cards further than this from the middle aren't drawn. */
  sideScale: 0.9,
  sideOpacity: 0.5,
  cardsDrawn: 2,
  /** A flick carries on this long (s) before it clicks into a machine; past either end it gives like a rubber band. */
  swipeThrow: 0.1,
  swipeBand: 0.35,
  swipeBandMax: 0.4,
  /** The skin dots under the row: their size, the gap and ring round the picked one, and the 44 hit area. */
  dotSize: 26,
  dotGap: 6,
  dotRing: 2,
  dotRingGap: 3,
  dotHit: 44,
  /** The foot (label, dots, Use) fades in over the last part of the step back. */
  footFrom: 0.5,
} as const;

/**
 * Import plan (decision 88): the illustration on the dotted tile, the reading screen's progress bar
 * and found-lift marks, and the Fix screen's cards. Onboarding and the Plans sheet share them.
 */
export const importColors = {
  /** The illustration's tile and its dots. */
  tile: '#1C1C1A',
  tileDot: '#2E2E2B',
  /** The drawn phone: its outline, screen, list rows and the bars that stand for text. */
  phoneEdge: '#3A3936',
  phoneScreen: '#0E0E0D',
  phoneRow: '#1F1F1D',
  barStrong: '#8C8A84',
  barSoft: '#4A4946',
  barFaint: '#3A3936',
  /** The copied snippet flying to Paste: paper with grey lines. */
  paper: '#F3F2EE',
  paperLineStrong: '#8C8A84',
  paperLineSoft: '#C9C6BF',
  /** The selection over the copied reply (orange at .28). */
  selection: 'rgba(255,106,26,0.28)',
  flash: '#FFFFFF',
  /** A found lift's ✓ and an unknown one's ?. */
  found: '#4C8F57',
  unknown: '#F2550F',
  markInk: '#FFFFFF',
  /** New plan's device cards: a metal face, Trim's own keys, the three sources. */
  deviceHi: '#3D3C39',
  deviceLo: '#1D1C1A',
  deviceSub: '#A9A69E',
  /** The cards' round key: Trim's raised metal key, not the orange action (neither choice is preferred). */
  keyHi: '#5E5D59',
  keyLo: '#31302D',
  keyLip: '#1D1C1A',
  keyInk: '#EDEBE5',
  /** The source on turn: a light ring, not orange. */
  sourceRing: '#D9D6CF',
  sourceChip: '#262624',
  sourceNote: '#FBFAF7',
  sourceNoteInk: '#1C1B18',
  sourceAi: '#3A3936',
  sourceAiInk: '#EDEBE5',
  sourceApp: '#5E5D59',
  sourceAppInk: '#FFFFFF',
  /** The arrows from the sources down to Trim: quiet metal, brighter on the source's turn. */
  arrow: '#5E5D59',
  arrowOn: '#D9D6CF',
  /** The placeholders that breathe before the first lift is found. */
  placeholder: '#1A1A19',
  placeholderLabel: '#232321',
} as const;

export const importGeometry = {
  /** The illustration: a tile filling the stage, a drawn phone in its middle. */
  tileRadius: 28,
  tileDotPitch: 14,
  tileDotRadius: 1.2,
  tileMinHeight: 300,
  phoneWidth: 150,
  phoneHeight: 270,
  phoneRadius: 28,
  phoneBorder: 2,
  phoneTop: 28,
  phonePadTop: 26,
  phonePadX: 12,
  /** A text bar in the drawing, and a heading bar. */
  bar: 5,
  barHeading: 6,
  barRadius: 3,
  bubbleWidth: 78,
  bubbleHeight: 22,
  bubbleRadius: 11,
  selectionRadius: 10,
  pillHeight: 22,
  pillPadX: 10,
  pillRise: 26,
  rowHeight: 40,
  rowRadius: 10,
  rowIcon: 22,
  rowIconRadius: 6,
  /** The badge naming the scene (a chat bubble, a screenshot frame). */
  badge: 44,
  badgeOffsetX: -100,
  badgeTop: 14,
  /** The copied snippet: paper this size, flying this far down at this scale. */
  snippetWidth: 100,
  snippetHeight: 84,
  snippetRadius: 12,
  snippetTop: 110,
  flyScale: 0.24,
  shotScale: 0.42,
  shotFlyScale: 0.12,
  /** The reading screen's progress bar. */
  barHeight: 4,
  barTrackRadius: 2,
  /** A found lift's row, and its ✓ / ? mark. */
  liftRow: 48,
  mark: 22,
  markRadius: 11,
  /** The placeholders before the first lift: label width, and two card heights. */
  placeholderLabelWidth: 80,
  placeholderLabelHeight: 13,
  placeholderCardTall: 184,
  placeholderCardShort: 138,
  /** The plan name field on the reading screen. */
  nameHeight: 40,
  /** A Fix card's choice rows and the search field. */
  choiceHeight: 48,
  choiceRadius: 14,
  /** New plan (the rack's sheet): each of the two cards is this tall. */
  forkCardHeight: 320,
  /** New plan's device cards: the face, the display, the source chips and the keys. */
  deviceRadius: 28,
  devicePad: 14,
  displayRadius: 16,
  displayPad: 12,
  sourceChip: 58,
  sourceChipRadius: 14,
  sourceTile: 26,
  sourceTileRadius: 8,
  /** The arrow under each source, pointing down at Trim. */
  arrow: 18,
  sideKey: 46,
  keyLip: 3,
  /** A built lift's row on the display. */
  displayRow: 22,
  /** Onboarding's radios: the selected card's orange ring. */
  selectedRing: 3,
  /** Got a plan?: the two cards' art. */
  noteWidth: 54,
  noteHeight: 76,
  noteTilt: 6,
} as const;

export const importType = {
  /** A Fix card's quoted name and a tracking choice's title. */
  cardTitle: { ...roundedRole(17, 22, weight.heavy), color: sheetColors.ink },
  cardMeta: { ...roundedRole(14, 18, weight.semibold), color: sheetColors.muted },
  choice: { ...roundedRole(16, 20, weight.semibold), color: sheetColors.ink },
  choiceMeta: { ...roundedRole(13, 16, weight.semibold), color: sheetColors.sectionLabel },
  /** A found lift's name and its sets × reps. */
  lift: { ...roundedRole(17, 22, weight.semibold), color: sheetColors.ink },
  liftValue: { ...roundedRole(15, 20, weight.semibold), color: sheetColors.muted },
  mark: { ...roundedRole(13, 16, weight.heavy), color: importColors.markInk },
  /** The plan name field (no line height: a TextInput). */
  name: { fontFamily: fontFamily.rounded, fontSize: 30, fontWeight: weight.heavy, color: sheetColors.ink },
  /** Got a plan?: a card's title and its one line. */
  forkTitle: { ...roundedRole(26, 30, weight.heavy, -0.4), color: sheetColors.ink },
  forkSub: { ...roundedRole(15, 20, weight.semibold), color: sheetColors.muted },
  /** New plan's source chips (Note, AI chat, Workout app) and the + key's glyph. */
  sourceName: { ...roundedRole(13, 15, weight.heavy), color: sheetColors.inkSoft },
  keyGlyph: { ...roundedRole(24, 26, weight.heavy), color: importColors.keyInk },
  /** The drawn Copy pill. */
  artPill: { ...roundedRole(11, 13, weight.heavy), color: sheetColors.pillLightInk },
} as const;
