import { StyleSheet, View } from 'react-native';

import { gadgetRadius, lcd, space, tourType } from '@/constants/theme';
import { LcdText } from '@/device/parts/lcd-text';

/**
 * Trim's line inside a sheet (decision 85): a tall sheet covers the display, so the tour's line
 * moves into it on a small panel of the machine's screen.
 */
export function TrimSays({ children }: { children: string }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={children} style={styles.panel}>
      <LcdText style={tourType.lcdChat}>{children.toUpperCase()}</LcdText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: space.inline,
    paddingHorizontal: space.inset,
    paddingVertical: space.inline,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    backgroundColor: lcd.lcd,
  },
});
