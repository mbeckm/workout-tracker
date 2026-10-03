/**
 * The plan insert's clock (SPEC §7 Plan activation; prototype `activate()`), for the JS 2.5D
 * version. Everything the scene shows is a function of one time `t` in ms, so the moment can be
 * frozen (`pauseAt`), slowed (`speed`) or skipped to its end by setting one value. The functions
 * are worklets: they run in `useAnimatedStyle` on the UI thread.
 */
import { insertGeometry as geo } from '@/constants/theme';
import {
  DEVICE,
  EASE_CSS_OUT_FN,
  EASE_DISPLAY_FN,
  EASE_INSERT_PULL_FN,
  EASE_INSERT_SLIDE_FN,
  EASE_KEY_FN,
} from '@/motion';

/** Milestones in ms. */
export const T = (() => {
  const pulled = DEVICE.INSERT_PULL;
  const cartIn = pulled + DEVICE.INSERT_CART_IN;
  const slide = cartIn + DEVICE.INSERT_HOLD;
  const seat = slide + DEVICE.INSERT_SLIDE;
  const swing = seat + DEVICE.INSERT_SWING_DELAY;
  const end = swing + DEVICE.INSERT_SWING;
  return { pulled, cartIn, slide, seat, swing, end } as const;
})();

function clamp01(value: number): number {
  'worklet';
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** How far into a span [from, from + length] `t` is, 0…1. */
function span(t: number, from: number, length: number): number {
  'worklet';
  return clamp01((t - from) / length);
}

/** The scene (backdrop, floor, shadow): in over 600 ms (`ease`), out over 600 from the swing. */
export function sceneOpacity(t: number): number {
  'worklet';
  if (t <= 0 || t >= T.end) return 0;
  if (t < T.swing) return EASE_KEY_FN(span(t, 0, DEVICE.INSERT_SCENE));
  return 1 - EASE_KEY_FN(span(t, T.swing, DEVICE.INSERT_SCENE));
}

/** The floor slides one cell toward you as the scene comes in (`background-position` 0 → 44). */
export function gridShift(t: number): number {
  'worklet';
  return EASE_DISPLAY_FN(span(t, 0, DEVICE.INSERT_GRID)) * geo.gridCell;
}

/** The shadow under the device grows from .6 with the scene (`.8s ease`). */
export function shadowScale(t: number): number {
  'worklet';
  return geo.shadowFrom + (1 - geo.shadowFrom) * EASE_KEY_FN(span(t, 0, DEVICE.INSERT_SHADOW));
}

/** 0 face-on, 1 pulled back: out over 750 ms, back over 700 from the swing. */
export function pose(t: number): number {
  'worklet';
  if (t <= 0 || t >= T.end) return 0;
  if (t < T.pulled) return EASE_INSERT_PULL_FN(span(t, 0, T.pulled));
  if (t < T.swing) return 1;
  return 1 - EASE_INSERT_PULL_FN(span(t, T.swing, DEVICE.INSERT_SWING));
}

/** Keyframes at 0, 25, 50, 75, 100% with the curve on each segment (CSS keyframe timing). */
function keyframes(k: number, values: readonly number[], ease: (x: number) => number): number {
  'worklet';
  const segments = values.length - 1;
  const at = clamp01(k) * segments;
  const index = Math.min(Math.floor(at), segments - 1);
  const local = ease(at - index);
  return values[index] + (values[index + 1] - values[index]) * local;
}

const DIP_Y = [0, geo.dipY, geo.reboundY, geo.settleY, 0] as const;
const DIP_RX = [0, geo.dipRotateX, geo.reboundRotateX, 0, 0] as const;
const DIP_S = [1, geo.dipScale, geo.reboundScale, 1, 1] as const;

/** The click's dip and rebound on top of the pulled-back pose (420 ms from the seat). */
export function dip(t: number): { y: number; rotateX: number; scale: number } {
  'worklet';
  if (t < T.seat || t > T.seat + DEVICE.INSERT_DIP) return { y: 0, rotateX: 0, scale: 1 };
  const k = span(t, T.seat, DEVICE.INSERT_DIP);
  return {
    y: keyframes(k, DIP_Y, EASE_DISPLAY_FN),
    rotateX: keyframes(k, DIP_RX, EASE_DISPLAY_FN),
    scale: keyframes(k, DIP_S, EASE_DISPLAY_FN),
  };
}

const SETTLE = [geo.cartSlide, geo.cartOvershoot, geo.cartSettle1, geo.cartSettle2] as const;

/** The cartridge's drop below its start (y) and its opacity. */
export function cartridge(t: number): { y: number; opacity: number } {
  'worklet';
  if (t < T.pulled || t >= T.end) return { y: geo.cartFrom, opacity: 0 };
  if (t < T.cartIn) {
    const k = EASE_DISPLAY_FN(span(t, T.pulled, DEVICE.INSERT_CART_IN));
    return { y: geo.cartFrom * (1 - k), opacity: k };
  }
  if (t < T.slide) return { y: 0, opacity: 1 };
  if (t < T.seat) return { y: geo.cartSlide * EASE_INSERT_SLIDE_FN(span(t, T.slide, DEVICE.INSERT_SLIDE)), opacity: 1 };
  return { y: keyframes(span(t, T.seat, DEVICE.INSERT_CLICK), SETTLE, EASE_CSS_OUT_FN), opacity: 1 };
}

/** The slot's orange flash (600 ms, ease-out to nothing). */
export function slotGlow(t: number): number {
  'worklet';
  if (t < T.seat || t > T.seat + DEVICE.INSERT_GLOW) return 0;
  return 1 - EASE_CSS_OUT_FN(span(t, T.seat, DEVICE.INSERT_GLOW));
}

/** The ring behind the device: scale .35 → 1.25, opacity .9 → 0 over 700 ms. */
export function pulse(t: number): { scale: number; opacity: number } {
  'worklet';
  if (t < T.seat || t > T.seat + DEVICE.INSERT_PULSE) return { scale: geo.pulseFrom, opacity: 0 };
  const k = EASE_DISPLAY_FN(span(t, T.seat, DEVICE.INSERT_PULSE));
  return { scale: geo.pulseFrom + (geo.pulseTo - geo.pulseFrom) * k, opacity: geo.pulseOpacity * (1 - k) };
}

/**
 * The display's power-on at the click: scaleY .02 → 1.04 (35%) → 1, and the ground flickering
 * in 45 ms steps (`@keyframes boot`). `flash`: 0 none, 1 the first flash colour, 2 the second.
 */
export function boot(t: number): { scaleY: number; flash: 0 | 1 | 2 } {
  'worklet';
  if (t < T.seat) return { scaleY: 1, flash: 0 };
  const k = span(t, T.seat, DEVICE.INSERT_BOOT);
  if (k >= 1) return { scaleY: 1, flash: 0 };
  const scaleY =
    k < geo.bootPeakAt
      ? geo.bootFrom + (geo.bootPeak - geo.bootFrom) * EASE_DISPLAY_FN(k / geo.bootPeakAt)
      : geo.bootPeak + (1 - geo.bootPeak) * EASE_DISPLAY_FN((k - geo.bootPeakAt) / (1 - geo.bootPeakAt));
  const step = Math.floor(k * 10);
  return { scaleY, flash: step === 1 ? 1 : step === 3 ? 2 : 0 };
}

/**
 * RN has no translateZ, so depth is faked: a point `d` behind the face is drawn in the face's
 * own plane, shifted so that, after the device's rotation, it lands where the real point would
 * (perspective aside). Returns the in-plane shift per point of depth for these angles (deg).
 */
export function depthShift(rotateX: number, rotateY: number, rotateZ: number): { x: number; y: number } {
  'worklet';
  const ax = (rotateX * Math.PI) / 180;
  const ay = (rotateY * Math.PI) / 180;
  const az = (rotateZ * Math.PI) / 180;
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const cz = Math.cos(az);
  const sz = Math.sin(az);
  // M = Rx · Ry · Rz (CSS order: the rightmost applies first), y down.
  const m00 = cy * cz;
  const m01 = -cy * sz;
  const m02 = sy;
  const m10 = sx * sy * cz + cx * sz;
  const m11 = -sx * sy * sz + cx * cz;
  const m12 = -sx * cy;
  // Where (0, 0, −1) lands on screen, and the in-plane offset that lands there.
  const vx = -m02;
  const vy = -m12;
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-6) return { x: 0, y: 0 };
  return { x: (m11 * vx - m01 * vy) / det, y: (m00 * vy - m10 * vx) / det };
}

/** The device's angles at time `t` (pose plus the dip). */
export function angles(t: number): { rotateX: number; rotateY: number; rotateZ: number } {
  'worklet';
  const p = pose(t);
  return {
    rotateX: geo.pullRotateX * p + dip(t).rotateX,
    rotateY: geo.pullRotateY * p,
    rotateZ: geo.pullRotateZ * p,
  };
}
