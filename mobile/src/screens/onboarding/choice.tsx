import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontScaleCap, onboardingGeometry, onboardingType, PRESSED_OPACITY, sheetColors, TOUCH_TARGET } from '@/constants/theme';
import { haptics } from '@/device/haptics';

/** The finish-swatch tick: picking an answer is the same small, physical choice. */
export function selectionTick() {
  haptics.swatch();
}

/**
 * A big-type radio on the grid: the chosen value is the hero (64, ink), the others residue
 * (28, muted). Used for units and days a week, where the value itself is the whole answer.
 */
export function BigChoice({
  label,
  accessibilityLabel,
  selected,
  onSelect,
  style,
  testID,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onSelect: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        if (!selected) {
          selectionTick();
          onSelect();
        }
      }}
      testID={testID}
      style={({ pressed }) => [styles.hit, { opacity: pressed && !selected ? PRESSED_OPACITY : 1 }, style]}>
      {/* Every cell keeps the hero's height, so the baseline never moves. */}
      <View style={styles.box}>
        <Text
          maxFontSizeMultiplier={fontScaleCap.display}
          style={[
            selected ? onboardingType.choice : [onboardingType.choiceResidue, styles.residue],
            styles.tabular,
          ]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET, alignItems: 'center', justifyContent: 'flex-end' },
  box: { height: onboardingGeometry.choiceHeight, justifyContent: 'flex-end' },
  residue: { color: sheetColors.muted, paddingBottom: onboardingGeometry.choiceResidueDrop },
  tabular: { fontVariant: ['tabular-nums'] },
});
