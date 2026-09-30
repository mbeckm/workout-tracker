import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { KeyboardStickyView } from '@/keyboard';
import { useTheme } from '@/theme/theme-context';
import { iconSize, PRESSED_OPACITY, space } from '@/constants/theme';

/** SF Symbol on iOS; the matching Material Symbol keeps web QA honest. */
export const SYMBOL_CHECK = { ios: 'checkmark', android: 'check', web: 'check' } as const;
const SYMBOL_BACK = { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' } as const;

/**
 * One onboarding step: Back (except on Welcome), a scrollable stage on the 24pt grid,
 * and the black Continue pill at the thumb.
 */
export function OnboardingFrame({
  title,
  back = true,
  centered = false,
  action,
  children,
  testID,
}: {
  /** The step's question. Rendered as the screen's header for VoiceOver. */
  title?: string;
  back?: boolean;
  /** Welcome only: the stage sits in the optical middle instead of under a title. */
  centered?: boolean;
  action: { title: string; onPress: () => void; testID?: string };
  children: ReactNode;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: colors.systemBackground,
        paddingTop: insets.top + 16,
      }}>
      <View style={{ paddingHorizontal: space.gutter, minHeight: 44, justifyContent: 'center' }}>
        {back ? <OnboardingBack onPress={() => router.back()} /> : null}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space.gutter,
          paddingTop: centered ? 0 : 12,
          paddingBottom: space.gutter,
          justifyContent: centered ? 'center' : 'flex-start',
        }}>
        {title ? (
          <Text accessibilityRole="header" style={type.displayCompact} maxFontSizeMultiplier={1.4}>
            {title}
          </Text>
        ) : null}
        {children}
      </ScrollView>
      {/* Rides the keyboard on a step with a field (Name), so Continue stays at the thumb. */}
      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
        style={{
          paddingHorizontal: space.gutter,
          paddingTop: space.related,
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: colors.systemBackground,
        }}>
        <Button
          title={action.title}
          variant="black"
          onPress={action.onPress}
          testID={action.testID ?? 'onboarding-continue'}
        />
      </KeyboardStickyView>
    </View>
  );
}

function OnboardingBack({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      testID="onboarding-back"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        minHeight: 44,
        minWidth: 44,
        justifyContent: 'center',
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <SymbolView name={SYMBOL_BACK} tintColor={colors.label} size={iconSize.control} weight="medium" />
    </Pressable>
  );
}
