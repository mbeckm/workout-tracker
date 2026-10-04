import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { fontScaleCap, onboardingGeometry, onboardingType, sheetColors, signal, space } from '@/constants/theme';
import { USER_NAME_MAX_LENGTH } from '@/store/snapshot';
import { useWorkoutStore } from '@/store/workout-store';

import { OnboardingFrame } from './frame';

/**
 * Step 2: the name the receipt prints under TRIM (D20). Optional: an empty field continues with
 * no name. Saved on Continue (or Return), so Back keeps it. Dark keyboard, orange cursor; the
 * keyboard rises after the push has landed.
 */
export function OnboardingName() {
  const router = useRouter();
  const { userName, setUserName } = useWorkoutStore();
  const [text, setText] = useState(userName);
  const field = useRef<TextInput>(null);
  const navigation = useNavigation();

  // The keyboard comes up once the push has landed: rising during it, it and the Continue pill
  // riding it fought the transition (feel pass).
  useEffect(
    () =>
      navigation.addListener('transitionEnd' as never, (event: { data?: { closing?: boolean } }) => {
        if (!event.data?.closing) field.current?.focus();
      }),
    [navigation],
  );

  const next = () => {
    setUserName(text);
    router.push('/onboarding/units');
  };

  return (
    <OnboardingFrame title="What should we call you?" action={{ title: 'Continue', onPress: next }} testID="onboarding-name">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Name"
        placeholderTextColor={sheetColors.sectionLabel}
        ref={field}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={next}
        maxLength={USER_NAME_MAX_LENGTH}
        keyboardAppearance="dark"
        // The field keeps a fixed height, so its text stops growing at the title cap.
        maxFontSizeMultiplier={fontScaleCap.title}
        selectionColor={signal.orange}
        accessibilityLabel="Name"
        testID="onboarding-name-field"
        // No lineHeight on a TextInput (AGENTS.md): iOS applies it to typed text but not the placeholder.
        style={[onboardingType.field, styles.field]}
      />
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  field: {
    height: onboardingGeometry.fieldHeight,
    marginTop: space.section,
    paddingHorizontal: onboardingGeometry.fieldPadX,
    paddingVertical: 0,
    borderRadius: onboardingGeometry.fieldRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.card,
    textAlign: 'center',
  },
});
