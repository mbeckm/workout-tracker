import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { finishColors, lcd, objectColors, sheetGeometry, signal } from '@/constants/theme';

/**
 * The 56pt 3D objects on menu rows (SPEC §6 Menu, prototype `ICON`): a knob for Plans, a gauge
 * for Progress, a receipt for History, the big key for End workout, two switches for Settings,
 * and a cartridge. Drawn in SVG; each sits on a darker lip, like the device's keys.
 */
export type ObjectIconKind = 'knob' | 'gauge' | 'receipt' | 'endKey' | 'toggles' | 'cartridge';

const S = sheetGeometry.object;
const C = S / 2;
/** The big key's colours (the end key is always the orange key, as on the prototype). */
const KEY = finishColors['212'];

export function ObjectIcon({ kind }: { kind: ObjectIconKind }) {
  return (
    <View
      style={{ width: S, height: S, flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ overflow: 'visible' }}>
        {kind === 'knob' ? <Knob /> : null}
        {kind === 'gauge' ? <Gauge /> : null}
        {kind === 'receipt' ? <Receipt /> : null}
        {kind === 'endKey' ? <EndKey /> : null}
        {kind === 'toggles' ? <Toggles /> : null}
        {kind === 'cartridge' ? <Cartridge /> : null}
      </Svg>
    </View>
  );
}

/** A rounded rect with its own top and bottom radii (`border-radius: t t b b`). */
function roundedRect(x: number, y: number, w: number, h: number, rt: number, rb: number): string {
  return [
    `M${x + rt} ${y}`,
    `H${x + w - rt}`,
    `A${rt} ${rt} 0 0 1 ${x + w} ${y + rt}`,
    `V${y + h - rb}`,
    `A${rb} ${rb} 0 0 1 ${x + w - rb} ${y + h}`,
    `H${x + rb}`,
    `A${rb} ${rb} 0 0 1 ${x} ${y + h - rb}`,
    `V${y + rt}`,
    `A${rt} ${rt} 0 0 1 ${x + rt} ${y}`,
    'Z',
  ].join(' ');
}

/** Knob: a ridged rim (3° ridges) on a lip, with a domed cap and an orange mark. */
const KNOB_R = C - 4;
const CAP_R = C - 14;
const RIDGE_DEG = 3;
const RIDGES = Array.from({ length: 360 / (RIDGE_DEG * 2) }, (_, i) => i * RIDGE_DEG * 2);

