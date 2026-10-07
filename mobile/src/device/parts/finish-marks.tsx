import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { finishMarks, marksType } from '@/constants/theme';
import { useFinish } from '@/device/finish';

const P = finishMarks.pocket;
const B = finishMarks.bunker;
const F = finishMarks.field;

/**
 * What a machine prints on its display bezel (decision 80): Pocket's power lamp, maroon and
 * navy stripes, `DOT MATRIX` and `Trim POCKET`; Bunker's `UNIT 077`. Hardware, so it never
 * scales and VoiceOver skips it.
 */
export function BezelMarks() {
  const { palette } = useFinish();
  const bezel = palette.bezel;
  if (!bezel || !palette.marks) return null;
  const top = [styles.strip, { left: bezel.padH, right: bezel.padH, top: 0, height: bezel.padTop }];
  const bottom = [styles.strip, { left: bezel.padH, right: bezel.padH, bottom: 0, height: bezel.padBottom }];
  if (palette.marks === 'pocket') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        <View style={top}>
          <View style={styles.led} />
          <View style={styles.stripes}>
            <View style={[styles.stripe, { backgroundColor: P.maroon }]} />
            <View style={[styles.stripe, { backgroundColor: P.navy }]} />
          </View>
          <Text maxFontSizeMultiplier={1} style={[marksType.print, { color: P.ink }]}>
            DOT MATRIX
          </Text>
        </View>
        <View style={bottom}>
          <Text maxFontSizeMultiplier={1} style={[marksType.logo, { color: P.ink }]}>
            Trim POCKET
          </Text>
        </View>
      </View>
    );
  }
  if (palette.marks === 'bunker') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        <View style={[bottom, styles.center]}>
          <Text maxFontSizeMultiplier={1} style={[marksType.stencil, styles.stencilCentered, { color: B.stencil }]}>
            UNIT 077
          </Text>
        </View>
      </View>
    );
  }
  return null;
}

/**
 * What a machine carries on its body (decision 80): Pocket's speaker slots, Bunker's screws,
 * hazard plate, worn corners and scratches, Field's stencil and orange tab. Drawn over the body
 * and under the parts; `screwTop` is where Bunker's top screws sit (between the top row and the
 * display).
 */
export function BodyMarks({ screwTop }: { screwTop: number }) {
  const { palette, finish } = useFinish();
  if (palette.marks === 'pocket') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        <View style={styles.slots}>
          {Array.from({ length: P.slots }, (_, i) => (
            <View key={i} style={styles.slot} />
          ))}
        </View>
      </View>
    );
  }
  if (palette.marks === 'bunker') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id={`${finish}-wear-tl`} cx="0%" cy="0%" rx="22%" ry="10%">
              <Stop offset="0" stopColor={B.wear} />
              <Stop offset="1" stopColor={B.wearClear} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={`${finish}-wear-br`} cx="100%" cy="100%" rx="20%" ry="9%">
              <Stop offset="0" stopColor={B.wear} />
              <Stop offset="1" stopColor={B.wearClear} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${finish}-scratch`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={B.wear} stopOpacity={0} />
              <Stop offset="0.5" stopColor={B.wear} />
              <Stop offset="1" stopColor={B.wear} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${finish}-wear-tl)`} />
          <Rect width="100%" height="100%" fill={`url(#${finish}-wear-br)`} />
          <Line x1="38%" y1="4%" x2="56%" y2="5.4%" stroke={`url(#${finish}-scratch)`} strokeWidth={1} />
          <Line x1="1%" y1="48%" x2="3%" y2="52%" stroke={`url(#${finish}-scratch)`} strokeWidth={1} />
          <Line x1="82%" y1="93%" x2="93%" y2="95%" stroke={`url(#${finish}-scratch)`} strokeWidth={1} />
          <Line x1="90%" y1="30%" x2="97%" y2="33%" stroke={`url(#${finish}-scratch)`} strokeWidth={1} />
        </Svg>
        <Screw style={{ left: B.screwInset, top: screwTop }} />
        <Screw style={{ right: B.screwInset, top: screwTop }} />
        <Screw style={{ left: B.screwInset, bottom: B.screwBottom }} />
        <Screw style={{ right: B.screwInset, bottom: B.screwBottom }} />
        <View style={styles.hazard}>
          <Svg width={B.hazardW} height={B.hazardH}>
            <Rect width={B.hazardW} height={B.hazardH} fill={B.hazardBlack} />
            {Array.from({ length: Math.ceil(B.hazardW / B.hazardStripe) + 2 }, (_, i) => (
              <Line
                key={i}
                x1={i * B.hazardStripe * 2 - B.hazardH}
                y1={B.hazardH}
                x2={i * B.hazardStripe * 2}
                y2={0}
                stroke={B.hazardYellow}
                strokeWidth={B.hazardStripe * 0.7}
              />
            ))}
          </Svg>
        </View>
      </View>
    );
  }
  if (palette.marks === 'field') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        <Text maxFontSizeMultiplier={1} style={[marksType.stencil, styles.fieldStencil, { color: F.stencil }]}>
          FIELD 707
        </Text>
        <View style={styles.tab} />
      </View>
    );
  }
  return null;
}

