import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PrCrown } from '@/components/pr-crown';
import { iconSize, space } from '@/constants/theme';
import type { WeightUnit } from '@/domain/helpers';
import { exerciseDoneLine } from '@/domain/set-lines';
import type { LoggedExercise } from '@/domain/types';
import { DURATION, EASE_OUT, SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';

/**
 * One exercise on Done (trim-ui → Per screen → Done): the `row` name over one `caption` line,
 * `4 × 8 reps at 60 kg` or `4 sets, best 85 kg × 8`. Every set lives in History's session
 * detail; Done is the moment, not the record.
 *
 * A personal best reads in `label` ink (emphasis is a label tier, trim-ui §3 rule 10), and its
 * crown lands with `SPRING.pop` once Done has landed (`landed`), `delayMs` after it. Under
 * Reduce Motion the crown crossfades in.
 */
export function DoneExercise({
  exercise,
  unit,
  prSetIds,
  landed,
  delayMs = 0,
  testID,
}: {
  exercise: Pick<LoggedExercise, 'exerciseName' | 'sets'>;
  unit: WeightUnit | null;
  prSetIds?: ReadonlySet<string>;
  landed: boolean;
  delayMs?: number;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const line = exerciseDoneLine(exercise, { unit, prSetIds });

  return (
    <View
      accessible
      accessibilityLabel={[
        exercise.exerciseName,
        line.accessibilityLabel,
        line.pr ? 'personal best' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      testID={testID}
      style={{ gap: space.pair }}>
      <Text style={type.row} numberOfLines={2}>
        {exercise.exerciseName}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
        <Text
          style={[
            type.caption,
            {
              flexShrink: 1,
              color: line.pr ? colors.label : colors.secondaryLabel,
              fontVariant: ['tabular-nums'],
            },
          ]}>
          {line.text}
        </Text>
        {line.pr ? <LandingCrown landed={landed} delayMs={delayMs} /> : null}
      </View>
    </View>
  );
}

/** The PR crown, waiting for Done to land, then popping in from half size (never from 0). */
function LandingCrown({ landed, delayMs }: { landed: boolean; delayMs: number }) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.5);

  useEffect(() => {
    if (!landed) {
      return;
    }
    // The fade is the reduced-motion moment, so it plays either way.
    shown.set(
      withDelay(
        delayMs,
        withTiming(1, {
          duration: reduceMotion ? DURATION.change : DURATION.fade,
          easing: EASE_OUT,
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    );
    if (!reduceMotion) {
      scale.set(withDelay(delayMs, withSpring(1, SPRING.pop)));
    }
  }, [delayMs, landed, reduceMotion, scale, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View style={style}>
      <PrCrown size={iconSize.caption} />
    </Animated.View>
  );
}