function wedge(startDeg: number, endDeg: number, r: number): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = C + r * Math.cos(rad(startDeg));
  const y1 = C + r * Math.sin(rad(startDeg));
  const x2 = C + r * Math.cos(rad(endDeg));
  const y2 = C + r * Math.sin(rad(endDeg));
  return `M${C} ${C} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

function Knob() {
  return (
    <>
      <Defs>
        <RadialGradient id="obj-cap" cx="40%" cy="30%" r="70%">
          <Stop offset="0" stopColor={objectColors.capHi} />
          <Stop offset="1" stopColor={objectColors.capLo} />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C + 4} r={KNOB_R} fill={objectColors.lip} />
      <Circle cx={C} cy={C} r={KNOB_R} fill={objectColors.ridgeLight} />
      <G fill={objectColors.ridgeDark}>
        {RIDGES.map((deg) => (
          <Path key={deg} d={wedge(deg, deg + RIDGE_DEG, KNOB_R)} />
        ))}
      </G>
      <Circle cx={C} cy={C} r={CAP_R} fill="url(#obj-cap)" />
      <Rect x={26} y={17} width={4} height={10} rx={2} fill={signal.orange} />
    </>
  );
}

/** Gauge: a dark face in a pale rim on a lip, the needle at 38°. */
function Gauge() {
  const needleBase = { x: 28.5, y: 44 };
  const length = 26;
  const angle = (38 * Math.PI) / 180;
  const tip = { x: needleBase.x + length * Math.sin(angle), y: needleBase.y - length * Math.cos(angle) };
  return (
    <>
      <Path d={roundedRect(-1, 10, 58, 50, 31, 11)} fill={objectColors.lip} />
      <Path d={roundedRect(-1, 5, 58, 50, 31, 11)} fill={objectColors.gaugeRim} />
      <Path d={roundedRect(2, 8, 52, 44, 28, 8)} fill={lcd.lcd} />
      <Line
        x1={needleBase.x}
        y1={needleBase.y}
        x2={tip.x}
        y2={tip.y}
        stroke={lcd.amberGlow}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Line
        x1={needleBase.x}
        y1={needleBase.y}
        x2={tip.x}
        y2={tip.y}
        stroke={signal.orange}
        strokeWidth={3}
      />
    </>
  );
}

/** Receipt: paper with a torn bottom, one dark line and two pale ones. */
function Receipt() {
  const x = 8;
  const w = S - 16;
  const h = S - 4;
  const torn = [
    [0, 0],
    [1, 0],
    [1, 0.9],
    [0.88, 1],
    [0.75, 0.9],
    [0.62, 1],
    [0.5, 0.9],
    [0.38, 1],
    [0.25, 0.9],
    [0.12, 1],
    [0, 0.9],
  ];
  const points = (dy: number) => torn.map(([px, py]) => `${x + px * w},${py * h + dy}`).join(' ');
  return (
    <>
      <Polygon points={points(5)} fill={objectColors.lip} />
      <Polygon points={points(0)} fill={objectColors.paper} />
      <Rect x={15} y={12} width={S - 30} height={3} fill={objectColors.paperInk} />
      <Rect x={15} y={21} width={S - 37} height={3} fill={objectColors.paperLine} />
      <Rect x={15} y={30} width={S - 33} height={3} fill={objectColors.paperLine} />
    </>
  );
}

/** End workout: the big orange key on its lip. */
function EndKey() {
  const r = C - 6;
  return (
    <>
      <Defs>
        <RadialGradient id="obj-key" cx="50%" cy="22%" r="80%">
          <Stop offset="0" stopColor={KEY.bigKeyHi} />
          <Stop offset="0.7" stopColor={KEY.bigKeyLo} />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C + 4} r={r} fill={KEY.bigKeyLip} />
      <Circle cx={C} cy={C} r={r} fill="url(#obj-key)" />
    </>
  );
}

/** Settings: two little switches, one on (orange) and one off. */
function Toggles() {
  const track = { x: 6, w: 44, h: 18, r: 9 };
  const rows = [
    { y: 8, on: true },
    { y: 30, on: false },
  ];
  return (
    <>
      <Defs>
        <RadialGradient id="obj-toggle" cx="40%" cy="30%" r="70%">
          <Stop offset="0" stopColor={objectColors.capHi} />
          <Stop offset="1" stopColor={objectColors.capLo} />
        </RadialGradient>
      </Defs>
      {rows.map(({ y, on }) => {
        const knobX = on ? track.x + track.w - track.r : track.x + track.r;
        return (
          <G key={y}>
            <Rect
              x={track.x - 2}
              y={y + 1}
              width={track.w + 4}
              height={track.h + 4}
              rx={track.r + 2}
              fill={objectColors.lip}
            />
            <Rect
              x={track.x - 2}
              y={y - 2}
              width={track.w + 4}
              height={track.h + 4}
              rx={track.r + 2}
              fill={objectColors.gaugeRim}
            />
            <Rect
              x={track.x}
              y={y}
              width={track.w}
              height={track.h}
              rx={track.r}
              fill={on ? signal.orange : lcd.lcd}
            />
            <Circle cx={knobX} cy={y + track.r + 2} r={track.r} fill={objectColors.lip} />
            <Circle cx={knobX} cy={y + track.r} r={track.r} fill="url(#obj-toggle)" />
          </G>
        );
      })}
    </>
  );
}

/** Cartridge: grey plastic with a dark label window and grip ridges (prototype `.cart`). */
function Cartridge() {
  const x = 10;
  const w = 36;
  return (
    <>
      <Defs>
        <RadialGradient id="obj-cart" cx="50%" cy="0%" r="120%">
          <Stop offset="0" stopColor={objectColors.plasticHi} />
          <Stop offset="1" stopColor={objectColors.plasticLo} />
        </RadialGradient>
      </Defs>
      <Path d={roundedRect(x, 6, w, 48, 8, 3)} fill={objectColors.lip} />
      <Path d={roundedRect(x, 2, w, 48, 8, 3)} fill="url(#obj-cart)" />
      <Rect x={x + 4} y={8} width={w - 8} height={18} rx={3} fill={lcd.lcd} />
      <Rect x={x + 9} y={14} width={w - 18} height={3} rx={1.5} fill={signal.orange} />
      <G stroke={objectColors.paperLine} strokeWidth={2}>
        {[0, 4, 8, 12, 16].map((dx) => (
          <Line key={dx} x1={x + 9 + dx} y1={36} x2={x + 9 + dx} y2={44} />
        ))}
      </G>
    </>
  );
}
