import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/theme';
import { useWorkoutStore } from '@/store/workout-store';

import { BigChoice } from './choice';
import { OnboardingFrame } from './frame';

const UNITS = [
  { value: 'kg', label: 'kg', spoken: 'Kilograms' },
  { value: 'lbs', label: 'lbs', spoken: 'Pounds' },
] as const;

/** Step 3: the unit every set is logged in. Preset from the locale; saved on tap. */
export function OnboardingUnits() {
  const router = useRouter();
  const { units, setUnits } = useWorkoutStore();

  return (
    <OnboardingFrame
      title="Units"
      action={{ title: 'Continue', onPress: () => router.push('/onboarding/days') }}
      testID="onboarding-units">
      <View accessibilityRole="radiogroup" accessibilityLabel="Units" style={styles.row}>
        {UNITS.map((option) => (
          <BigChoice
            key={option.value}
            label={option.label}
            accessibilityLabel={option.spoken}
            selected={units === option.value}
            onSelect={() => setUnits(option.value)}
            testID={`onboarding-units-${option.value}`}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: space.section,
    paddingTop: space.pause,
  },
});
