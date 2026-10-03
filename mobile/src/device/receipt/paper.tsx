import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { fontScaleCap, gadgetType, receiptColors, receiptGeometry as g, space } from '@/constants/theme';
import type { ReceiptRow } from '@/device/receipt-model';

/** The three papers: the full receipt (thermal lines, slot shade), a mini on the wall, the week report. */
export type PaperKind = 'receipt' | 'mini' | 'week';

const TEETH: Record<PaperKind, { width: number; depth: number }> = {
  receipt: { width: g.toothWidth, depth: g.toothDepth },
  mini: { width: g.miniToothWidth, depth: g.miniToothDepth },
  week: { width: g.weekToothWidth, depth: g.weekToothDepth },
};

const SHADOW: Record<PaperKind, string> = {
  receipt: `0 ${g.shadowY}px ${g.shadowBlur}px ${receiptColors.shadow}`,
  mini: `0 ${g.miniShadowY}px ${g.miniShadowBlur}px ${receiptColors.shadow}`,
  week: `0 ${g.momentShadowY}px ${g.momentShadowBlur}px ${receiptColors.shadow}`,
};

/**
 * The torn bottom edge (prototype `conic-gradient(from -45deg at bottom)` mask): 45° teeth
 * `width` wide whose points touch the bottom, tiles centred like CSS's `bottom` position. The
 * valleys sit `min(depth, width / 2)` above the points.
 */
export function tornPath(width: number, height: number, tooth: number, depth: number): string {
  const rise = Math.min(depth, tooth / 2);
  const centre = width / 2;
  const yAt = (x: number) => {
    const offset = (((x - centre) % tooth) + tooth) % tooth;
    const toApex = Math.min(offset, tooth - offset);
    return height - Math.min(toApex, rise);
  };
  const xs = new Set<number>([0, width]);
  const first = centre - Math.ceil(centre / (tooth / 2)) * (tooth / 2);
  for (let x = first; x < width; x += tooth / 2) {
    if (x > 0) xs.add(x);
  }
  const points = [...xs].sort((a, b) => b - a).map((x) => `L${x.toFixed(2)},${yAt(x).toFixed(2)}`);
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
        style={[styles.shadow, { bottom: teeth.depth, boxShadow: SHADOW[kind] }]}
      />
      {size ? (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <ClipPath id={ids.cut}>
              <Path d={tornPath(size.width, size.height, teeth.width, teeth.depth)} />
            </ClipPath>
            {kind === 'receipt' ? (
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
            {kind === 'receipt' ? (
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
                <LinearGradient id={ids.shade} x1="0" y1="0" x2="0" y2={g.shadeHeight} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={receiptColors.slotShade} stopOpacity={receiptColors.slotShadeOpacity} />
                  <Stop offset="1" stopColor={receiptColors.slotShade} stopOpacity={0} />
                </LinearGradient>
              </>
            ) : null}
          </Defs>
          <G clipPath={`url(#${ids.cut})`}>
            <Rect width={size.width} height={size.height} fill={`url(#${ids.fill})`} />
            {kind === 'receipt' ? (
              <>
                <Rect width={size.width} height={size.height} fill={`url(#${ids.lines})`} />
                <Rect width={size.width} height={g.shadeHeight} fill={`url(#${ids.shade})`} />
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

/** The full receipt's lines (SPEC §6 Receipt): Plex Mono 13/20, bold totals, PR lines in #C2410C. */
export function ReceiptRows({ rows }: { rows: readonly ReceiptRow[] }) {
  return (
    <>
      {rows.map((row, index) => {
        switch (row.kind) {
          case 'center':
            return (
              <Text
                key={index}
                maxFontSizeMultiplier={fontScaleCap.display}
                style={[row.bold ? gadgetType.receiptBold : gadgetType.receipt, styles.ink, styles.center]}>
                {row.text}
              </Text>
            );
          case 'rule':
            return <DashedRule key={index} gap={g.ruleGap} />;
          case 'detail':
            return (
              <Text
                key={index}
                maxFontSizeMultiplier={fontScaleCap.display}
                style={[gadgetType.receipt, styles.ink, styles.detail]}>
                {row.text}
              </Text>
            );
          case 'pair': {
            const bold = row.tone !== 'plain';
            const tone = [bold ? gadgetType.receiptBold : gadgetType.receipt, styles.ink, row.tone === 'pr' && styles.pr];
            return (
              <View key={index} style={styles.pair}>
                <Text maxFontSizeMultiplier={fontScaleCap.display} style={[tone, styles.left]}>
                  {row.left}
                </Text>
                {row.right ? (
                  <Text maxFontSizeMultiplier={fontScaleCap.display} style={tone}>
                    {row.right}
                  </Text>
                ) : null}
              </View>
            );
          }
          default:
            return null;
        }
      })}
    </>
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
  // Thermal ink bleeds a little (`text-shadow 0 0 .5px`).
  ink: {
    textShadowColor: receiptColors.inkBleed,
    textShadowRadius: 0.5,
    textShadowOffset: { width: 0, height: 0 },
  },
  center: { textAlign: 'center' },
  detail: { color: receiptColors.muted, paddingLeft: g.indent },
  pair: { flexDirection: 'row', justifyContent: 'space-between', gap: space.related },
  left: { flexShrink: 1 },
  pr: { color: receiptColors.pr },
});