/** Bunker's brass guard around the big key's well. */
export function WellRing({ size }: { size: number }) {
  const { palette } = useFinish();
  if (palette.marks !== 'bunker') return null;
  const outer = size + (B.ringGap + B.ringStroke) * 2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -(B.ringGap + B.ringStroke),
        top: -(B.ringGap + B.ringStroke),
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        borderWidth: B.ringStroke,
        borderColor: B.ring,
        boxShadow: `inset 0 1px 0 ${palette.keyHighlight}, 0 1px 0 ${B.screwRim}`,
      }}
    />
  );
}

function Screw({ style }: { style: object }) {
  return (
    <View style={[styles.screw, style]}>
      <View style={styles.screwSlot} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: P.ledSize },
  center: { justifyContent: 'center' },
  led: {
    width: P.ledSize,
    height: P.ledSize,
    borderRadius: P.ledSize / 2,
    backgroundColor: P.led,
    boxShadow: `0 0 8px ${P.ledGlow}`,
  },
  stripes: { flex: 1, gap: P.stripeGap },
  stripe: { height: P.stripeH },
  stencilCentered: { textAlign: 'center', paddingLeft: marksType.stencil.letterSpacing },
  slots: {
    position: 'absolute',
    right: P.slotRight,
    bottom: P.slotBottom,
    flexDirection: 'row',
    gap: P.slotGap,
  },
  slot: {
    width: P.slotW,
    height: P.slotH,
    borderRadius: P.slotW / 2,
    backgroundColor: P.slot,
    boxShadow: `inset 0 2px 3px ${P.slotShade}, 0 1px 0 ${P.slotRim}`,
    transform: [{ rotate: `${P.slotAngle}deg` }],
  },
  screw: {
    position: 'absolute',
    width: B.screwSize,
    height: B.screwSize,
    borderRadius: B.screwSize / 2,
    backgroundColor: B.screw,
    boxShadow: `inset 0 0 0 1px ${B.screwRim}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screwSlot: {
    width: B.screwSlotW,
    height: B.screwSlotH,
    backgroundColor: B.screwSlot,
    transform: [{ rotate: `${B.screwSlotAngle}deg` }],
  },
  hazard: {
    position: 'absolute',
    left: B.hazardLeft,
    bottom: B.hazardBottom,
    width: B.hazardW,
    height: B.hazardH,
    borderRadius: finishMarks.radius,
    overflow: 'hidden',
    boxShadow: `inset 0 1px 2px ${B.screwRim}`,
  },
  fieldStencil: { position: 'absolute', left: F.stencilLeft, bottom: F.stencilBottom },
  tab: {
    position: 'absolute',
    right: 0,
    top: '36%',
    width: F.tabW,
    height: F.tabH,
    borderTopLeftRadius: F.tabRadius,
    borderBottomLeftRadius: F.tabRadius,
    backgroundColor: F.tabLo,
    experimental_backgroundImage: `linear-gradient(90deg, ${F.tabHi}, ${F.tabLo})`,
  },
});
