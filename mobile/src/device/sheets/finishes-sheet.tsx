import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { finishColors, sheetGeometry, space } from '@/constants/theme';
import { FINISHES, finishLock, type Finish } from '@/domain/finish';
import { track } from '@/analytics/analytics';
import { useFinish } from '@/device/finish';
import { isProFinish } from '@/device/finish-swatch';
import { useHaptics } from '@/device/haptics';
import { useLogSession } from '@/device/log';
import { SkinRow, type SkinRowPill } from '@/device/skin-row';
import { requirePro } from '@/purchases/pro-gate';
import { useWorkoutStore } from '@/store/workout-store';

import { SheetHeader } from './primitives';
import { useSheetChrome } from './sheet-context';

/**
 * The Skin Library (decision 97): the tour's row of machines in a tall sheet. Every skin as the
 * whole machine; swipe the row (or tap a neighbour or a dot) and the one in the middle is the
 * pick, each passing with the `reskin` thock. The pill acts on it: `Keep <skin>` for the one the
 * device wears, `Use <skin>` saves another free one, and on a Trim Pro skin `Try Trim Pro` opens
 * the paywall (after a purchase the skin applies at once, trim-ui §12 rule 17). Either way the
 * sheet closes onto the device in its skin. During a workout a locked skin is `Comes with Trim
 * Pro`, disabled: never a paywall mid-workout (trim-ui §12 rule 6). Nothing previews on the
 * device: the machine in the row is the preview.
 */
export function FinishesSheet() {
  const { close } = useSheetChrome();
  const { savedFinish, setPreview } = useFinish();
  const { setFinish, isPro, tourDone } = useWorkoutStore();
  const log = useLogSession();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const inWorkout = log.openDay != null;

  const [pick, setPick] = useState<Finish>(savedFinish);
  const pos = useSharedValue(Math.max(0, FINISHES.indexOf(savedFinish)));
  const z = useSharedValue(1);

  // Nothing is previewed on the device from here; clear one left by an older path.
  useEffect(() => {
    setPreview(null);
  }, [setPreview]);

  // Pro finishes and, until the tour gives it, Graphite only preview (decision 85).
  const lockOf = useCallback((id: Finish) => finishLock(id, { isPro, tourDone }), [isPro, tourDone]);

  const onPass = useCallback(
    (id: Finish) => {
      haptics.reskin();
      setPick(id);
      if (finishLock(id, { isPro, tourDone })) track('finish_previewed', { finish: id, locked: true });
    },
    [haptics, isPro, tourDone],
  );

  const save = (id: Finish) => {
    if (id !== savedFinish) {
      setFinish(id);
      track('finish_selected', { finish: id, from: savedFinish, source: 'sheet', pro: isProFinish(id) });
    }
    close();
  };

  const tryPro = async () => {
    const wanted = pick;
    // After a purchase or restore the skin applies at once (trim-ui §12 rule 17).
    if (await requirePro('finishes')) save(wanted);
  };

  const lock = lockOf(pick);
  const name = finishColors[pick].name;
  const label =
    lock === 'pro' ? 'TRIM PRO SKIN' : lock === 'tour' ? 'TOUR REWARD' : pick === savedFinish ? 'YOUR SKIN' : 'FREE SKIN';
  const pill: SkinRowPill =
    lock === 'pro' && !inWorkout
      ? { title: 'Try Trim Pro', variant: 'light', onPress: () => void tryPro(), testID: 'finishes-try-pro' }
      : lock != null
        ? {
            title: lock === 'tour' ? 'Earned in the tour' : 'Comes with Trim Pro',
            variant: 'dark',
            disabled: true,
            onPress: () => undefined,
            testID: 'finishes-locked',
          }
        : {
            title: pick === savedFinish ? `Keep ${name}` : `Use ${name}`,
            variant: 'light',
            onPress: () => save(pick),
            testID: 'finishes-use',
          };

  return (
    <View style={styles.fill}>
      <SheetHeader title="Skin Library" right={{ kind: 'close', onPress: close }} />
      <SkinRow
        row={FINISHES}
        pick={pick}
        pos={pos}
        z={z}
        enabled
        onPass={onPass}
        lockOf={lockOf}
        label={label}
        pill={pill}
        top={space.related}
        bottom={Math.max(insets.bottom, sheetGeometry.bottomPad)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
