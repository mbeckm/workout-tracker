import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { insertColors as ink, insertGeometry as geo, insertType, lcd } from '@/constants/theme';
import type { DevicePalette } from '@/device/finish';

import {
  T,
  angles,
  cartridge,
  depthShift,
  dip,
  gridShift,
  pose,
  pulse,
  sceneOpacity,
  shadowScale,
  slotGlow,
} from './timeline';
import type { InsertDay } from './use-insert';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/* ------------------------------------------------------------------------------------------ *
 * The device's motion (the face and everything riding with it)
 * ------------------------------------------------------------------------------------------ */

/**
 * The device's transform at the clock (SPEC §7): pulled back to translateY 70, scale .68,
 * rotateX −16°, rotateY −30°, rotateZ 2° under a 1400 perspective, with the click's dip on top.
 * Face-on (before and after the moment) it carries no transform at all, so no 3D layer stays.
 */
export function useInsertDeviceStyle(clock: SharedValue<number> | null) {
  return useAnimatedStyle(() => {
    const t = clock ? clock.get() : 0;
    const p = pose(t);
    if (!clock || t <= 0 || t >= T.end || p <= 0) return { transform: [] };
    const d = dip(t);
    return {
      transform: [
        { perspective: geo.perspective },
        { translateY: geo.pullY * p },
        { scale: 1 - (1 - geo.pullScale) * p },
        { rotateX: `${geo.pullRotateX * p}deg` },
        { rotateY: `${geo.pullRotateY * p}deg` },
        { rotateZ: `${geo.pullRotateZ * p}deg` },
        { translateY: d.y },
        { rotateX: `${d.rotateX}deg` },
        { scale: d.scale },
      ],
    };
  });
}

