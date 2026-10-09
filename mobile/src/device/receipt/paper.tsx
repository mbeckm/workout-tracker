import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { receiptColors, receiptGeometry as g } from '@/constants/theme';

/**
 * The papers: the full receipt (thermal lines, slot shade), the finish screen's receipt (`stub`:
 * thermal lines, torn at the top, since it prints up out of its slot), a History slip (`mini`),
 * the week report.
 */
export type PaperKind = 'receipt' | 'stub' | 'mini' | 'week';

const TEETH: Record<PaperKind, { width: number; depth: number }> = {
  receipt: { width: g.toothWidth, depth: g.toothDepth },
  stub: { width: g.stubToothWidth, depth: g.stubToothDepth },
  mini: { width: g.miniToothWidth, depth: g.miniToothDepth },
  week: { width: g.weekToothWidth, depth: g.weekToothDepth },
};

const SHADOW: Record<PaperKind, string> = {
  receipt: `0 ${g.shadowY}px ${g.shadowBlur}px ${receiptColors.shadow}`,
  stub: `0 ${g.stubShadowY}px ${g.stubShadowBlur}px ${receiptColors.shadow}`,
  mini: `0 ${g.miniShadowY}px ${g.miniShadowBlur}px ${receiptColors.shadow}`,
  week: `0 ${g.momentShadowY}px ${g.momentShadowBlur}px ${receiptColors.shadow}`,
};

/**
 * The torn edge (prototype `conic-gradient(from -45deg at bottom)` mask): 45° teeth `width` wide
 * whose points touch the bottom (or, `top`, the top), tiles centred like CSS's `bottom`
 * position. The valleys sit `min(depth, width / 2)` in from the edge.
 */
export function tornPath(width: number, height: number, tooth: number, depth: number, edge: 'top' | 'bottom' = 'bottom'): string {
  const rise = Math.min(depth, tooth / 2);
  const centre = width / 2;
  const inset = (x: number) => {
    const offset = (((x - centre) % tooth) + tooth) % tooth;
    const toApex = Math.min(offset, tooth - offset);
    return Math.min(toApex, rise);
  };
  const xs = new Set<number>([0, width]);
  const first = centre - Math.ceil(centre / (tooth / 2)) * (tooth / 2);
  for (let x = first; x < width; x += tooth / 2) {
    if (x > 0) xs.add(x);
  }
  if (edge === 'top') {
    const points = [...xs].sort((a, b) => a - b).map((x) => `L${x.toFixed(2)},${inset(x).toFixed(2)}`);
    return `M0,${height} ${points.join(' ')} L${width},${height} Z`;
  }
  const points = [...xs].sort((a, b) => b - a).map((x) => `L${x.toFixed(2)},${(height - inset(x)).toFixed(2)}`);
  return `M0,0 L${width},0 ${points.join(' ')} Z`;
}

let paperSeq = 0;

/**
 * Paper of a known width, drawn without measuring (a mini on the wall, where FlashList recycles
 * cells fast): a flat gradient body over a strip of teeth. Same look as `Paper kind="mini"`.
 */
