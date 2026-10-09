import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Path, Pattern, Circle, Rect } from 'react-native-svg';

import { fontScaleCap, importColors as C, importGeometry as G, importType, sheetColors } from '@/constants/theme';
import { IMPORT, LINEAR_FN } from '@/motion';

/** The frame the loop rests on under Reduce Motion: the reply selected, Copy showing. */
const STILL = 0.3;

/**
 * The loop's clock, 0 → 1 over `IMPORT.ART_LOOP`, shared with the buttons so each pulses as its
 * scene lands. Held still under Reduce Motion.
 */
export function useArtClock(): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? STILL : 0);
  useEffect(() => {
    if (reduceMotion) {
      t.set(STILL);
      return;
    }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration: IMPORT.ART_LOOP, easing: LINEAR_FN }), -1, false));
  }, [reduceMotion, t]);
  return t;
}

const clamp = (t: number, input: number[], output: number[]) => {
  'worklet';
  return interpolate(t, input, output, Extrapolation.CLAMP);
};

/** A button's pulse as its scene lands: Paste at the end of the first half, Screenshots at the end. */
export function usePulseStyle(t: SharedValue<number>, scene: 'paste' | 'screenshots') {
  return useAnimatedStyle(() => {
    const at = scene === 'paste' ? 0.47 : 0.96;
    return { transform: [{ scale: clamp(t.get(), [at - 0.02, at, at + 0.03], [1, 1.05, 1]) }] };
  });
}

/**
 * Import plan's illustration (decision 88): clearly a drawing, not Trim's UI. A phone outline on a
 * dotted tile, text as grey bars. First a chat reply is selected, Copy pops and the snippet flies
 * down into Paste; then another app's routine flashes as a screenshot, shrinks and flies into
 * Screenshots. `reach` is how far below the tile the two buttons' centres sit.
 */
export function ImportArt({
  t,
  reach,
}: {
  t: SharedValue<number>;
  reach: { paste: number; screenshots: number };
}) {
  const [height, setHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);

  const snippetFly = height + reach.paste - G.snippetTop - G.snippetHeight / 2;
  const shotFly = height + reach.screenshots - G.phoneTop - G.phoneHeight / 2;

  const chatScene = useAnimatedStyle(() => ({ opacity: clamp(t.get(), [0, 0.05, 0.45, 0.5], [0, 1, 1, 0]) }));
  const selection = useAnimatedStyle(() => ({
    transform: [{ scaleY: clamp(t.get(), [0.1, 0.22], [0, 1]) }],
  }));
  const pill = useAnimatedStyle(() => ({
    opacity: clamp(t.get(), [0.22, 0.26, 0.31, 0.33], [0, 1, 1, 0]),
    transform: [{ scale: clamp(t.get(), [0.22, 0.26, 0.28], [0.7, 1.08, 1]) }],
  }));
  const snippet = useAnimatedStyle(() => ({
    opacity: clamp(t.get(), [0.31, 0.33, 0.45, 0.48], [0, 1, 1, 0]),
    transform: [
      { translateY: clamp(t.get(), [0.33, 0.45], [0, snippetFly]) },
      { scale: clamp(t.get(), [0.33, 0.45], [1, G.flyScale]) },
    ],
  }));
  const appScene = useAnimatedStyle(() => ({ opacity: clamp(t.get(), [0.5, 0.55, 0.95, 0.98], [0, 1, 1, 0]) }));
  const shot = useAnimatedStyle(() => ({
    transform: [
      { translateY: clamp(t.get(), [0.64, 0.74, 0.82, 0.94], [0, 0, 0, shotFly]) },
      { scale: clamp(t.get(), [0.64, 0.74, 0.82, 0.94], [1, G.shotScale, G.shotScale, G.shotFlyScale]) },
    ],
  }));
  const flash = useAnimatedStyle(() => ({ opacity: clamp(t.get(), [0.6, 0.615, 0.66], [0, 0.95, 0]) }));

  return (
    <View
      style={styles.tile}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel="A plan copied from a chat, and another workout app being screenshotted">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="import-dots" width={G.tileDotPitch} height={G.tileDotPitch} patternUnits="userSpaceOnUse">
            <Circle cx={G.tileDotPitch / 2} cy={G.tileDotPitch / 2} r={G.tileDotRadius} fill={C.tileDot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#import-dots)" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, chatScene]} pointerEvents="none">
        <View style={styles.phone}>
          <View style={styles.bubble} />
          <View style={styles.reply}>
            <Animated.View style={[styles.selection, selection]} />
            <Animated.View style={[styles.pill, pill]}>
              <Text maxFontSizeMultiplier={fontScaleCap.display} style={importType.artPill}>
                Copy
              </Text>
            </Animated.View>
            <Bar heading width="45%" />
            <Bar width="90%" />
            <Bar width="75%" />
            <Bar width="85%" />
            <Bar heading width="40%" gapAbove />
            <Bar width="80%" />
            <Bar width="92%" />
            <Bar width="70%" />
          </View>
        </View>
        <Badge>
          <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </Badge>
        <Animated.View style={[styles.snippet, snippet]}>
          <View style={[styles.paperLine, styles.paperHeading]} />
          <View style={[styles.paperLine, styles.w100]} />
          <View style={[styles.paperLine, styles.w80]} />
          <View style={[styles.paperLine, styles.w90]} />
          <View style={[styles.paperLine, styles.w70]} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, appScene]} pointerEvents="none">
        <Animated.View style={[styles.phone, styles.shotPhone, shot]}>
          <View style={[styles.textBar, styles.appTitle]} />
          {[80, 65, 75, 60].map((width) => (
            <View key={width} style={styles.appRow}>
              <View style={styles.appIcon} />
              <View style={styles.appText}>
                <View style={[styles.textBar, styles.appName, { width: `${width}%` }]} />
                <View style={[styles.textBar, styles.appMeta]} />
              </View>
            </View>
          ))}
          <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flash]} />
        </Animated.View>
        <Badge>
          <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
        </Badge>
      </Animated.View>
    </View>
  );
}