/** A colour with every channel scaled (CSS `filter: brightness(b)`). */
function brightness(hex: string, b: number): string {
  const value = hex.replace('#', '');
  const channel = (at: number) => Math.round(Math.min(255, parseInt(value.slice(at, at + 2), 16) * b));
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(channel(0))}${to(channel(2))}${to(channel(4))}`;
}

/** One slab of the body's 44 pt depth, drawn in the face's plane where it would land. */
function DepthLayer({ clock, depth, color }: { clock: SharedValue<number>; depth: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = clock.get();
    const p = pose(t);
    if (p <= 0) return { opacity: 0, transform: [] };
    const a = angles(t);
    const shift = depthShift(a.rotateX, a.rotateY, a.rotateZ);
    return { opacity: 1, transform: [{ translateX: shift.x * depth }, { translateY: shift.y * depth }] };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer, { backgroundColor: color }, style]} />;
}

/**
 * The body's depth (22 layers, darker toward the back), and the cartridge riding half-way into
 * it: back layers, the cartridge, front layers, so the face (drawn next, by the caller) covers
 * everything but the part of the cartridge above the top edge.
 */
export function InsertBody({
  clock,
  palette,
  width,
  planName,
  days,
  part,
}: {
  clock: SharedValue<number>;
  palette: DevicePalette;
  width: number;
  planName: string;
  days: readonly InsertDay[];
  /** `back`: the layers behind the cartridge and the cartridge; `front`: the layers in front of it. */
  part: 'back' | 'front';
}) {
  const step = geo.bodyDepth / geo.depthLayers;
  const half = Math.round(geo.cartDepth / step);
  const layers = Array.from({ length: geo.depthLayers }, (_, index) => geo.depthLayers - index).filter((n) =>
    part === 'back' ? n > half : n <= half,
  );
  const color = (n: number) =>
    brightness(palette.body2, ink.depthFront + ((ink.depthBack - ink.depthFront) * (n - 1)) / (geo.depthLayers - 1));
  return (
    <>
      {layers.map((n) => (
        <DepthLayer key={n} clock={clock} depth={n * step} color={color(n)} />
      ))}
      {part === 'back' ? <Cartridge clock={clock} width={width} planName={planName} days={days} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------------------------------ *
 * The cartridge (`.c3`)
 * ------------------------------------------------------------------------------------------ */

const CART_RADII = {
  borderTopLeftRadius: geo.cartRadiusTop,
  borderTopRightRadius: geo.cartRadiusTopRight,
  borderBottomLeftRadius: geo.cartRadiusBottom,
  borderBottomRightRadius: geo.cartRadiusBottom,
};

function CartLayer({ clock, depth }: { clock: SharedValue<number>; depth: number }) {
  const style = useAnimatedStyle(() => {
    const a = angles(clock.get());
    const shift = depthShift(a.rotateX, a.rotateY, a.rotateZ);
    return { transform: [{ translateX: shift.x * depth }, { translateY: shift.y * depth }] };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, CART_RADII, styles.cartBack, style]} />;
}

function Cartridge({
  clock,
  width,
  planName,
  days,
}: {
  clock: SharedValue<number>;
  width: number;
  planName: string;
  days: readonly InsertDay[];
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.get();
    const c = cartridge(t);
    const a = angles(t);
    const shift = depthShift(a.rotateX, a.rotateY, a.rotateZ);
    return {
      opacity: c.opacity,
      transform: [{ translateX: shift.x * geo.cartDepth }, { translateY: shift.y * geo.cartDepth + c.y }],
    };
  });
  const ridges = Math.floor((geo.cartWidth - geo.ridgeLeft - geo.ridgeRight) / geo.ridgePitch);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.cart, { left: (width - geo.cartWidth) / 2 }, style]}>
      {Array.from({ length: geo.cartLayers }, (_, index) => geo.cartLayers - index).map((n) => (
        <CartLayer key={n} clock={clock} depth={n * geo.cartLayerStep} />
      ))}
      <View style={[StyleSheet.absoluteFill, CART_RADII, styles.cartFace]}>
        <View style={styles.ridges}>
          {Array.from({ length: ridges }, (_, index) => (
            <View key={index} style={styles.ridge} />
          ))}
        </View>
        <View style={styles.label}>
          <Text maxFontSizeMultiplier={1} numberOfLines={2} style={insertType.cartName}>
            {planName.toUpperCase()}
          </Text>
          <Text maxFontSizeMultiplier={1} numberOfLines={5} style={[insertType.cartDays, styles.labelDays]}>
            {days.map((day) => day.title.toUpperCase()).join('\n')}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={1} style={[insertType.brand, styles.brand]}>
          TRIM
        </Text>
        <View style={styles.arrow} />
      </View>
    </Animated.View>
  );
}

/** The orange flash along the slot at the click (`.slotglow`), on the face's top edge. */
export function SlotGlow({ clock, width }: { clock: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => ({ opacity: slotGlow(clock.get()) }));
  return <Animated.View pointerEvents="none" style={[styles.glow, { left: (width - geo.glowWidth) / 2 }, style]} />;
}

/* ------------------------------------------------------------------------------------------ *
 * The scene behind the device (`.scene`: backdrop, grid floor, vignette, shadow, pulse)
 * ------------------------------------------------------------------------------------------ */

/** Where a floor point (x across, v along the floor from its far edge) lands on screen. */
function project(x: number, v: number, width: number, height: number): { x: number; y: number } {
  'worklet';
  const tilt = (geo.gridTilt * Math.PI) / 180;
  const top = geo.gridTop * height;
  const y = top + v * Math.cos(tilt);
  const z = v * Math.sin(tilt);
  const s = geo.gridPerspective / (geo.gridPerspective - z);
  return { x: width / 2 + (x - width / 2) * s, y: height / 2 + (y - height / 2) * s };
}

/** The floor's depth that stays in front of the eye (`rotateX(72deg)` under a 500 perspective). */
function reach(height: number): number {
  'worklet';
  const tilt = (geo.gridTilt * Math.PI) / 180;
  return Math.min(geo.gridLength * height, (0.92 * geo.gridPerspective) / Math.sin(tilt));
}

function crossLines(shift: number, width: number, height: number): string {
  'worklet';
  const left = -geo.gridSpread * width;
  const right = (1 + geo.gridSpread) * width;
  const far = reach(height);
  let d = '';
  for (let v = shift - geo.gridCell; v <= far; v += geo.gridCell) {
    if (v < 0) continue;
    const a = project(left, v, width, height);
    const b = project(right, v, width, height);
    d += `M${a.x},${a.y}L${b.x},${b.y}`;
  }
  return d;
}

function alongLines(width: number, height: number): string {
  const left = -geo.gridSpread * width;
  const right = (1 + geo.gridSpread) * width;
  const far = reach(height);
  let d = '';
  for (let x = left; x <= right; x += geo.gridCell) {
    const a = project(x, 0, width, height);
    const b = project(x, far, width, height);
    d += `M${a.x},${a.y}L${b.x},${b.y}`;
  }
  return d;
}

export function InsertBackdrop({
  clock,
  width,
  height,
}: {
  clock: SharedValue<number>;
  width: number;
  height: number;
}) {
  const fade = useAnimatedStyle(() => ({ opacity: sceneOpacity(clock.get()) }));
  // Core Animation depth-sorts 3D layers against their flat siblings: at z 0 this backdrop would
  // cut away the half of the turned device that leans back. Pushed far behind (no perspective,
  // so it looks the same), the whole device stays in front of it.
  const behind = { transform: [{ matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -geo.backdropDepth, 1] }] };
  const crossProps = useAnimatedProps(() => ({ d: crossLines(gridShift(clock.get()), width, height) }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scale: shadowScale(clock.get()) }] }));
  const pulseStyle = useAnimatedStyle(() => {
    const ring = pulse(clock.get());
    return { opacity: ring.opacity, transform: [{ scale: ring.scale }] };
  });
  const fadeFrom = project(0, 0, width, height).y;
  const fadeTo = project(0, geo.gridMaskIn * geo.gridLength * height, width, height).y;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, behind, fade]}>
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient
            id="insertBackdrop"
            cx={width / 2}
            cy={geo.backdropCy * height}
            rx={geo.backdropRx * width}
            ry={geo.backdropRy * height}
            gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={ink.backdropIn} />
            <Stop offset="0.75" stopColor={ink.backdropOut} />
            <Stop offset="1" stopColor={ink.backdropOut} />
          </RadialGradient>
          <LinearGradient id="insertFloor" x1="0" y1={fadeFrom} x2="0" y2={fadeTo} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={ink.gridLine} stopOpacity={ink.gridLineOpacity * geo.gridMaskStart} />
            <Stop offset="1" stopColor={ink.gridLine} stopOpacity={ink.gridLineOpacity} />
          </LinearGradient>
          <RadialGradient
            id="insertVignette"
            cx={width / 2}
            cy={geo.vignetteCy * height}
            rx={geo.vignetteRx * width}
            ry={geo.vignetteRy * height}
            gradientUnits="userSpaceOnUse">
            <Stop offset={geo.vignetteClear} stopColor={ink.vignette} stopOpacity={0} />
            <Stop offset="1" stopColor={ink.vignette} stopOpacity={ink.vignetteOpacity} />
          </RadialGradient>
          <RadialGradient id="insertShadow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={ink.shadow} stopOpacity={ink.shadowOpacity} />
            <Stop offset="0.7" stopColor={ink.shadow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#insertBackdrop)" />
        <Path d={alongLines(width, height)} stroke="url(#insertFloor)" strokeWidth={geo.gridLine} />
        <AnimatedPath animatedProps={crossProps} stroke="url(#insertFloor)" strokeWidth={geo.gridLine} />
        <Rect width={width} height={height} fill="url(#insertVignette)" />
      </Svg>
      <Animated.View
        style={[
          styles.shadow,
          { left: (width - geo.shadowWidth) / 2, top: geo.shadowY * height - geo.shadowHeight / 2 },
          shadowStyle,
        ]}>
        <Svg width={geo.shadowWidth} height={geo.shadowHeight}>
          <Ellipse
            cx={geo.shadowWidth / 2}
            cy={geo.shadowHeight / 2}
            rx={geo.shadowWidth / 2}
            ry={geo.shadowHeight / 2}
            fill="url(#insertShadow)"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.pulse,
          { left: (width - geo.pulseSize) / 2, top: geo.pulseCentreY * height - geo.pulseSize / 2 },
          pulseStyle,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { borderRadius: geo.bodyRadius, borderCurve: 'continuous' },
  cart: { position: 'absolute', top: geo.cartTop, width: geo.cartWidth, height: geo.cartHeight },
  cartBack: { backgroundColor: ink.cartBack },
  cartFace: {
    backgroundColor: ink.cartLo,
    experimental_backgroundImage: `linear-gradient(180deg, ${ink.cartHi}, ${ink.cartLo})`,
    boxShadow: `inset 0 2px 0 ${ink.cartHighlight}, inset 0 -3px 0 ${ink.cartShade}`,
  },
  ridges: {
    position: 'absolute',
    left: geo.ridgeLeft,
    right: geo.ridgeRight,
    top: geo.ridgeTop,
    height: geo.ridgeHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: geo.ridgeRadius,
    overflow: 'hidden',
  },
  ridge: { width: geo.ridgeLine, height: geo.ridgeHeight, backgroundColor: ink.cartRidge },
  label: {
    position: 'absolute',
    left: geo.labelInset,
    right: geo.labelInset,
    top: geo.labelTop,
    height: geo.labelHeight,
    borderRadius: geo.labelRadius,
    borderCurve: 'continuous',
    backgroundColor: lcd.lcd,
    boxShadow: `inset 0 2px 5px ${ink.cartLabelShade}`,
    paddingVertical: geo.labelPadY,
    paddingHorizontal: geo.labelPadX,
    overflow: 'hidden',
  },
  labelDays: { marginTop: geo.labelDaysTop },
  brand: { position: 'absolute', left: geo.brandInset, bottom: geo.brandBottom },
  arrow: {
    position: 'absolute',
    right: geo.arrowRight,
    bottom: geo.arrowBottom,
    width: 0,
    height: 0,
    borderLeftWidth: geo.arrowHalf,
    borderRightWidth: geo.arrowHalf,
    borderTopWidth: geo.arrowHeight,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: ink.cartBack,
  },
  glow: {
    position: 'absolute',
    top: geo.glowTop,
    width: geo.glowWidth,
    height: geo.glowHeight,
    borderRadius: geo.glowHeight / 2,
    backgroundColor: ink.glow,
    boxShadow: `0 0 ${geo.glowBlur}px ${geo.glowSpread}px ${ink.glowHalo}`,
  },
  shadow: { position: 'absolute', width: geo.shadowWidth, height: geo.shadowHeight },
  pulse: {
    position: 'absolute',
    width: geo.pulseSize,
    height: geo.pulseSize,
    borderRadius: geo.pulseSize / 2,
    boxShadow: `0 0 0 ${geo.pulseRing}px ${ink.pulseRing}, 0 0 ${geo.pulseBlur}px ${geo.pulseSpread}px ${ink.pulseHalo}`,
  },
});
