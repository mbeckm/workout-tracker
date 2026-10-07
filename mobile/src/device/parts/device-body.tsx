import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { bodyFinish, deviceColors } from '@/constants/theme';
import { useFinish } from '@/device/finish';

import { Grain } from './screen-surface';

/** The brushing period: 1pt light, 2pt dark (SPEC §2 Body overlays). */
const BRUSH_LIGHT = 1;
const BRUSH_PERIOD = 3;
/** The sheen covers the top 40%. */
const SHEEN_END = '40%';
/** Holo's foil runs corner to corner at about 125°. */
const HOLO = { x1: '0', y1: '0', x2: '1', y2: '0.7' } as const;

/**
 * The device body (SPEC §2, decision 80): the finish's gradient (Holo's foil runs diagonally),
 * its material (vertical brushing on metal, grain on powder coat and plastic) and a white sheen
 * over the top 40%. Drawn in SVG so it renders the same on iOS and web. Fills its parent.
 *
 * `rim` adds the prototype's inner highlight (only when the body is drawn as an object with
 * corners, as in the insert moment; on the real screen the glass is the edge).
 */
export function DeviceBody({
  children,
  rim = false,
  rimRadius = 0,
  style,
}: {
  children?: ReactNode;
  rim?: boolean;
  /** The body's corner radius when `rim` is on. */
  rimRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { finish, palette } = useFinish();
  const id = `body-${finish}`;
  const brushed = palette.material === 'brushed' || palette.material === 'holo';
  const grain =
    palette.material === 'powder'
      ? bodyFinish.grainOpacity.powder
      : palette.material === 'plastic'
        ? bodyFinish.grainOpacity.plastic
        : null;
  return (
    <View style={[styles.fill, { backgroundColor: palette.body2 }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          {palette.bodyStops ? (
            <LinearGradient id={`${id}-base`} {...HOLO}>
              {palette.bodyStops.map((color, i, all) => (
                <Stop key={color} offset={i / (all.length - 1)} stopColor={color} />
              ))}
            </LinearGradient>
          ) : (
            <LinearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.body1} />
              <Stop offset="1" stopColor={palette.body2} />
            </LinearGradient>
          )}
          <Pattern
            id={`${id}-brush`}
            width={BRUSH_PERIOD}
            height={BRUSH_PERIOD}
            patternUnits="userSpaceOnUse">
            <Rect
              x={0}
              y={0}
              width={BRUSH_LIGHT}
              height={BRUSH_PERIOD}
              fill={deviceColors.brushLight}
              fillOpacity={deviceColors.brushLightOpacity}
            />
            <Rect
              x={BRUSH_LIGHT}
              y={0}
              width={BRUSH_PERIOD - BRUSH_LIGHT}
              height={BRUSH_PERIOD}
              fill={deviceColors.brushDark}
              fillOpacity={deviceColors.brushDarkOpacity}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}-base)`} />
        {brushed ? <Rect width="100%" height="100%" fill={`url(#${id}-brush)`} /> : null}
      </Svg>
      {grain != null ? <Grain id={`${id}-grain`} opacity={grain} /> : null}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={deviceColors.sheen} stopOpacity={palette.sheen} />
            <Stop offset={SHEEN_END} stopColor={deviceColors.sheen} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}-sheen)`} />
      </Svg>
      {rim ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: rimRadius,
              boxShadow: `inset 0 2px 0 ${palette.bodyRim}, inset 0 0 0 1.5px ${palette.bodyRimOutline}`,
            },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
});
