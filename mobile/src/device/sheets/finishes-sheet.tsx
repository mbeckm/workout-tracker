import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { finishColors, sheetGeometry, space } from '@/constants/theme';
import { FINISHES, type Finish } from '@/domain/finish';
import { track } from '@/analytics/analytics';
import { useDevice } from '@/device/device-context';
import { useFinish } from '@/device/finish';
import { FinishSwatch, isProFinish } from '@/device/finish-swatch';
import { useHaptics } from '@/device/haptics';
import { useLogSession } from '@/device/log';
import { enterUp, exitFade, SPRING } from '@/motion';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

import { PillButton, SheetHeader, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/** Swatches shrink below 112 so three and a half always show: the fourth peeks, so the row reads as scrolling. */
const VISIBLE_SWATCHES = 3.5;
const SWATCH_MIN = 92;

export function swatchWidth(windowWidth: number): number {
  const gaps = (Math.ceil(VISIBLE_SWATCHES) - 1) * sheetGeometry.swatchGap;
  const fit = (windowWidth - sheetGeometry.sectionX - gaps) / VISIBLE_SWATCHES;
  return Math.round(Math.max(SWATCH_MIN, Math.min(sheetGeometry.swatchW, fit)));
}

const MOVE = LinearTransition.springify().duration(SPRING.settle.duration).dampingRatio(SPRING.settle.dampingRatio);

/**
 * Finishes (SPEC §6 Finishes, D3): a short sheet so the device stays in view and changes live.
 * 212 and 101 are free and save on tap. 305 and 408 are Trim Pro for free users: a tap previews
 * the finish on the device and shows a light `Get Trim Pro` pill, the one way to the paywall from
 * here. Closing the sheet reverts the preview silently. During a workout locked finishes preview
 * only (never a paywall mid-workout, trim-ui §12 rule 6).
 */
export function FinishesSheet() {
  const { close } = useSheetChrome();
  const { state } = useDevice();
  const { finish, savedFinish, preview, setPreview } = useFinish();
  const { setFinish, isPro } = useWorkoutStore();
  const log = useLogSession();
  const haptics = useHaptics();
  const reduceMotion = Boolean(useReducedMotion());
  const { width: windowWidth } = useWindowDimensions();
  const width = swatchWidth(windowWidth);
  const row = useRef<ScrollView>(null);

  const isOpen = state.sheet?.kind === 'finishes';
  const inWorkout = log.openDay != null;
  const locked = (id: Finish) => !isPro && isProFinish(id);
  const previewingLocked = preview != null && locked(preview);

  // Closing (✕, Done, a swipe, the scrim, or a swap away) puts the saved finish back at once,
  // while the sheet slides down; unmounting covers anything else.
  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
    }
  }, [isOpen, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  const save = (id: Finish) => {
    setPreview(null);
    if (id !== savedFinish) {
      setFinish(id);
      track('finish_selected', { finish: id });
    }
  };

  const pick = (id: Finish) => {
    if (id === finish) {
      return;
    }
    haptics.swatch();
    // A swatch at either end of the row scrolls fully into view as it's picked.
    const index = FINISHES.indexOf(id);
    if (index === FINISHES.length - 1) {
      row.current?.scrollToEnd({ animated: !reduceMotion });
    } else if (index === 0) {
      row.current?.scrollTo({ x: 0, animated: !reduceMotion });
    }
    if (locked(id)) {
      setPreview(id);
      return;
    }
    save(id);
  };

  const getPro = async () => {
    const wanted = preview;
    if (!wanted) {
      return;
    }
    // After a purchase or restore the finish applies at once (trim-ui §12 rule 17).
    if (await requirePro('finishes')) {
      save(wanted);
    }
  };

  // The selected swatch starts in view (408 sits past the edge).
  const onRowLayout = () => {
    if (FINISHES.indexOf(finish) >= Math.floor(VISIBLE_SWATCHES)) {
      row.current?.scrollToEnd({ animated: false });
    }
  };

  return (
    <SheetScroll header={<SheetHeader title={`Finish ${finish}, ${finishColors[finish].name}`} />}>
      <ScrollView
        ref={row}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={onRowLayout}
        accessibilityRole="radiogroup"
        accessibilityLabel="Finish"
        style={styles.row}
        contentContainerStyle={styles.rowContent}>
        {FINISHES.map((id) => (
          <FinishSwatch
            key={id}
            id={id}
            width={width}
            selected={id === finish}
            locked={locked(id)}
            onPress={() => pick(id)}
          />
        ))}
      </ScrollView>
      {previewingLocked && !inWorkout ? (
        <Animated.View entering={enterUp(reduceMotion)} exiting={exitFade(reduceMotion)}>
          <PillButton title="Get Trim Pro" onPress={() => void getPro()} testID="finishes-get-pro" />
        </Animated.View>
      ) : null}
      <Animated.View layout={reduceMotion ? undefined : MOVE}>
        <PillButton
          title="Done"
          variant="dark"
          onPress={close}
          style={previewingLocked && !inWorkout ? styles.doneUnder : styles.done}
          testID="finishes-done"
        />
      </Animated.View>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -sheetGeometry.sidePad },
  rowContent: {
    gap: sheetGeometry.swatchGap,
    paddingHorizontal: sheetGeometry.sectionX,
    paddingTop: space.related,
    paddingBottom: space.inset,
  },
  done: { marginTop: space.related },
  doneUnder: { marginTop: sheetGeometry.cardGap },
});
