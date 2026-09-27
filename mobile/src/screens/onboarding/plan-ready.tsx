import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { planFromStarterTemplate, starterTemplateById, type StarterTemplate } from '@/catalog/templates';
import { setCount } from '@/domain/helpers';
import type { WorkoutDay, WorkoutPlan } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

import { useFinishOnboarding } from './finish';
import { OnboardingFrame } from './frame';
import { joinNames } from './join-names';

/** Step 5: the reveal. The exact plan the user is about to own, then one tap to use it. */
export function OnboardingPlanReady() {
  const params = useLocalSearchParams<{ template?: string }>();
  const template = starterTemplateById(params.template);
  if (!template) {
    return <Redirect href="/onboarding" />;
  }
  return <PlanReady key={template.id} template={template} />;
}

function PlanReady({ template }: { template: StarterTemplate }) {
  const { colors, type } = useTheme();
  // Built once per visit: the plan saved is the plan shown, ids included.
  const [plan] = useState(() => planFromStarterTemplate(template));
  const { finishWithPlan } = useFinishOnboarding();

  return (
    <OnboardingFrame
      action={{ title: 'Use this plan', onPress: () => finishWithPlan(plan), testID: 'onboarding-use-plan' }}
      testID="onboarding-ready">
      <Text accessibilityRole="header" style={type.displayDay} maxFontSizeMultiplier={1.3}>
        {plan.name}
      </Text>
      <Text style={[type.kicker, { color: colors.tertiaryLabel, paddingTop: 4 }]}>{planMeta(plan)}</Text>
      <View style={{ paddingTop: 28, gap: 28 }}>
        {plan.days.map((day, index) => (
          <ReadyDay key={day.id} day={day} index={index} />
        ))}
      </View>
      <Text style={[type.kicker, { color: colors.tertiaryLabel, paddingTop: 28 }]}>
        Change anything later in Plans.
      </Text>
    </OnboardingFrame>
  );
}

/** Plan-detail day row, read-only and never truncated: the reveal shows the whole plan. */
function ReadyDay({ day, index }: { day: WorkoutDay; index: number }) {
  const { colors, type } = useTheme();
  const names = day.exercises.map((exercise) => exercise.name);
  return (
    <View
      accessible
      accessibilityLabel={`Day ${index + 1}, ${day.title}: ${names.join(', ')}`}
      style={{ gap: 2 }}>
      <Text style={type.row}>{day.title}</Text>
      <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{joinNames(names)}</Text>
    </View>
  );
}

/** Home's estimate: 2.5 minutes a set. */
function dayMinutes(day: WorkoutDay): number {
  return day.exercises.reduce((sum, exercise) => sum + setCount(exercise) * 2.5, 0);
}

function planMeta(plan: WorkoutPlan): string {
  const count = plan.days.length;
  const average = plan.days.reduce((sum, day) => sum + dayMinutes(day), 0) / Math.max(count, 1);
  const minutes = Math.max(5, Math.round(average / 5) * 5);
  return `${count} days · ~${minutes} min each`;
}
