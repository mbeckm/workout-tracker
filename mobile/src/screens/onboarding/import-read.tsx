import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { track } from '@/analytics/analytics';
import type { PlanMatch } from '@/catalog/plan-import-match';
import { ReadingView } from '@/screens/plan-import/reading-view';
import { useImportReader } from '@/screens/plan-import/reader';
import { unknownLifts } from '@/screens/plan-import/fix-view';
import { updateImportSession, useImportSession } from '@/screens/plan-import/session';
import { useWorkoutStore } from '@/store/workout-store';

import { OnboardingFrame } from './frame';

/**
 * Reading (decision 88): Trim reads what was pasted, with a progress bar while it works, and
 * the found lifts land day by day. Continue goes to Fix when a lift wasn't recognized, else
 * straight on to the finish. Nothing moves on by itself.
 */
export function OnboardingImportRead() {
  const router = useRouter();
  const session = useImportSession();
  const { customExercises } = useWorkoutStore();
  const [name, setName] = useState<string | null>(null);

  const onRead = (match: PlanMatch | null) => {
    if (!match || !session.input) return;
    updateImportSession({ match, name: match.name });
    const lifts = match.days.reduce((sum, day) => sum + day.lifts.length, 0);
    track('plan_import_read', {
      source: session.input.kind === 'images' ? 'screenshots' : 'text',
      screenshots: session.input.kind === 'images' ? session.input.uris.length : 0,
      days: match.days.length,
      lifts,
      unknown: unknownLifts(match).length,
      where: 'onboarding',
    });
  };
  const state = useImportReader(session.input, customExercises, onRead);

  if (!session.input) {
    return <Redirect href="/onboarding/import" />;
  }

  const shownName = name ?? session.name;
  const rename = (value: string) => {
    setName(value);
    updateImportSession({ name: value });
  };

  const next = () => {
    if (state.phase === 'empty') {
      router.back();
      return;
    }
    if (!session.match) return;
    if (unknownLifts(session.match).length > 0) router.push('/onboarding/import-fix');
    else router.push({ pathname: '/onboarding/finish', params: { imported: '1' } });
  };

  return (
    <OnboardingFrame
      action={{
        title: state.phase === 'empty' ? 'Try again' : 'Continue',
        onPress: next,
        disabled: state.phase === 'reading',
        testID: 'import-read-continue',
      }}
      testID="onboarding-import-read">
      <ReadingView state={state} name={shownName} onRename={rename} centered />
    </OnboardingFrame>
  );
}
