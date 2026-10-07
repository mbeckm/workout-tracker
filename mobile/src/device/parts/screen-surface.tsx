import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Image, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { bodyFinish, type ScreenColors } from '@/constants/theme';

const GRAIN = require('@/assets/images/finish-grain.png');

/** The grain tile repeated over its parent (matte bodies, the e-ink screen). */
export function Grain({ id, opacity }: { id: string; opacity: number }) {
  const tile = bodyFinish.grainTile;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse">
            <Image href={GRAIN} width={tile} height={tile} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * What lies over a screen's content (decision 80): its texture (unlit dots, the LCD pixel grid,
 * CRT scanlines and dark edges, the VFD mesh and filament wires, e-ink grain), then the glass.
 * Purely visual; never takes touches.
 */
export function ScreenSurface({ screen, id }: { screen: ScreenColors; id: string }) {
  const B = bodyFinish;
  const t = screen.texture;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {t === 'grain' ? (
        <Grain id={`${id}-grain`} opacity={B.grainOpacity.paper} />
      ) : (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            {t === 'dots' ? (
              <Pattern id={`${id}-tx`} width={B.dotPitch} height={B.dotPitch} patternUnits="userSpaceOnUse">
                <Circle cx={B.dotPitch / 2} cy={B.dotPitch / 2} r={B.dotRadius} fill={screen.textureColor} />
              </Pattern>
            ) : t === 'grid' || t === 'mesh' ? (
              <Pattern id={`${id}-tx`} width={B.gridPitch} height={B.gridPitch} patternUnits="userSpaceOnUse">
                <Rect x={0} y={0} width={B.gridPitch} height={1} fill={screen.textureColor} />
                <Rect x={0} y={0} width={1} height={B.gridPitch} fill={screen.textureColor} />
              </Pattern>
            ) : (
              <Pattern id={`${id}-tx`} width={B.scanPitch} height={B.scanPitch} patternUnits="userSpaceOnUse">
                <Rect x={0} y={0} width={B.scanPitch} height={B.scanLine} fill={screen.textureColor} />
              </Pattern>
            )}
            {t === 'mesh' ? (
              <Pattern id={`${id}-fil`} width={B.filamentPitch} height={B.filamentPitch} patternUnits="userSpaceOnUse">
                <Line x1={0} y1={B.filamentPitch - 1} x2={B.filamentPitch} y2={B.filamentPitch - 1} stroke={B.filament} strokeWidth={1} />
              </Pattern>
            ) : null}
            {t === 'scan' ? (
              <RadialGradient id={`${id}-vig`} cx="50%" cy="50%" rx="60%" ry="60%">
                <Stop offset="0.82" stopColor={B.vignetteClear} stopOpacity={0} />
                <Stop offset="1" stopColor={B.vignette} />
              </RadialGradient>
            ) : null}
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id}-tx)`} />
          {t === 'mesh' ? <Rect width="100%" height="100%" fill={`url(#${id}-fil)`} /> : null}
          {t === 'scan' ? <Rect width="100%" height="100%" fill={`url(#${id}-vig)`} /> : null}
        </Svg>
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { experimental_backgroundImage: `linear-gradient(160deg, ${B.glass}, ${B.glassClear} 36%)` },
        ]}
      />
    </View>
  );
}
