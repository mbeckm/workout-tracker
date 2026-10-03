import type { ExerciseFigure } from '@/catalog/bundled';

import { circle, limb, line, mix, roundRect } from './geometry';

/**
 * Trim's own movement figures (PLAN D5), drawn in the prototype's `FIG` style on a
 * 366 × 230 canvas: a light stick figure (9pt round strokes, a filled head), dark equipment,
 * orange plates and handles. No third-party artwork.
 *
 * Each part is a path built from `p`, the loop's progress (0 at rest, 1 at the far end of the
 * movement). Parts that never move are drawn once; moving parts rebuild on the UI thread.
 * Under Reduce Motion the figure holds its rest pose (`p = 0`).
 */

export const FIGURE_VIEWBOX = { width: 366, height: 230 } as const;

/** How a part is painted (colours in `figureColors`). */
export type FigurePaint = 'limb' | 'head' | 'equipment' | 'pad' | 'bar' | 'plate' | 'cable';

export type FigurePart = {
  paint: FigurePaint;
  d: (p: number) => string;
  /** Rebuilt every frame; otherwise drawn once at `p = 0`. */
  moves?: boolean;
};

const STILL = false;
const MOVES = true;

const part = (paint: FigurePaint, d: (p: number) => string, moves = STILL): FigurePart => ({
  paint,
  d,
  moves,
});

/** The floor line most standing figures stand on (prototype squat). */
const floor = part('equipment', () => {
  'worklet';
  return roundRect(60, 214, 246, 6, 3);
});

/* -- press: lying on a bench, the bar goes up and down (prototype `press`) ---------------- */

const press: FigurePart[] = [
  part('equipment', () => {
    'worklet';
    return roundRect(70, 182, 226, 14, 7) + roundRect(96, 196, 10, 30, 0) + roundRect(260, 196, 10, 30, 0);
  }),
  part('pad', () => {
    'worklet';
    return roundRect(118, 154, 150, 30, 14);
  }),
  part('head', () => {
    'worklet';
    return circle(96, 160, 15);
  }),
  part('limb', () => {
    'worklet';
    return line(112, 162, 232, 164) + line(232, 164, 262, 200, 262, 222);
  }),
  // Arms stay on the shoulders; the hands and the bar travel.
  part(
    'limb',
    (p) => {
      'worklet';
      const y = mix(98, 72, p);
      return line(150, 162, 150, y) + line(206, 163, 206, y);
    },
    MOVES,
  ),
  part(
    'bar',
    (p) => {
      'worklet';
      return roundRect(64, mix(90, 64, p), 238, 7, 3.5);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const y = mix(72, 46, p);
      return roundRect(72, y, 16, 44, 4) + roundRect(278, y, 16, 44, 4);
    },
    MOVES,
  ),
];

/* -- squat: front view, the hips sink and the knees bend out ------------------------------- */

const SQUAT_DROP = 30;

const squat: FigurePart[] = [
  floor,
  part(
    'limb',
    (p) => {
      'worklet';
      const hip = 140 + SQUAT_DROP * p;
      return (
        line(183, 74 + SQUAT_DROP * p, 183, hip) +
        limb(178, hip, 166, 212, 39, 37, -1) +
        limb(188, hip, 200, 212, 39, 37, 1) +
        line(150, 84 + SQUAT_DROP * p, 216, 84 + SQUAT_DROP * p)
      );
    },
    MOVES,
  ),
  part(
    'head',
    (p) => {
      'worklet';
      return circle(183, 56 + SQUAT_DROP * p, 15);
    },
    MOVES,
  ),
  part(
    'bar',
    (p) => {
      'worklet';
      return roundRect(64, 80 + SQUAT_DROP * p, 238, 7, 3.5);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const y = 62 + SQUAT_DROP * p;
      return roundRect(72, y, 16, 44, 4) + roundRect(278, y, 16, 44, 4);
    },
    MOVES,
  ),
];

/* -- hinge: side view, the torso tips forward from the hips with the bar on straight arms --- */

const HINGE_ANGLE = 1.25; // radians at the bottom (about 72°)

function hingePose(p: number) {
  'worklet';
  const angle = HINGE_ANGLE * p;
  const hipX = 184 - 18 * p;
  const hipY = 128 + 2 * p;
  const sx = hipX + 64 * Math.sin(angle);
  const sy = hipY - 64 * Math.cos(angle);
  return {
    hipX,
    hipY,
    sx,
    sy,
    headX: hipX + 86 * Math.sin(angle),
    headY: hipY - 86 * Math.cos(angle),
    handY: sy + 62,
  };
}

