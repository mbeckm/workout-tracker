import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { billedPerPeriod, type FreeTrial, type ProOffer } from '@/purchases/offers';
import { iconSize, space } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

type Step = { when: string; what: string; now: boolean };

/** The two facts of a free trial, from the store's intro offer. No reminder is promised: none is sent. */
export function trialSteps(offer: ProOffer, trial: FreeTrial): Step[] {
  return [
    { when: 'Today', what: 'Full access to Trim Pro.', now: true },
    {
      when: trial.days != null ? `Day ${trial.days}` : `In ${trial.length}`,
      what: `Charged ${billedPerPeriod(offer)} unless you cancel.`,
      now: false,
    },
  ];
}

const NODE = 28;
/** Same lane as the paywall's 36pt feature tiles, so every text edge on the page lines up. */
const LANE = 36;

/**
 * Home week-dot language, with a glyph in each node: ink for now (unlocked), grey for
 * later (the charge). One thin rail between. Compact, so it sits above the fold.
 */
export function TrialTimeline({ offer, trial }: { offer: ProOffer; trial: FreeTrial }) {
  const { colors, type } = useTheme();
  const steps = trialSteps(offer, trial);

  return (
    <View testID="paywall-trial-timeline">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <View
            key={step.when}
            accessible
            accessibilityLabel={`${step.when}: ${step.what}`}
            style={{ flexDirection: 'row', gap: space.inline }}>
            <View style={{ width: LANE, alignItems: 'center' }}>
              <View
                style={{
                  width: NODE,
                  height: NODE,
                  borderRadius: NODE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: step.now ? colors.brand : colors.systemGray5,
                }}>
                <SymbolView
                  name={step.now ? 'lock.open.fill' : 'creditcard.fill'}
                  size={iconSize.caption}
                  weight="semibold"
                  tintColor={step.now ? colors.onBrand : colors.secondaryLabel}
                />
              </View>
              {last ? null : (
                <View style={{ flex: 1, width: 2, marginVertical: space.tight, backgroundColor: colors.systemGray5 }} />
              )}
            </View>
            {/* `tight` centres the first 20pt line on the 28pt node. */}
            <View
              style={{
                flex: 1,
                minWidth: 0,
                gap: space.pair,
                paddingTop: space.tight,
                paddingBottom: last ? 0 : space.inset,
              }}>
              <Text style={[type.caption, { color: colors.label }]}>{step.when}</Text>
              <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>{step.what}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
