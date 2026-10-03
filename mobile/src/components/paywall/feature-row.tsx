import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { fontScaleCap, lcd, onboardingType, paywallGeometry as geo } from '@/constants/theme';
import { DEVICE } from '@/motion';

/**
 * What the buyer gets (trim-ui §12 rule 8): a title and one line. Each row leads with a display
 * lamp that lights, one after another, once the knob reaches PRO (`turned`), like the rocker's
 * lamps when a plan loads. Lamps, not checkmark bullets.
 */
export function FeatureRow({
  title,
  detail,
  order,
  turned,
}: {
  title: string;
  detail: string;
  order: number;
  turned: SharedValue<number>;
}) {
  const on = useSharedValue(0);
  // Already turned (Reduce Motion, a re-render): lit at once.
  useEffect(() => {
    if (turned.get() === 1) {
      on.set(1);
    }
  }, [on, turned]);
  useAnimatedReaction(
    () => turned.get(),
    (value, previous) => {
      if (value === 1 && previous !== 1) {
        on.set(withDelay(order * DEVICE.KNOB_LAMP_STAGGER, withTiming(1, { duration: DEVICE.SNAP })));
      }
    },
  );
  const litStyle = useAnimatedStyle(() => ({ opacity: on.get() }));

  return (
    <View accessible accessibilityLabel={`${title}. ${detail}`} style={styles.row}>
      <View style={styles.lamp}>
        <Animated.View style={[styles.lit, litStyle]} />
      </View>
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={onboardingType.featureTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={onboardingType.featureDetail}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: geo.featureGap + geo.featureLamp / 2 },
  lamp: {
    marginTop: geo.featureLampTop,
    width: geo.featureLamp,
    height: geo.featureLamp,
    borderRadius: geo.featureLamp / 2,
    backgroundColor: lcd.amberOff,
  },
  lit: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: geo.featureLamp / 2,
    backgroundColor: lcd.amber,
    boxShadow: `0 0 6px ${lcd.amberGlow}`,
  },
  text: { flex: 1, minWidth: 0 },
});
