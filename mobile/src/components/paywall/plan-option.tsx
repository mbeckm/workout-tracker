import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontScaleCap, onboardingType, packColors, paywallColors, paywallGeometry as geo, sheetColors, signal, space } from '@/constants/theme';
import { billedPerPeriod, freeTrial, type ProOffer } from '@/purchases/offers';

/**
 * "$3.33 a month", "save 52%": price math only, each shown only when the store backs it.
 */
export function planOptionFacts(offer: ProOffer): { saving: string | null; perMonth: string | null } {
  return {
    saving: offer.savingsPercent ? `save ${offer.savingsPercent}%` : null,
    perMonth: offer.pricePerMonthString && offer.id === 'annual' ? `${offer.pricePerMonthString} a month` : null,
  };
}

/** The line under the price (N9): the free trial, then the price math, joined the way a person says it. */
export function planOptionSub(offer: ProOffer): string | null {
  const trial = freeTrial(offer);
  const { saving, perMonth } = planOptionFacts(offer);
  const parts = [trial ? `free for ${trial.length}` : null, perMonth, saving].filter((part): part is string => part != null);
  if (parts.length === 0) {
    return null;
  }
  const line = parts.join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * One plan as a pill card (N9 `.plan`, D13): the period it renews on (`Yearly`, from the store's
 * package, App Review 3.1.2), the billed price with its period, the facts under it. A radio: the selected card wears a 3pt orange ring, the other a quiet 2pt ring.
 */
export function PlanOption({
  offer,
  selected,
  disabled,
  onSelect,
}: {
  offer: ProOffer;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const billed = billedPerPeriod(offer);
  const sub = planOptionSub(offer);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={[offer.label, billed, sub].filter(Boolean).join(', ')}
      testID={`paywall-option-${offer.id}`}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => [styles.card, selected ? styles.on : styles.off, pressed && !selected && styles.pressed]}>
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={onboardingType.planLabel}>
          {offer.label}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[onboardingType.planPrice, styles.tabular]}>
          {billed}
        </Text>
        {sub ? (
          <Text maxFontSizeMultiplier={fontScaleCap.text} style={[onboardingType.planSub, styles.tabular]}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Same footprint as a loaded card, so prices land without moving the page. */
export function PlanOptionPlaceholder() {
  return <View style={[styles.card, styles.off]} />;
}

const styles = StyleSheet.create({
  card: {
    minHeight: geo.planHeight,
    borderRadius: geo.planRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.card,
    paddingHorizontal: geo.planPadX,
    paddingVertical: space.inline,
    justifyContent: 'center',
  },
  on: { boxShadow: `inset 0 0 0 ${geo.planRingOn}px ${signal.orange}` },
  off: { boxShadow: `inset 0 0 0 ${geo.planRing}px ${paywallColors.planRing}` },
  pressed: { backgroundColor: packColors.pack },
  text: { gap: space.pair },
  tabular: { fontVariant: ['tabular-nums'] },
});
