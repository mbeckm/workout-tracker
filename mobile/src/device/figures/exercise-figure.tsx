import { useEffect } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, type PathProps } from 'react-native-svg';

import type { ExerciseFigure as FigureKind } from '@/catalog/bundled';
import { figureColors } from '@/constants/theme';
import { DEVICE } from '@/motion';

import { FIGURES, FIGURE_VIEWBOX, type FigurePaint, type FigurePart } from './patterns';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const LIMB = 9;
const CABLE = 3;

const PAINT: Record<FigurePaint, PathProps> = {
  limb: {
    stroke: figureColors.body,
    strokeWidth: LIMB,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  },
  head: { fill: figureColors.body },
  equipment: { fill: figureColors.equipment },
  pad: { fill: figureColors.pad },
  bar: { fill: figureColors.bar },
  plate: { fill: figureColors.plate },
  cable: { stroke: figureColors.cable, strokeWidth: CABLE, strokeLinecap: 'round', fill: 'none' },
};

/** Half the loop each way: rest → far end → rest over `FIGURE_LOOP` (prototype 2.4 s ease-in-out). */
const HALF_LOOP = {
  duration: DEVICE.FIGURE_LOOP / 2,
  easing: Easing.inOut(Easing.ease),
  reduceMotion: ReduceMotion.Never,
} as const;

/**
 * One movement figure (D5). It demonstrates the movement in a gentle loop while its sheet is
 * open (trim-ui §8 rule 5's exception); under Reduce Motion it holds the rest pose. The loop
 * runs on the UI thread: moving parts rebuild their path from one shared progress value.
 */
export function ExerciseFigure({ figure }: { figure: FigureKind }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.set(0);
      return;
    }
    progress.set(withRepeat(withTiming(1, HALF_LOOP), -1, true));
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const parts = FIGURES[figure];
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${FIGURE_VIEWBOX.width} ${FIGURE_VIEWBOX.height}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {parts.map((item, index) =>
        item.moves ? (
          <MovingPart key={index} part={item} progress={progress} />
        ) : (
          <Path key={index} d={item.d(0)} {...PAINT[item.paint]} />
        ),
      )}
    </Svg>
  );
}

function MovingPart({ part, progress }: { part: FigurePart; progress: SharedValue<number> }) {
  const build = part.d;
  const animatedProps = useAnimatedProps(() => ({ d: build(progress.get()) }));
  return <AnimatedPath animatedProps={animatedProps} d={build(0)} {...PAINT[part.paint]} />;
}
