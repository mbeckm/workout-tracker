import { StyleSheet, View } from 'react-native';

import { track } from '@/analytics/analytics';
import { importGeometry, sheetGeometry, space } from '@/constants/theme';
import { emptyPlan } from '@/domain/helpers';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { EmptySlotsArt, ForkCard, NotesArt } from '@/screens/plan-import/fork-cards';
import { useWorkoutStore } from '@/store/workout-store';

import { SheetHeader, SheetScroll } from './primitives';

/**
 * New plan (decision 88): the rack's `New plan` opens two big cards, the onboarding fork's look.
 * Import plan goes on to reading one from text or screenshots; Build one starts an empty plan in
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
        <ForkCard
          title="Import plan"
          sub="Notes, ChatGPT, another app"
          onPress={() => swapSheet('import', via)}
          style={styles.card}
          testID="new-plan-import">
          <NotesArt />
        </ForkCard>
        <ForkCard title="Build one" sub="Start empty" onPress={build} style={styles.card} testID="new-plan-build">
          <EmptySlotsArt />
        </ForkCard>
      </View>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space.related, paddingTop: space.related, paddingHorizontal: sheetGeometry.sidePad - space.tight },
  card: { height: importGeometry.forkCardHeight },
});
