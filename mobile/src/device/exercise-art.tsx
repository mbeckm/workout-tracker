import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { bundledExerciseId } from '@/catalog/bundled';

import { EXERCISE_ART } from './exercise-art.generated';

/**
 * Exercise art for the exercise sheet's panel: dot-matrix frames in the display's own dots, made
 * offline (`scripts/exercise-art/`) and keyed by catalog id in the generated manifest. Two or
 * three frames loop (start, end, or start, middle, end); a lift without art keeps its SVG
 * movement figure, and a custom exercise gets neither (D5).
 */
const FRAME_MS = 900;

/** A bundled lift's frames by its catalog id, else by its name (plan rows keep the name). */
export function exerciseArt(
  id: string | undefined,
  name: string | undefined,
): readonly ImageSourcePropType[] | undefined {
  const byId = id ? EXERCISE_ART[id] : undefined;
  return byId ?? (name ? EXERCISE_ART[bundledExerciseId(name)] : undefined);
}

/** Loops the frames; with Reduce Motion on it holds the last (working) frame. */
export function ExerciseArt({ frames, label }: { frames: readonly ImageSourcePropType[]; label?: string }) {
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setStill(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setStill);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (still || frames.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(timer);
  }, [frames.length, still]);

  const shown = still ? frames.length - 1 : index;
  return (
    <View style={styles.fill} accessible accessibilityRole="image" accessibilityLabel={label}>
      {frames.map((source, i) => (
        <Image
          key={i}
          source={source}
          resizeMode="cover"
          fadeDuration={0}
          style={[styles.fill, styles.frame, i === shown ? styles.on : styles.off]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  frame: { position: 'absolute', top: 0, left: 0 },
  on: { opacity: 1 },
  off: { opacity: 0 },
});