export function SlipPaper({
  width,
  children,
  contentStyle,
}: {
  width: number;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const teeth = TEETH.mini;
  return (
    <View style={{ width }}>
      <View style={[styles.slipBody, { boxShadow: SHADOW.mini }, contentStyle]}>{children}</View>
      <Svg width={width} height={teeth.depth} pointerEvents="none">
        <Path d={tornPath(width, teeth.depth, teeth.width, teeth.depth)} fill={receiptColors.paperBottom} />
      </Svg>
    </View>
  );
}

/**
 * Receipt paper (SPEC §2, §6): `#FCFAF4` to `#EFEADF`, torn at the bottom, a soft cast shadow.
 * The full receipt adds faint thermal lines, a vignette and the shade where it leaves the slot.
 * Drawn with react-native-svg behind its content, sized from layout.
 */
export function Paper({
  kind,
  children,
  style,
  contentStyle,
}: {
  kind: PaperKind;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [ids] = useState(() => {
    paperSeq += 1;
    return { cut: `cut${paperSeq}`, fill: `fill${paperSeq}`, lines: `lines${paperSeq}`, shade: `shade${paperSeq}` };
  });
  const teeth = TEETH[kind];
  // The receipt and the stub are thermal paper; the stub is torn at the top and leaves its slot at the bottom.
  const thermal = kind === 'receipt' || kind === 'stub';
  const edge = kind === 'stub' ? 'top' : 'bottom';
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) {
      setSize({ width, height });
    }
  };

  return (
    <View style={style} onLayout={onLayout}>
      {/* The shadow follows the paper above the teeth; under them it reads as the cast shade. */}
      <View
        pointerEvents="none"
        style={[
          styles.shadow,
          edge === 'top' ? { top: teeth.depth, bottom: 0 } : { bottom: teeth.depth },
          { boxShadow: SHADOW[kind] },
        ]}
      />
      {size ? (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <ClipPath id={ids.cut}>
              <Path d={tornPath(size.width, size.height, teeth.width, teeth.depth, edge)} />
            </ClipPath>
            {thermal ? (
              // `radial-gradient(ellipse at 50% 40%, #FCFAF4, #F1ECE0 85%)`, farthest-corner.
              <RadialGradient id={ids.fill} cx="50%" cy="40%" rx="71%" ry="85%" gradientUnits="objectBoundingBox">
                <Stop offset="0" stopColor={receiptColors.paperTop} />
                <Stop offset="0.85" stopColor={receiptColors.paperEdge} />
              </RadialGradient>
            ) : (
              <LinearGradient id={ids.fill} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={receiptColors.paperTop} />
                <Stop offset="1" stopColor={receiptColors.paperBottom} />
              </LinearGradient>
            )}
            {thermal ? (
              <>
                <Pattern id={ids.lines} width={size.width} height={g.thermalPeriod} patternUnits="userSpaceOnUse">
                  <Rect
                    y={g.thermalPeriod - 1}
                    width={size.width}
                    height={1}
                    fill={receiptColors.thermalLine}
                    fillOpacity={receiptColors.thermalLineOpacity}
                  />
                </Pattern>
                <LinearGradient
                  id={ids.shade}
                  x1="0"
                  y1={edge === 'top' ? size.height : 0}
                  x2="0"
                  y2={edge === 'top' ? size.height - g.shadeHeight : g.shadeHeight}
                  gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={receiptColors.slotShade} stopOpacity={receiptColors.slotShadeOpacity} />
                  <Stop offset="1" stopColor={receiptColors.slotShade} stopOpacity={0} />
                </LinearGradient>
              </>
            ) : null}
          </Defs>
          <G clipPath={`url(#${ids.cut})`}>
            <Rect width={size.width} height={size.height} fill={`url(#${ids.fill})`} />
            {thermal ? (
              <>
                <Rect width={size.width} height={size.height} fill={`url(#${ids.lines})`} />
                <Rect
                  y={edge === 'top' ? size.height - g.shadeHeight : 0}
                  width={size.width}
                  height={g.shadeHeight}
                  fill={`url(#${ids.shade})`}
                />
              </>
            ) : null}
          </G>
        </Svg>
      ) : null}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

/** The dashed rule (`hr`: 1 pt dashed #B9B6AE). */
export function DashedRule({ gap }: { gap: number }) {
  return (
    <Svg height={1} width="100%" style={{ marginVertical: gap }}>
      <Line
        x1="0"
        y1="0.5"
        x2="100%"
        y2="0.5"
        stroke={receiptColors.rule}
        strokeWidth={1}
        strokeDasharray={[g.ruleDash, g.ruleDash]}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  slipBody: {
    experimental_backgroundImage: `linear-gradient(180deg, ${receiptColors.paperTop}, ${receiptColors.paperBottom})`,
  },
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: receiptColors.paperBottom,
  },
});
