import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  isStarterDayCount,
  planFromStarterTemplate,
  starterTemplatesForDays,
  type StarterTemplate,
} from '@/catalog/templates';
import { onboardingGeometry, space } from '@/constants/theme';
import { estimateDayMinutes, formatEstimateMinutes } from '@/domain/day-facts';

import { selectionTick } from './choice';
import { OnboardingFrame } from './frame';
import { joinNames } from './join-names';
import { cartridgeLabel, PlanPack } from './pack';

export const BUILD_OWN = 'build-own';

/**
 * Step 5 (PB1): the starter plans for the chosen days as packs of cartridges, one per day, and
 * Build my own as the empty pack. Continue goes on to the finish; the plan loads after it.
 */
export function OnboardingPickPlan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ days?: string }>();
  const days = Number(params.days);
  const templates = useMemo(() => (isStarterDayCount(days) ? starterTemplatesForDays(days) : []), [days]);
  const [choice, setChoice] = useState<string>(templates[0]?.id ?? BUILD_OWN);

  if (!isStarterDayCount(days)) {
    return <Redirect href="/onboarding/days" />;
  }

  const select = (id: string) => {
    if (id !== choice) {
      selectionTick();
      setChoice(id);
    }
  };

  const next = () => {
    router.push({
      pathname: '/onboarding/finish',
      params: choice === BUILD_OWN ? { days: String(days), own: '1' } : { days: String(days), template: choice },
    });
  };

  return (
    <OnboardingFrame
      title="Pick a plan"
      sub={`${days} days a week`}
      action={{ title: 'Continue', onPress: next }}
      testID="onboarding-plan">
      <View accessibilityRole="radiogroup" accessibilityLabel="Plans" style={styles.packs}>
        {templates.map((template) => (
          <TemplatePack
            key={template.id}
            template={template}
            selected={choice === template.id}
            onSelect={() => select(template.id)}
          />
        ))}
        <PlanPack
          title="Build my own"
          sub={`${days} empty days`}
          carts={Array.from({ length: days }, () => null)}
          selected={choice === BUILD_OWN}
          onSelect={() => select(BUILD_OWN)}
          accessibilityLabel={`Build my own, ${days} empty days`}
          testID="onboarding-build-own"
        />
      </View>
    </OnboardingFrame>
  );
}

function TemplatePack({
  template,
  selected,
  onSelect,
}: {
  template: StarterTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const minutes = useMemo(() => {
    const plan = planFromStarterTemplate(template);
    const each = plan.days.map((day) => estimateDayMinutes(plan, day, []) ?? 0);
    const average = each.reduce((sum, value) => sum + value, 0) / Math.max(1, each.length);
    return Math.max(5, Math.round(average / 5) * 5);
  }, [template]);
  const sub = `${formatEstimateMinutes(minutes)} a day`;
  const titles = template.days.map((day) => day.title);

  return (
    <PlanPack
      title={template.name}
      sub={sub}
      carts={titles.map(cartridgeLabel)}
      selected={selected}
      onSelect={onSelect}
      accessibilityLabel={`${template.name}, ${joinNames(titles)}, about ${minutes} minutes a day`}
      testID={`onboarding-template-${template.id}`}
    />
  );
}

const styles = StyleSheet.create({
  packs: { gap: onboardingGeometry.packGap, paddingTop: space.gutter },
});
