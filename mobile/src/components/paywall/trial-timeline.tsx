import { StyleSheet, Text, View } from 'react-native';

import { fontScaleCap, lcd, onboardingType, paywallGeometry as geo, sheetColors, space } from '@/constants/theme';
import { billedPerPeriod, type FreeTrial, type ProOffer } from '@/purchases/offers';

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

/**
 * The trial as a timeline (trim-ui §12 rule 11): today, lit like a lamp, then the charge day on
 * a thin rail. One line each, so it sits above the fold with the CTA.
 */
export function TrialTimeline({ offer, trial }: { offer: ProOffer; trial: FreeTrial }) {
  const steps = trialSteps(offer, trial);
  return (
    <View testID="paywall-trial-timeline">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <View key={step.when} accessible accessibilityLabel={`${step.when}: ${step.what}`} style={styles.step}>
            <View style={styles.lane}>
              <View style={[styles.node, step.now ? styles.nodeNow : styles.nodeLater]} />
              {last ? null : <View style={styles.rail} />}
            </View>
            <Text maxFontSizeMultiplier={fontScaleCap.text} style={[onboardingType.featureDetail, styles.line, last ? null : styles.gap]}>
              <Text style={styles.when}>{`${step.when}  `}</Text>
              {step.what}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const NODE = geo.featureLamp;

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: geo.featureGap + NODE / 2 },
  lane: { width: NODE, alignItems: 'center' },
  node: { marginTop: geo.featureLampTop, width: NODE, height: NODE, borderRadius: NODE / 2 },
  nodeNow: { backgroundColor: lcd.amber, boxShadow: `0 0 6px ${lcd.amberGlow}` },
  nodeLater: { borderWidth: geo.nodeRail, borderColor: sheetColors.muted },
  rail: { flex: 1, width: geo.nodeRail, marginVertical: space.tight, backgroundColor: sheetColors.rule },
  line: { flex: 1, minWidth: 0, fontVariant: ['tabular-nums'] },
  gap: { paddingBottom: space.related },
  when: { color: sheetColors.ink },
});