function Bar({ width, heading = false, gapAbove = false }: { width: `${number}%`; heading?: boolean; gapAbove?: boolean }) {
  return <View style={[styles.textBar, heading ? styles.barHeading : styles.barSoft, gapAbove && styles.gapAbove, { width }]} />;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.badge}>
      <Svg width={G.rowIcon} height={G.rowIcon} viewBox="0 0 24 24" fill="none" stroke={sheetColors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: G.tileMinHeight,
    borderRadius: G.tileRadius,
    borderCurve: 'continuous',
    backgroundColor: C.tile,
    overflow: 'visible',
  },
  phone: {
    position: 'absolute',
    top: G.phoneTop,
    alignSelf: 'center',
    width: G.phoneWidth,
    height: G.phoneHeight,
    borderRadius: G.phoneRadius,
    borderCurve: 'continuous',
    borderWidth: G.phoneBorder,
    borderColor: C.phoneEdge,
    backgroundColor: C.phoneScreen,
    paddingTop: G.phonePadTop,
    paddingHorizontal: G.phonePadX,
    gap: G.phonePadX - G.phoneBorder * 2,
    overflow: 'hidden',
  },
  shotPhone: { gap: G.rowIconRadius + G.phoneBorder },
  bubble: {
    alignSelf: 'flex-end',
    width: G.bubbleWidth,
    height: G.bubbleHeight,
    borderRadius: G.bubbleRadius,
    backgroundColor: C.phoneEdge,
  },
  reply: { padding: G.rowIconRadius + G.phoneBorder, gap: G.rowIconRadius + 1 },
  selection: {
    ...StyleSheet.absoluteFill,
    borderRadius: G.selectionRadius,
    backgroundColor: C.selection,
    transformOrigin: 'top',
  },
  pill: {
    position: 'absolute',
    top: -G.pillRise,
    alignSelf: 'center',
    height: G.pillHeight,
    paddingHorizontal: G.pillPadX,
    borderRadius: G.pillHeight / 2,
    backgroundColor: sheetColors.pillLight,
    justifyContent: 'center',
  },
  textBar: { height: G.bar, borderRadius: G.barRadius },
  barHeading: { height: G.barHeading, backgroundColor: C.barStrong },
  barSoft: { backgroundColor: C.barSoft },
  gapAbove: { marginTop: G.rowIconRadius },
  badge: {
    position: 'absolute',
    top: G.badgeTop,
    left: '50%',
    marginLeft: G.badgeOffsetX,
    width: G.badge,
    height: G.badge,
    borderRadius: G.badge / 2,
    backgroundColor: sheetColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snippet: {
    position: 'absolute',
    top: G.snippetTop,
    left: '50%',
    marginLeft: -G.snippetWidth / 2,
    width: G.snippetWidth,
    height: G.snippetHeight,
    borderRadius: G.snippetRadius,
    borderCurve: 'continuous',
    backgroundColor: C.paper,
    padding: G.pillPadX,
    gap: G.rowIconRadius,
    boxShadow: [{ offsetX: 0, offsetY: G.pillPadX, blurRadius: G.phoneTop, color: sheetColors.shadow }],
  },
  paperLine: { height: G.bar, borderRadius: G.barRadius, backgroundColor: C.paperLineSoft },
  paperHeading: { height: G.barHeading, width: '50%', backgroundColor: C.paperLineStrong },
  w100: { width: '100%' },
  w90: { width: '90%' },
  w80: { width: '80%' },
  w70: { width: '70%' },
  appTitle: { width: '55%', height: G.barHeading + 2, backgroundColor: C.barStrong, marginBottom: G.barRadius },
  appRow: {
    height: G.rowHeight,
    borderRadius: G.rowRadius,
    backgroundColor: C.phoneRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: G.rowIconRadius + G.phoneBorder,
    paddingHorizontal: G.rowIconRadius + G.phoneBorder,
  },
  appIcon: { width: G.rowIcon, height: G.rowIcon, borderRadius: G.rowIconRadius, backgroundColor: C.barFaint },
  appText: { flex: 1, gap: G.bar },
  appName: { backgroundColor: C.barStrong },
  appMeta: { width: '50%', height: G.bar - 1, backgroundColor: C.barFaint },
  flash: { backgroundColor: C.flash },
});
