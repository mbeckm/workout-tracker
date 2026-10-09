import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onboardingGeometry as G, space } from '@/constants/theme';
import { ImportArt, useArtClock } from '@/screens/plan-import/import-art';
import { ImportButtons, importButtonReach } from '@/screens/plan-import/import-buttons';
import { startImport, type ImportInput } from '@/screens/plan-import/session';

import { OnboardingFrame } from './frame';

/** Copy that says what can come in; this one screen explains itself in words (decision 88). */
export const IMPORT_SUB =
  'Copy and paste your plan from ChatGPT or Notes, or paste screenshots from another workout app.';

/**
 * Import plan (decision 88): the illustration loops the two ways in, and its two buttons are
 * the screen's actions. Either one starts a new import and goes on to reading.
 */
export function OnboardingImport() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useArtClock();

  const onInput = (input: ImportInput) => {
    startImport(input);
    router.push('/onboarding/import-read');
  };

  return (
    <OnboardingFrame title="Import plan" sub={IMPORT_SUB} scroll={false} testID="onboarding-import">
      <View style={[styles.stage, { paddingBottom: Math.max(insets.bottom, space.inline) }]}>
        <ImportArt t={t} reach={importButtonReach(G.ctaHeight, space.section)} />
        <ImportButtons t={t} pillHeight={G.ctaHeight} onInput={onInput} />
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, gap: space.section, paddingTop: space.gutter },
});
