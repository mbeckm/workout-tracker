import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { track } from '@/analytics/analytics';
import type { PlanMatch } from '@/catalog/plan-import-match';
import { fontScaleCap, gadgetType, importGeometry, onboardingType, sheetGeometry, space } from '@/constants/theme';
import { useDevice } from '@/device/device-context';
import type { SheetParams } from '@/device/device-state';
import { FIX_SUB, fixTitle } from '@/screens/onboarding/import-fix';
import { IMPORT_SUB } from '@/screens/onboarding/import';
import { allFixed, FixView, unknownLifts } from '@/screens/plan-import/fix-view';
import { importedPlan } from '@/screens/plan-import/finish-import';
import { ImportArt, useArtClock } from '@/screens/plan-import/import-art';
import { ImportButtons, importButtonReach } from '@/screens/plan-import/import-buttons';
import { useImportReader } from '@/screens/plan-import/reader';
import { ReadingView } from '@/screens/plan-import/reading-view';
import { useKeyboardVisible } from '@/screens/plan-import/use-keyboard-visible';
import { clearImport, getImportSession, startImport, updateImportSession, useImportSession, type ImportInput } from '@/screens/plan-import/session';
import { useWorkoutStore } from '@/store/workout-store';

import { PillButton, SheetHeader, SheetScroll, StickyActionBar } from './primitives';

type Step = 'start' | 'read' | 'fix';

/**
 * Import plan from the rack's New plan sheet (decision 88): the same three steps as onboarding, as
 * one tall sheet.
 * Import plan (the illustration, Paste, Screenshots) → Reading → Fix when a lift wasn't
 * recognized. The new plan opens in the editor like every new plan (Done, "Plan created"); it
 * becomes active only when it's the first plan, as with `Build one`. The rack checked the
 * second-plan gate before opening this.
 */
export function ImportSheet({ params }: { params: SheetParams }) {
  const { swapSheet } = useDevice();
  const { plans, savePlan, customExercises, saveCustomExercise } = useWorkoutStore();
  const session = useImportSession();
  const [step, setStep] = useState<Step>('start');
  const [attempt, setAttempt] = useState(0);
  const t = useArtClock();
  const typing = useKeyboardVisible();
  const via: SheetParams = params.via ? { via: params.via } : {};

  const onRead = (match: PlanMatch | null) => {
    if (!match || !session.input) return;
    updateImportSession({ match, name: match.name });
    track('plan_import_read', {
      source: session.input.kind === 'images' ? 'screenshots' : 'text',
      screenshots: session.input.kind === 'images' ? session.input.uris.length : 0,
      days: match.days.length,
      lifts: match.days.reduce((sum, day) => sum + day.lifts.length, 0),
      unknown: unknownLifts(match).length,
      where: 'plans',
    });
  };
  const state = useImportReader(step === 'start' ? null : session.input, customExercises, onRead, attempt);

  const onInput = (input: ImportInput) => {
    startImport(input);
    setAttempt((value) => value + 1);
    setStep('read');
  };

  /** ‹ on the first step: back to the New plan cards, the import dropped. */
  const toNewPlan = () => {
    Keyboard.dismiss();
    clearImport();
    swapSheet('new-plan', via);
  };

  const finish = () => {
    Keyboard.dismiss();
    const plan = importedPlan(getImportSession(), 'plans');
    savePlan(plan, { activate: plans.length === 0 });
    swapSheet('editor', { planId: plan.id, new: '1', ...via });
  };

  if (step === 'start') {
    return (
      <SheetScroll header={<SheetHeader title="Import plan" left={{ kind: 'back', onPress: toNewPlan }} />}>
        <View style={styles.page} testID="import-sheet">
          <Text maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.sub, styles.sub]}>
            {IMPORT_SUB}
          </Text>
          <View style={styles.art}>
            <ImportArt t={t} reach={importButtonReach(sheetGeometry.pillHeight, space.section + space.related)} />
          </View>
          <ImportButtons t={t} pillHeight={sheetGeometry.pillHeight} onInput={onInput} />
        </View>
      </SheetScroll>
    );
  }

  if (step === 'read') {
    const empty = state.phase === 'empty';
    const next = () => {
      if (empty) {
        setStep('start');
        return;
      }
      if (session.match && unknownLifts(session.match).length > 0) setStep('fix');
      else finish();
    };
    return (
      <SheetScroll
        header={<SheetHeader title="Import plan" left={{ kind: 'back', onPress: () => setStep('start') }} />}
        actionBar={
          <StickyActionBar>
            <PillButton
              title={empty ? 'Try again' : 'Continue'}
              disabled={state.phase === 'reading'}
              onPress={next}
              testID="import-read-continue"
            />
          </StickyActionBar>
        }>
        <View style={styles.page}>
          <ReadingView state={state} name={session.name} onRename={(name) => updateImportSession({ name })} />
        </View>
      </SheetScroll>
    );
  }

  const match = session.match;
  if (!match) {
    return null;
  }
  const left = unknownLifts(match).filter((item) => !session.fixes.has(item.key)).length;
  return (
    <SheetScroll
      header={<SheetHeader title="Import plan" left={{ kind: 'back', onPress: () => setStep('read') }} />}
      actionBar={
        typing ? undefined : (
        <StickyActionBar>
          <PillButton
            title="Continue"
            disabled={!allFixed(match, session.fixes)}
            onPress={finish}
            testID="import-fix-continue"
          />
        </StickyActionBar>
        )
      }>
      <View style={styles.page}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap.title} style={gadgetType.sheetHero}>
          {fixTitle(left)}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.sub, styles.sub]}>
          {FIX_SUB}
        </Text>
        <View style={styles.fix}>
          <FixView
            match={match}
            fixes={session.fixes}
            onFix={(key, exercise) => {
              const fixes = new Map(session.fixes);
              fixes.set(key, exercise);
              updateImportSession({ fixes });
            }}
            customExercises={customExercises}
            saveCustomExercise={saveCustomExercise}
          />
        </View>
      </View>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: sheetGeometry.sidePad + space.tight, gap: space.related },
  sub: { marginBottom: space.related },
  art: { height: importGeometry.tileMinHeight + importGeometry.phoneTop * 2, marginBottom: space.section },
  fix: { marginTop: space.related },
});
