import { Redirect, useRouter } from 'expo-router';

import { allFixed, FixView, unknownLifts } from '@/screens/plan-import/fix-view';
import { updateImportSession, useImportSession } from '@/screens/plan-import/session';
import { useKeyboardVisible } from '@/screens/plan-import/use-keyboard-visible';
import { useWorkoutStore } from '@/store/workout-store';

import { OnboardingFrame } from './frame';

export const FIX_SUB = 'Trim couldn’t recognize all exercises. Replace them with alternatives, or create custom ones.';

/** `Fix 2 lifts`, counting down as they're answered; `All set` when none are left. */
export function fixTitle(left: number): string {
  return left === 0 ? 'All set' : `Fix ${left} ${left === 1 ? 'lift' : 'lifts'}`;
}

/**
 * Fix (decision 88): each lift Trim couldn't recognize gets an answer before the plan loads.
 * Continue waits until every one has one; Trim never decides for the owner.
 */
export function OnboardingImportFix() {
  const router = useRouter();
  const session = useImportSession();
  const { customExercises, saveCustomExercise } = useWorkoutStore();
  const typing = useKeyboardVisible();
  if (!session.match) {
    return <Redirect href="/onboarding/import" />;
  }
  const match = session.match;
  const left = unknownLifts(match).filter((item) => !session.fixes.has(item.key)).length;

  return (
    <OnboardingFrame
      title={fixTitle(left)}
      sub={FIX_SUB}
      action={typing ? undefined : {
        title: 'Continue',
        disabled: !allFixed(match, session.fixes),
        onPress: () => router.push({ pathname: '/onboarding/finish', params: { imported: '1' } }),
        testID: 'import-fix-continue',
      }}
      testID="onboarding-import-fix">
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
    </OnboardingFrame>
  );
}
