import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { billedPerPeriod, type FreeTrial, type ProOffer } from '@/purchases/offers';
import { useTheme } from '@/theme/theme-context';

type Step = { when: string; what: string; now: boolean };

/** The two facts of a free trial, from the store's intro offer. No reminder is promised: none is sent. */
export function trialSteps(offer: ProOffer, trial: FreeTrial): Step[] {
  return [
    { when: 'Today', what: 'Full access to Trim Pro.', now: true },
    {
      when: trial.days != null ? `Day ${trial.days}` : `In ${trial.length}`,
      what: `${billedPerPeriod(offer)}, charged unless you cancel before then.`,
      now: false,
    },
  ];
}

const NODE = 26;

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
            style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ width: NODE, alignItems: 'center' }}>
              <View
                style={{
                  width: NODE,
                  height: NODE,
                  borderRadius: NODE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: step.now ? colors.label : colors.systemGray5,
                }}>
                <SymbolView
                  name={step.now ? 'lock.open.fill' : 'creditcard.fill'}
                  size={12}
                  weight="semibold"
                  tintColor={step.now ? colors.onLabel : colors.secondaryLabel}
                />
              </View>
              {last ? null : (
                <View style={{ flex: 1, width: 2, marginVertical: 3, backgroundColor: colors.systemGray5 }} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 1, paddingTop: 3, paddingBottom: last ? 0 : 16 }}>
              <Text style={[type.kicker, { color: colors.label, fontWeight: '600' }]}>{step.when}</Text>
              <Text style={[type.kicker, { fontVariant: ['tabular-nums'] }]}>{step.what}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
