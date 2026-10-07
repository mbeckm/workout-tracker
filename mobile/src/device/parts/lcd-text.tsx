import { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { lcd, type ScreenColors } from '@/constants/theme';
import { useScreen } from '@/device/finish';

type AnimatedTextStyle = StyleProp<AnimatedStyle<StyleProp<TextStyle>>>;

/*
 * The display code is written with the amber tokens (`lcd.*`, `gadgetType.lcd*`). A machine's
 * screen (decision 80) has the same keys in its own colours; these helpers swap one for the
 * other: `LcdText` for text, `useScreenStyles` for a file's styles, and `useScreen()` (shadowing
 * the `lcd` import inside a component) for inline colours.
 */

type Tone = 'ink' | 'dim' | 'other';

/** Amber token → the same key on another screen. `lcd` and `doneRowInk` share a value; both
 * map to near-identical colours on every screen, so the ground wins. */
const KEYS = [
  'amber',
  'amberDim',
  'amberOff',
  'amberPress',
  'amberGlow',
  'lcdClear',
  'lcd',
  'doneRowMeta',
  'todoRow',
  'lcdShade',
] as const;

function swap(value: string, screen: ScreenColors): string {
  if (screen === lcd) return value;
  let out = value;
  for (const key of KEYS) {
    if (out.includes(lcd[key])) out = out.split(lcd[key]).join(screen[key]);
  }
  return out;
}

function toneOf(color: unknown, screen: ScreenColors): Tone {
  if (color === screen.amber || color === lcd.amber) return 'ink';
  if (color === screen.amberDim || color === lcd.amberDim) return 'dim';
  return 'other';
}

/** The screen's glow on ink (a softer one on dim ink); none on text over a done row. */
function glowFor(screen: ScreenColors, tone: Tone): TextStyle | null {
  if (tone === 'other' || (screen.glowRadius === 0 && screen.glowOffset.width === 0)) return null;
  return {
    textShadowColor: screen.glow,
    textShadowRadius: tone === 'ink' ? screen.glowRadius : screen.glowRadius / 2,
    textShadowOffset: screen.glowOffset,
  };
}

const cache = new WeakMap<object, Map<string, object>>();

/** A file's StyleSheet in the machine's screen colours (memoised per screen). */
export function useScreenStyles<T extends Record<string, object>>(styles: T): T {
  const screen = useScreen();
  return useMemo(() => {
    let byScreen = cache.get(styles);
    if (!byScreen) {
      byScreen = new Map();
      cache.set(styles, byScreen);
    }
    const hit = byScreen.get(screen.name);
    if (hit) return hit as T;
    const out: Record<string, object> = {};
    for (const [name, style] of Object.entries(styles)) {
      const next: Record<string, unknown> = {};
      for (const [prop, value] of Object.entries(style)) {
        next[prop] = typeof value === 'string' ? swap(value, screen) : value;
      }
      out[name] = next;
    }
    byScreen.set(screen.name, out);
    return out as T;
  }, [styles, screen]);
}

/**
 * Text on the display: a fixed size (hardware, never scales), written with the amber tokens and
 * drawn in the machine's screen colours with its glow. A Reanimated style goes in
 * `animatedStyle`, after the static one; `glow={false}` for text on a done row's fill.
 */
export function LcdText({
  style,
  animatedStyle,
  lines,
  glow = true,
  ...rest
}: Omit<TextProps, 'style'> & {
  style?: StyleProp<TextStyle>;
  animatedStyle?: AnimatedTextStyle;
  lines?: number;
  glow?: boolean;
}) {
  const screen = useScreen();
  const flat = StyleSheet.flatten(style) ?? {};
  const color = typeof flat.color === 'string' ? swap(flat.color, screen) : flat.color;
  const own = [flat, { color }, glow ? glowFor(screen, toneOf(color, screen)) : null];
  if (animatedStyle) {
    return (
      <Animated.Text maxFontSizeMultiplier={1} numberOfLines={lines} {...rest} style={[...own, animatedStyle]} />
    );
  }
  return <Text maxFontSizeMultiplier={1} numberOfLines={lines} {...rest} style={own} />;
}
