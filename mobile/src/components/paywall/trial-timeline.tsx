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

/** Home week-dot language: ink for now, grey for later, one thin rail between. */
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
            <View style={{ width: 10, alignItems: 'center' }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  marginTop: 6,
                  backgroundColor: step.now ? colors.label : colors.systemGray4,
                }}
              />
              {last ? null : (
                <View style={{ flex: 1, width: 2, marginVertical: 4, backgroundColor: colors.systemGray5 }} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2, paddingBottom: last ? 0 : 20 }}>
              <Text style={[type.row, { fontWeight: '600' }]}>{step.when}</Text>
              <Text style={[type.kicker, { fontVariant: ['tabular-nums'] }]}>{step.what}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
