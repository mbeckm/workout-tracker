import { Pressable, Text, View } from 'react-native';

import { radius } from '@/constants/theme';
import { billedPerPeriod, type ProOffer } from '@/purchases/offers';
import { useTheme } from '@/theme/theme-context';

const NBSP = '\u00A0';

/** Keeps one fact on one line; the caption wraps between facts, never inside one. */
function unbroken(text: string): string {
  return text.replace(/ /g, NBSP);
}

/**
 * "$3.33 a month", "Save 52%": price math only, each shown only when the store backs it.
 * The trial lives in the timeline, the button and the note under it, not here.
 */
export function planOptionFacts(offer: ProOffer): string[] {
  return [
    offer.pricePerMonthString && offer.id === 'annual' ? `${offer.pricePerMonthString} a month` : null,
    offer.savingsPercent ? `Save ${offer.savingsPercent}%` : null,
  ]
    .filter((fact): fact is string => fact != null)
    .map(unbroken);
}

/**
 * One plan in the picker. A radio: the selected row gets the house focus
 * treatment (plain ground, 2pt ink ring); the others sit on the grouped fill.
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
  const { colors, type } = useTheme();
  const billed = billedPerPeriod(offer);
  const facts = planOptionFacts(offer);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={[offer.label, billed, ...facts].join(', ').replace(/\u00A0/g, ' ')}
      testID={`paywall-option-${offer.id}`}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 2,
        borderColor: selected ? colors.label : 'transparent',
        backgroundColor: selected ? colors.systemBackground : colors.secondarySystemBackground,
        opacity: pressed && !selected ? 0.7 : 1,
      })}>
      <RadioMark selected={selected} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            columnGap: 12,
          }}>
          <Text style={[type.row, { fontWeight: '600' }]}>{offer.label}</Text>
          <Text style={[type.row, { fontWeight: '600', fontVariant: ['tabular-nums'] }]}>{billed}</Text>
        </View>
        {facts.length > 0 ? (
          <Text style={[type.kicker, { fontVariant: ['tabular-nums'] }]}>{facts.join(' · ')}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Drawn, not a symbol, so it renders the same on web previews. */
function RadioMark({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: selected ? 0 : 2,
        borderColor: colors.systemGray4,
        backgroundColor: selected ? colors.label : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {selected ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onLabel }} />
      ) : null}
    </View>
  );
}

/** Same footprint as a loaded option, so prices land without moving the page. */
export function PlanOptionPlaceholder({ tall }: { tall?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        minHeight: tall ? 76 : 56,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: colors.secondarySystemBackground,
      }}
    />
  );
}
