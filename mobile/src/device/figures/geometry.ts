/**
 * Path helpers for the exercise figures. Every one is a worklet: the moving parts rebuild
 * their `d` on the UI thread each frame (as `progress-line-chart` does).
 */

export function mix(from: number, to: number, t: number): number {
  'worklet';
  return from + (to - from) * t;
}

/** An open polyline through x, y pairs: `line(0, 0, 10, 10)`. */
export function line(...points: number[]): string {
  'worklet';
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    d += ` L${points[i]} ${points[i + 1]}`;
  }
  return d;
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  'worklet';
  const k = Math.min(r, w / 2, h / 2);
  return (
    `M${x + k} ${y} H${x + w - k} A${k} ${k} 0 0 1 ${x + w} ${y + k} V${y + h - k} ` +
    `A${k} ${k} 0 0 1 ${x + w - k} ${y + h} H${x + k} A${k} ${k} 0 0 1 ${x} ${y + h - k} ` +
    `V${y + k} A${k} ${k} 0 0 1 ${x + k} ${y} Z`
  );
}

export function circle(cx: number, cy: number, r: number): string {
  'worklet';
  return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/**
 * The middle joint (knee, elbow) of a limb from `a` to `b` with segment lengths `l1`, `l2`.
 * `bend` picks the side: for a limb pointing down the screen, +1 bends toward +x, −1 toward −x.
 */
export function joint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  l1: number,
  l2: number,
  bend: 1 | -1,
): [number, number] {
  'worklet';
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.max(0.001, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.001));
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / d;
  const uy = dy / d;
  return [ax + along * ux + bend * h * uy, ay + along * uy - bend * h * ux];
}

/** A limb a → joint → b as one stroke. */
export function limb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  l1: number,
  l2: number,
  bend: 1 | -1,
): string {
  'worklet';
  const [jx, jy] = joint(ax, ay, bx, by, l1, l2, bend);
  return line(ax, ay, jx, jy, bx, by);
}
