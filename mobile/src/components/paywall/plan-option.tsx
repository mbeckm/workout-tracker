import { Pressable, Text, View } from 'react-native';

import { PRESSED_OPACITY, radius, space } from '@/constants/theme';
import { billedPerPeriod, type ProOffer } from '@/purchases/offers';
import { useTheme } from '@/theme/theme-context';

const NBSP = '\u00A0';

/** Keeps one fact on one line; the caption wraps between facts, never inside one. */
function unbroken(text: string): string {
  return text.replace(/ /g, NBSP);
}

/**
 * "$3.33 a month", "Save 52%": price math only, each shown only when the store backs it.
 * The trial lives in the timeline, the button and the note under it, not here. No dots
 * (trim-ui §9): the saving takes the leading lane under the name, the monthly equivalent
 * the trailing lane under the price it breaks down.
 */
export function planOptionFacts(offer: ProOffer): { saving: string | null; perMonth: string | null } {
  return {
    saving: offer.savingsPercent ? unbroken(`Save ${offer.savingsPercent}%`) : null,
    perMonth:
      offer.pricePerMonthString && offer.id === 'annual'
        ? unbroken(`${offer.pricePerMonthString} a month`)
        : null,
  };
}

/** Name → price lanes: they wrap under each other at large text sizes. */
const LANES = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  columnGap: space.inline,
} as const;

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
      accessibilityLabel={[offer.label, billed, facts.perMonth, facts.saving]
        .filter(Boolean)
        .join(', ')
        .replace(/\u00A0/g, ' ')}
      testID={`paywall-option-${offer.id}`}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.inline,
        paddingHorizontal: space.inset,
        paddingVertical: space.inset,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 2,
        borderColor: selected ? colors.brand : 'transparent',
        backgroundColor: selected ? colors.systemBackground : colors.secondarySystemBackground,
        opacity: pressed && !selected ? PRESSED_OPACITY : 1,
      })}>
      <RadioMark selected={selected} />
      <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
        <View style={LANES}>
          <Text style={type.row}>{offer.label}</Text>
          <Text style={[type.row, { fontVariant: ['tabular-nums'] }]}>{billed}</Text>
        </View>
        {facts.saving || facts.perMonth ? (
          <View style={LANES}>
            <Text style={type.caption}>{facts.saving ?? ''}</Text>
            <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{facts.perMonth ?? ''}</Text>
          </View>
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
        borderRadius: radius.full,
        borderWidth: selected ? 0 : 2,
        borderColor: colors.systemGray4,
        backgroundColor: selected ? colors.brand : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {selected ? (
        <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.onBrand }} />
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
        // Border 2 + inset 16 on each side, around one `row` line (22) or row + pair + caption (44).
        minHeight: 2 * (2 + space.inset) + (tall ? 44 : 22),
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: colors.secondarySystemBackground,
      }}
    />
  );
}
