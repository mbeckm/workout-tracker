import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';

import { radius, space } from '@/constants/theme';
import { USER_NAME_MAX_LENGTH } from '@/store/snapshot';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';

import { OnboardingFrame } from './frame';

/** The field's height: the Continue pill's, so the stage's two controls match. */
const FIELD_HEIGHT = 52;

/**
 * Step 2: the name Home greets with. Optional: an empty field continues with no name.
 * Saved on Continue (or Return), so Back keeps it.
 */
export function OnboardingName() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const { userName, setUserName } = useWorkoutStore();
  const [text, setText] = useState(userName);

  const next = () => {
    setUserName(text);
    router.push('/onboarding/units');
  };

  return (
    <OnboardingFrame
      title="What should we call you?"
      action={{ title: 'Continue', onPress: next }}
      testID="onboarding-name">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Name"
        placeholderTextColor={colors.tertiaryLabel}
        autoFocus
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={next}
        maxLength={USER_NAME_MAX_LENGTH}
        selectionColor={colors.brand}
        accessibilityLabel="Name"
        testID="onboarding-name-field"
        // No lineHeight on a TextInput (AGENTS.md): iOS applies it to typed text but not the placeholder.
        style={{
          ...type.body,
          lineHeight: undefined,
          color: colors.label,
          height: FIELD_HEIGHT,
          marginTop: space.section,
          paddingHorizontal: space.inset,
          paddingVertical: 0,
          borderRadius: radius.md,
          backgroundColor: colors.secondarySystemBackground,
        }}
      />
    </OnboardingFrame>
  );
}
