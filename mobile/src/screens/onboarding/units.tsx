import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

import { BigChoice } from './choice';
import { OnboardingFrame } from './frame';
import { space } from '@/constants/theme';

const UNITS = [
  { value: 'kg', label: 'kg', spoken: 'Kilograms' },
  { value: 'lbs', label: 'lbs', spoken: 'Pounds' },
] as const;

/** Step 3: the unit every set is logged in. Preset from the locale; saved on tap. */
export function OnboardingUnits() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { units, setUnits } = useWorkoutStore();

  return (
    <OnboardingFrame
      title="Units"
      action={{ title: 'Continue', onPress: () => router.push('/onboarding/days') }}
      testID="onboarding-units">
      <View accessibilityRole="radiogroup" accessibilityLabel="Units" style={{ paddingTop: space.section }}>
        {UNITS.map((option) => (
          <BigChoice
            key={option.value}
            label={option.label}
            accessibilityLabel={option.spoken}
            selected={units === option.value}
            onSelect={() => setUnits(option.value)}
            style={{ alignSelf: 'flex-start', paddingRight: space.gutter }}
            testID={`onboarding-units-${option.value}`}
          />
        ))}
      </View>
      <Text style={[type.kicker, { color: colors.tertiaryLabel, paddingTop: space.gutter }]}>
        Change it anytime in Settings.
      </Text>
    </OnboardingFrame>
  );
}
