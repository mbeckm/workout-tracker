import { StyleSheet, View } from 'react-native';

import { track } from '@/analytics/analytics';
import { importGeometry, sheetGeometry, space } from '@/constants/theme';
import { emptyPlan } from '@/domain/helpers';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { BuildDeviceCard, ImportDeviceCard } from '@/screens/plan-import/new-plan-cards';
import { useWorkoutStore } from '@/store/workout-store';

import { SheetHeader, SheetScroll } from './primitives';

/**
 * New plan (decision 88): the rack's `New plan` opens two small Trim machines whose displays show
 * what each choice does (round 6 on the canvas, I2). Import plan goes on to reading one from text or screenshots; Build one starts an empty plan in
 * the editor (active only when it's the first plan). The rack checked the second-plan gate.
 */
export function NewPlanSheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { plans, savePlan } = useWorkoutStore();
  const via: SheetParams = params.via ? { via: params.via } : {};

  const build = () => {
    const plan = emptyPlan();
    track('plan_created', { plan_count: plans.length });
    savePlan(plan, { activate: plans.length === 0 });
    swapSheet('editor', { planId: plan.id, new: '1', ...via });
  };

  return (
    <SheetScroll header={<SheetHeader title="New plan" left={{ kind: 'back', onPress: () => swapSheet('plans', via) }} />}>
      <View style={styles.cards} testID="new-plan-sheet">
        <View style={styles.card}>
          <ImportDeviceCard onPress={() => swapSheet('import', via)} />
        </View>
        <View style={styles.card}>
          <BuildDeviceCard onPress={build} />
        </View>
      </View>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space.related, paddingTop: space.related, paddingHorizontal: sheetGeometry.sidePad - space.tight },
  card: { height: importGeometry.forkCardHeight },
});