const hinge: FigurePart[] = [
  floor,
  part(
    'limb',
    (p) => {
      'worklet';
      const pose = hingePose(p);
      return (
        limb(pose.hipX, pose.hipY, 188, 212, 43, 42, 1) +
        line(188, 212, 204, 212) +
        line(pose.hipX, pose.hipY, pose.sx, pose.sy) +
        line(pose.sx, pose.sy, pose.sx, pose.handY)
      );
    },
    MOVES,
  ),
  part(
    'head',
    (p) => {
      'worklet';
      const pose = hingePose(p);
      return circle(pose.headX, pose.headY, 15);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const pose = hingePose(p);
      return circle(pose.sx, pose.handY, 24);
    },
    MOVES,
  ),
  part(
    'bar',
    (p) => {
      'worklet';
      const pose = hingePose(p);
      return circle(pose.sx, pose.handY, 5);
    },
    MOVES,
  ),
];

/* -- pull: front view under a bar, the body rises and the elbows drive down ---------------- */

const PULL_RISE = 40;

const pull: FigurePart[] = [
  part('equipment', () => {
    'worklet';
    return roundRect(70, 20, 10, 200, 4) + roundRect(286, 20, 10, 200, 4) + roundRect(70, 24, 226, 9, 4.5);
  }),
  part('plate', () => {
    'worklet';
    return roundRect(126, 20, 20, 17, 5) + roundRect(220, 20, 20, 17, 5);
  }),
  part(
    'limb',
    (p) => {
      'worklet';
      const y = -PULL_RISE * p;
      return (
        limb(136, 30, 162, 116 + y, 46, 44, -1) +
        limb(230, 30, 204, 116 + y, 46, 44, 1) +
        line(162, 116 + y, 204, 116 + y) +
        line(183, 116 + y, 183, 176 + y) +
        line(183, 176 + y, 174, 216 + y) +
        line(183, 176 + y, 192, 216 + y)
      );
    },
    MOVES,
  ),
  part(
    'head',
    (p) => {
      'worklet';
      return circle(183, 94 - PULL_RISE * p, 15);
    },
    MOVES,
  ),
];

/* -- row: side view, bent over, the bar comes up to the ribs ------------------------------- */

const row: FigurePart[] = [
  floor,
  part('limb', () => {
    'worklet';
    return limb(160, 120, 172, 212, 46, 44, 1) + line(172, 212, 188, 212) + line(160, 120, 232, 92);
  }),
  part('head', () => {
    'worklet';
    return circle(252, 80, 15);
  }),
  part(
    'limb',
    (p) => {
      'worklet';
      return limb(230, 96, 232, mix(176, 140, p), 40, 42, -1);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      return circle(232, mix(176, 140, p), 24);
    },
    MOVES,
  ),
  part(
    'bar',
    (p) => {
      'worklet';
      return circle(232, mix(176, 140, p), 5);
    },
    MOVES,
  ),
];

/* -- fly: between two cable stacks, the arms sweep together (prototype `fly`) -------------- */

function flyHands(p: number) {
  'worklet';
  const spread = mix(1, 0.3, p);
  return { elbow: 63 * spread, hand: 91 * spread };
}

const fly: FigurePart[] = [
  part('equipment', () => {
    'worklet';
    return roundRect(40, 20, 12, 200, 4) + roundRect(314, 20, 12, 200, 4);
  }),
  part(
    'cable',
    (p) => {
      'worklet';
      const { hand } = flyHands(p);
      return line(52, 80, 183 - hand, 96) + line(314, 80, 183 + hand, 96);
    },
    MOVES,
  ),
  part('limb', () => {
    'worklet';
    return line(183, 70, 183, 150, 166, 214) + line(183, 150, 200, 214);
  }),
  part('head', () => {
    'worklet';
    return circle(183, 52, 15);
  }),
  part(
    'limb',
    (p) => {
      'worklet';
      const { elbow, hand } = flyHands(p);
      return line(183, 90, 183 - elbow, 100, 183 - hand, 96) + line(183, 90, 183 + elbow, 100, 183 + hand, 96);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const { hand } = flyHands(p);
      return roundRect(183 - hand - 5, 88, 10, 16, 3) + roundRect(183 + hand - 5, 88, 10, 16, 3);
    },
    MOVES,
  ),
];

