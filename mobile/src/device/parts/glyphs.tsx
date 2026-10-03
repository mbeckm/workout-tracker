import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { deviceColors, iconSize } from '@/constants/theme';

/** Key glyphs drawn from the prototype's inline SVGs (22 × 22). */
type GlyphProps = { color?: string; size?: number };

const STROKE = 2.6;
const STROKE_THIN = 2.4;

/** The menu key: two sliders. */
export function MenuGlyph({ color = deviceColors.keyInk, size = iconSize.control }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <G stroke={color} strokeWidth={STROKE} strokeLinecap="round">
        <Line x1={3} y1={6} x2={19} y2={6} />
        <Line x1={3} y1={16} x2={19} y2={16} />
      </G>
      <Circle cx={8} cy={6} r={3} fill={deviceColors.key1} stroke={color} strokeWidth={STROKE_THIN} />
      <Circle cx={14} cy={16} r={3} fill={deviceColors.key1} stroke={color} strokeWidth={STROKE_THIN} />
    </Svg>
  );
}

/** History: a clock. */
export function HistoryGlyph({ color = deviceColors.keyInk, size = iconSize.control }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={8} fill="none" stroke={color} strokeWidth={STROKE_THIN} />
      <Path
        d="M11 6 V11 L14.5 13"
        fill="none"
        stroke={color}
        strokeWidth={STROKE_THIN}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Today's lifts: a list. */
export function ListGlyph({ color = deviceColors.keyInk, size = iconSize.control }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <G stroke={color} strokeWidth={STROKE} strokeLinecap="round">
        <Line x1={8} y1={5} x2={19} y2={5} />
        <Line x1={8} y1={11} x2={19} y2={11} />
        <Line x1={8} y1={17} x2={19} y2={17} />
      </G>
      <G fill={color}>
        <Circle cx={3.5} cy={5} r={1.8} />
        <Circle cx={3.5} cy={11} r={1.8} />
        <Circle cx={3.5} cy={17} r={1.8} />
      </G>
    </Svg>
  );
}

/** Weight-800 stroke for the drawn key glyphs (measured from screens 04 and 08). */
const STROKE_HEAVY = 2.6;
const STROKE_TALL = 3;

/** Undo last set: the prototype's ↶, a counter-clockwise arc with an open arrowhead. */
export function UndoGlyph({ color = deviceColors.keyInk, size = iconSize.control }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <G
        fill="none"
        stroke={color}
        strokeWidth={STROKE_HEAVY}
        strokeLinecap="round"
        strokeLinejoin="round">
        <Path d="M17.9 10.1 C17.9 6.6 15.3 4.8 12.7 4.8 C10.1 4.8 8 6.9 8 10 L8 13.2" />
        <Path d="M4.5 9.8 L8 13.3 L11.5 9.8" />
      </G>
    </Svg>
  );
}

/** Tall key glyphs: 16pt + and − (screens 04, 05), 3pt strokes. */
const TALL_GLYPH = 16;

export function PlusGlyph({ color = deviceColors.keyInk, size = TALL_GLYPH }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <G stroke={color} strokeWidth={STROKE_TALL} strokeLinecap="round">
        <Line x1={1.5} y1={8} x2={14.5} y2={8} />
        <Line x1={8} y1={1.5} x2={8} y2={14.5} />
      </G>
    </Svg>
  );
}

export function MinusGlyph({ color = deviceColors.keyInk, size = TALL_GLYPH }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Line x1={1.5} y1={8} x2={14.5} y2={8} stroke={color} strokeWidth={STROKE_TALL} strokeLinecap="round" />
    </Svg>
  );
}
