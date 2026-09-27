import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { isStarterDayCount, starterTemplatesForDays, type StarterTemplate } from '@/catalog/templates';
import { radius } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

import { selectionTick } from './choice';
import { useFinishOnboarding } from './finish';
import { OnboardingFrame, SYMBOL_CHECK } from './frame';
import { joinNames } from './join-names';

const BUILD_OWN = 'build-own';

/** Step 4: a ready plan for the chosen days, or build one from empty days. */
export function OnboardingPickPlan() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ days?: string }>();
  const days = Number(params.days);
  const templates = isStarterDayCount(days) ? starterTemplatesForDays(days) : [];
  const [choice, setChoice] = useState<string>(templates[0]?.id ?? BUILD_OWN);
  const { finishBuildingOwn } = useFinishOnboarding();

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
    if (choice === BUILD_OWN) {
      finishBuildingOwn(days);
      return;
    }
    router.push({ pathname: '/onboarding/ready', params: { template: choice } });
  };

  return (
    <OnboardingFrame title="Pick a plan" action={{ title: 'Continue', onPress: next }} testID="onboarding-plan">
      <View accessibilityRole="radiogroup" accessibilityLabel="Plans" style={{ paddingTop: 28, gap: 8 }}>
        <View
          style={{
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.secondarySystemBackground,
            overflow: 'hidden',
          }}>
          {templates.map((template, index) => (
            <PlanOption
              key={template.id}
              title={template.name}
              meta={templateMeta(template)}
              selected={choice === template.id}
              separator={index > 0}
              onSelect={() => select(template.id)}
              testID={`onboarding-template-${template.id}`}
            />
          ))}
        </View>
        <PlanOption
          title="Build my own"
          meta={`${days} empty days. You add the exercises.`}
          selected={choice === BUILD_OWN}
          onSelect={() => select(BUILD_OWN)}
          testID="onboarding-build-own"
        />
      </View>
    </OnboardingFrame>
  );
}

function templateMeta(template: StarterTemplate): string {
  return joinNames(template.days.map((day) => day.title));
}

function PlanOption({
  title,
  meta,
  selected,
  separator = false,
  onSelect,
  testID,
}: {
  title: string;
  meta: string;
  selected: boolean;
  separator?: boolean;
  onSelect: () => void;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${meta}`}
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      testID={testID}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.systemGray5 : 'transparent',
      })}>
      <View
        style={{
          marginHorizontal: 16,
          minHeight: 44,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderTopWidth: separator ? 0.5 : 0,
          borderTopColor: colors.separator,
        }}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text style={type.row}>{title}</Text>
          <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={3}>
            {meta}
          </Text>
        </View>
        <View style={{ width: 22, alignItems: 'center', flexShrink: 0 }}>
          {selected ? (
            <SymbolView name={SYMBOL_CHECK} tintColor={colors.label} size={20} weight="semibold" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
