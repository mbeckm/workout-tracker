import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { isStarterDayCount, planFromStarterTemplate, starterTemplateById } from '@/catalog/templates';
import type { WorkoutPlan } from '@/domain/types';
import { importedPlan } from '@/screens/plan-import/finish-import';
import { getImportSession } from '@/screens/plan-import/session';
import { finishColors, onboardingGeometry, sheetGeometry, space } from '@/constants/theme';
import { FINISHES, finishLock, type Finish } from '@/domain/finish';
import { DeviceObject, deviceObjectScale, offLamps } from '@/device/device-object';
import { useFinish } from '@/device/finish';
import { FinishSwatch } from '@/device/finish-swatch';
import { useHaptics } from '@/device/haptics';
import { EmptySlot } from '@/device/home/home-display';
import { useWorkoutStore } from '@/store/workout-store';

import { useFinishOnboarding } from './finish';
import { OnboardingFrame } from './frame';

const COLUMNS = 3;
const GRID_GAP = space.inline;

/**
 * Step 6 (N10, D3, D12, decision 80): the device large on the grid, in the finish being picked,
 * over the six machines in two rows. 212 and 101 save on tap; for free users the other four
 * preview only (a locked
 * finish stays if the paywall after "Plan ready" ends with Trim Pro). Continue loads the plan:
 * a template plays "Plan ready" then the paywall, Build my own opens the editor.
 */
export function OnboardingPickFinish() {
  const params = useLocalSearchParams<{ days?: string; template?: string; own?: string; imported?: string }>();
  if (params.imported === '1') {
    const session = getImportSession();
    if (!session.match) {
      return <Redirect href="/onboarding/import" />;
    }
    return (
      <PickFinish
        days={session.match.days.length}
        planName={session.name.trim() || null}
        onLoad={() => importedPlan(session, 'onboarding')}
        path="import"
      />
    );
  }
  const days = Number(params.days);
  const template = starterTemplateById(params.template);
  const own = params.own === '1';
  if (!isStarterDayCount(days) || (!own && !template)) {
    return <Redirect href="/onboarding/days" />;
  }
  return (
    <PickFinish
      days={days}
      planName={template?.name ?? null}
      onLoad={template ? () => planFromStarterTemplate(template) : null}
    />
  );
}

function PickFinish({
  days,
  planName,
  onLoad,
  path = 'template',
}: {
  days: number;
  planName: string | null;
  /** Builds the template's (or the imported) plan; null on the Build my own path. */
  onLoad: (() => WorkoutPlan) | null;
  path?: 'template' | 'import';
}) {
  const { finish, preview, setPreview } = useFinish();
  const { setFinish, isPro, tourDone } = useWorkoutStore();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const { finishWithPlan, finishBuildingOwn } = useFinishOnboarding();
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  const handedOff = useRef(false);

  // Back drops a preview; Continue hands it to "Plan ready" and the paywall.
  useEffect(
    () => () => {
      if (!handedOff.current) {
        setPreview(null);
      }
    },
    [setPreview],
  );

  // Graphite is the tour's reward (decision 85): here it previews, like a Pro finish.
  const lockOf = (id: Finish) => finishLock(id, { isPro, tourDone });
  const locked = (id: Finish) => lockOf(id) != null;

  const pick = (id: Finish) => {
    if (id === finish) {
      return;
    }
    haptics.swatch();
    if (locked(id)) {
      setPreview(id);
      return;
    }
    setPreview(null);
    setFinish(id);
  };

  const next = () => {
    handedOff.current = true;
    if (onLoad) {
      finishWithPlan(onLoad(), preview != null && lockOf(preview) === 'pro' ? preview : null, path);
    } else {
      finishBuildingOwn(days);
    }
  };

  const onStage = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setStage((current) => (current?.width === w && current.height === h ? current : { width: w, height: h }));
  };

  const swatchWidth = (width - onboardingGeometry.gutter * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <OnboardingFrame
      title="Pick your finish"
      scroll={false}
      action={{ title: planName ? `Load ${planName}` : 'Continue', onPress: next, testID: 'onboarding-load' }}
      testID="onboarding-finish">
      <View style={styles.stage} onLayout={onStage}>
        {stage ? (
          <DeviceObject
            scale={deviceObjectScale(stage.width, stage.height)}
            displayKey="empty"
            display={<EmptySlot />}
            lamps={offLamps(days)}
            accessibilityLabel={`Trim in finish ${finish}, ${finishColors[finish].name}`}
          />
        ) : null}
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Finish" style={styles.grid}>
        {FINISHES.map((id) => (
          <FinishSwatch
            key={id}
            id={id}
            width={swatchWidth}
            selected={id === finish}
            lock={lockOf(id)}
            onPress={() => pick(id)}
            testID={`onboarding-finish-${id}`}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: space.gutter },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingBottom: space.inset,
    // The selected swatch lifts and tilts; keep it clear of the pill.
    paddingTop: sheetGeometry.swatchLift,
  },
});