/* -- standing side view (curl, extension) ------------------------------------------------- */

const standingSide = part('limb', () => {
  'worklet';
  return line(180, 64, 180, 136) + limb(180, 136, 178, 212, 40, 38, 1) + line(178, 212, 196, 212);
});
const standingHead = part('head', () => {
  'worklet';
  return circle(182, 44, 15);
});
/** Upper arm fixed at the side: shoulder (180, 72) to elbow (186, 120). */
const ELBOW = { x: 186, y: 120 };
const FOREARM = 50;

function hand(angle: number): [number, number] {
  'worklet';
  return [ELBOW.x + FOREARM * Math.sin(angle), ELBOW.y + FOREARM * Math.cos(angle)];
}

/* -- curl: the forearm swings up around a still elbow --------------------------------------- */

const curl: FigurePart[] = [
  floor,
  standingSide,
  standingHead,
  part(
    'limb',
    (p) => {
      'worklet';
      const [hx, hy] = hand(mix(0.12, 2.45, p));
      return line(180, 72, ELBOW.x, ELBOW.y, hx, hy);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const [hx, hy] = hand(mix(0.12, 2.45, p));
      return circle(hx, hy, 12);
    },
    MOVES,
  ),
];

/* -- extension: a cable pushdown, the forearm straightens down ---------------------------- */

const extension: FigurePart[] = [
  floor,
  part('equipment', () => {
    'worklet';
    return roundRect(294, 16, 12, 198, 4) + circle(294, 30, 9);
  }),
  part(
    'cable',
    (p) => {
      'worklet';
      const [hx, hy] = hand(mix(2.2, 0.18, p));
      return line(288, 30, hx, hy);
    },
    MOVES,
  ),
  standingSide,
  standingHead,
  part(
    'limb',
    (p) => {
      'worklet';
      const [hx, hy] = hand(mix(2.2, 0.18, p));
      return line(180, 72, ELBOW.x, ELBOW.y, hx, hy);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const [hx, hy] = hand(mix(2.2, 0.18, p));
      return roundRect(hx - 10, hy - 4, 20, 8, 4);
    },
    MOVES,
  ),
];

/* -- standing front view (raise, carry) --------------------------------------------------- */

const standingFront = part('limb', () => {
  'worklet';
  return line(183, 64, 183, 140) + line(183, 140, 170, 212) + line(183, 140, 196, 212);
});
const frontHead = part('head', () => {
  'worklet';
  return circle(183, 44, 15);
});

/* -- raise: arms lift out to the side to shoulder height ---------------------------------- */

const ARM = 72;

function raiseHands(p: number) {
  'worklet';
  const angle = mix(0.14, 1.5, p);
  return {
    lx: 166 - ARM * Math.sin(angle),
    rx: 200 + ARM * Math.sin(angle),
    y: 80 + ARM * Math.cos(angle),
  };
}

const raise: FigurePart[] = [
  floor,
  standingFront,
  frontHead,
  part(
    'limb',
    (p) => {
      'worklet';
      const h = raiseHands(p);
      return line(h.lx, h.y, 166, 80, 200, 80, h.rx, h.y);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const h = raiseHands(p);
      return roundRect(h.lx - 6, h.y - 12, 12, 24, 4) + roundRect(h.rx - 6, h.y - 12, 12, 24, 4);
    },
    MOVES,
  ),
];

/* -- carry / hold: heavy bells at the sides, the shoulders shrug up ------------------------ */

const SHRUG = 14;

const carry: FigurePart[] = [
  floor,
  standingFront,
  frontHead,
  part(
    'limb',
    (p) => {
      'worklet';
      const y = 76 - SHRUG * p;
      return line(150, 150 - SHRUG * p, 158, y, 208, y, 216, 150 - SHRUG * p);
    },
    MOVES,
  ),
  part(
    'plate',
    (p) => {
      'worklet';
      const y = 146 - SHRUG * p;
      return roundRect(138, y, 24, 36, 7) + roundRect(204, y, 24, 36, 7);
    },
    MOVES,
  ),
];

export const FIGURES: Readonly<Record<ExerciseFigure, readonly FigurePart[]>> = {
  press,
  squat,
  hinge,
  pull,
  row,
  fly,
  curl,
  extension,
  raise,
  carry,
};
