import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { paywallPreview } from '@/components/paywall/dev-preview';
import { FeatureRow } from '@/components/paywall/feature-row';
import { KnobHero } from '@/components/paywall/knob';
import { PlanOption, PlanOptionPlaceholder } from '@/components/paywall/plan-option';
import { TrialTimeline } from '@/components/paywall/trial-timeline';
import { useToastBottom } from '@/components/toast';
import {
  device,
  fontScaleCap,
  onboardingType,
  paywallColors,
  paywallGeometry as geo,
  sheetColors,
  space,
  TOUCH_TARGET,
  PRESSED_OPACITY,
} from '@/constants/theme';
import { GridGround } from '@/device/moment/grid-ground';
import { haptics } from '@/device/haptics';
import { PRESS_SCALE } from '@/motion';
import { billedPerPeriod } from '@/purchases/offers';
import { PRO_FEATURES, proFeaturesFor } from '@/purchases/pro-features';
import type { ProReason } from '@/purchases/pro-gate';
import { usePaywallController, type PaywallController } from '@/purchases/use-paywall-controller';

/**
 * What happened, or what they tried to do. Facts; no hype. One line, no subheading: the
 * feature rows under it say what Pro adds, with the gate's own feature first.
 */
const REASON_HEADLINE: Record<ProReason, string> = {
  onboarding: 'Your plan is ready.',
  post_workout: 'First workout logged.',
  second_plan: 'Add another plan with Pro.',
  switch_plan: 'Switch plans with Pro.',
  progress_history: 'See all of your progress.',
  targets: 'Get a target for every set.',
  finishes: 'Every skin, with Pro.',
  settings: 'Trim Pro',
};

export function PaywallScreen({ reason, session }: { reason: ProReason; session?: string }) {
  // Development only: `?mock=trial|notrial|unavailable|offline|loading|none` previews without
  // StoreKit (Subscribe and Restore then succeed locally; `none` restores nothing).
  const { mock } = useLocalSearchParams<{ mock?: string | string[] }>();
  const paywall = usePaywallController(reason, session, { preview: paywallPreview(mock) });
  return <PaywallView paywall={paywall} />;
}

/**
 * The paywall (D13, trim-ui §12 Paywall): a full-screen modal on the dark grid with the knob
 * hero (N9), the reason's headline, one lamp-led row per Pro feature, the plans as pill cards,
 * the trial as a timeline, and the light CTA with what happens to money under it. `Not now` is
 * top right from the first frame; Restore, Terms and Privacy sit under the CTA. All selling
 * logic lives in `usePaywallController`; this only draws it.
 */
function PaywallView({ paywall }: { paywall: PaywallController }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = Boolean(useReducedMotion());
  const [footerHeight, setFooterHeight] = useState(0);
  // The top is the knob's: `No purchases to restore` lands above the footer instead.
  useToastBottom(footerHeight + space.related);
  // 1 once the knob reaches PRO; the feature lamps light from it.
  const turned = useSharedValue(reduceMotion ? 1 : 0);

  const headline = REASON_HEADLINE[paywall.reason];
  const features = proFeaturesFor(paywall.reason, PRO_FEATURES, PRO_FEATURES.length);
  const busy = paywall.busy !== null;
  const { load, selected, trial, message } = paywall;
  const failed = paywall.loadError != null;

  const select = (offer: (typeof paywall.offers)[number]) => {
    if (offer.id === selected?.id) {
      return;
    }
    haptics.swatch();
    paywall.select(offer.id);
  };

  const ctaTitle =
    paywall.busy === 'purchase'
      ? 'Purchasing…'
      : failed
        ? 'Try again'
        : load.status === 'loading'
          ? 'Loading prices…'
          : paywall.ctaTitle;
  const ctaDisabled = failed ? load.status === 'loading' : !paywall.canPurchase;

  // Under the button: what happens to money.
  const ctaNote = selected
    ? trial
      ? `No payment due now. Then ${billedPerPeriod(selected)}.`
      : `${billedPerPeriod(selected)}. Cancel anytime.`
    : null;

  return (
    <View style={styles.root} onAccessibilityEscape={busy ? undefined : paywall.close}>
      <StatusBar style="light" />
      <GridGround />
      <View pointerEvents="none" style={styles.glow} />

      <ScrollView
        style={styles.fill}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.tight }]}>
        <KnobHero turned={turned} />

        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={fontScaleCap.title}
          style={[onboardingType.headline, styles.headline]}
          testID="paywall-headline">
          {headline}
        </Text>

        <View style={styles.features} testID="paywall-features">
          {features.map((feature, index) => (
            <FeatureRow key={feature.id} title={feature.title} detail={feature.detail} order={index} turned={turned} />
          ))}
        </View>

        <View style={styles.prices}>
          {load.status === 'loading' ? (
            <View accessible accessibilityLabel="Loading prices" accessibilityRole="progressbar" style={styles.plans}>
              <PlanOptionPlaceholder />
              <PlanOptionPlaceholder />
            </View>
          ) : null}

          {failed ? (
            <Text maxFontSizeMultiplier={fontScaleCap.text} style={[onboardingType.note, styles.error]} accessibilityLiveRegion="polite">
              {paywall.loadError}
            </Text>
          ) : null}

          {paywall.offers.length > 0 ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Subscription" style={styles.plans}>
              {paywall.offers.map((offer) => (
                <PlanOption
                  key={offer.id}
                  offer={offer}
                  selected={offer.id === selected?.id}
                  disabled={busy}
                  onSelect={() => select(offer)}
                />
              ))}
            </View>
          ) : null}

          {selected && trial ? <TrialTimeline offer={selected} trial={trial} /> : null}
        </View>

        {paywall.termsText ? (
          <Text maxFontSizeMultiplier={fontScaleCap.text} style={[onboardingType.terms, styles.terms]} testID="paywall-terms">
            {paywall.termsText}
          </Text>
        ) : null}
      </ScrollView>

      {/* Leaving is always easy (rule 13): visible from the first frame, never delayed. */}
      <View style={[styles.topBar, { top: insets.top }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={paywall.close}
          hitSlop={space.related}
          testID="paywall-not-now"
          style={({ pressed }) => [styles.notNow, { opacity: busy ? device.keyDisabledOpacity : pressed ? PRESSED_OPACITY : 1 }]}>
          <Text maxFontSizeMultiplier={fontScaleCap.title} style={onboardingType.notNow}>
            Not now
          </Text>
        </Pressable>
      </View>

      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.inline) }]}>
        {message ? (
          <Text
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[onboardingType.note, styles.message, message.error ? styles.error : null]}
            accessibilityLiveRegion="polite"
            testID="paywall-message">
            {message.text}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: ctaDisabled }}
          disabled={ctaDisabled}
          onPress={failed ? paywall.retry : paywall.purchase}
          testID="paywall-cta"
          style={({ pressed }) => [styles.cta, ctaDisabled && styles.ctaDisabled, pressed && styles.ctaPressed]}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={fontScaleCap.title}
            style={[onboardingType.planPrice, ctaDisabled ? styles.ctaInkDisabled : styles.ctaInk]}>
            {ctaTitle}
          </Text>
        </Pressable>
        {ctaNote ? (
          <Text maxFontSizeMultiplier={fontScaleCap.text} style={[onboardingType.note, styles.center, styles.tabular]} testID="paywall-cta-note">
            {ctaNote}
          </Text>
        ) : null}

        {/* Three quiet links separated by air, not dots. Each keeps a 44pt target. */}
        <View style={styles.links}>
          <FooterLink
            title={paywall.busy === 'restore' ? 'Restoring…' : 'Restore'}
            accessibilityLabel="Restore purchases"
            onPress={paywall.restore}
            disabled={busy}
          />
          <FooterLink title="Terms" accessibilityLabel="Terms of Use" onPress={paywall.openTerms} />
          <FooterLink title="Privacy" accessibilityLabel="Privacy Policy" onPress={paywall.openPrivacy} />
        </View>
      </View>
    </View>
  );
}

function FooterLink({
  title,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  title: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
      <Text maxFontSizeMultiplier={fontScaleCap.text} style={onboardingType.link}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sheetColors.sheet },
  fill: { flex: 1 },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '45%',
    experimental_backgroundImage: `radial-gradient(ellipse at 50% 0%, ${paywallColors.glow}, ${paywallColors.glowClear})`,
  },
  content: { paddingHorizontal: geo.gutter, paddingBottom: space.gutter },
  headline: { textAlign: 'center', marginTop: space.inline },
  features: { gap: geo.featureGap, marginTop: space.inset },
  prices: { marginTop: space.inset, gap: space.inline },
  plans: { gap: geo.planGap },
  error: { color: sheetColors.inkSoft },
  terms: { marginTop: space.gutter },
  topBar: {
    position: 'absolute',
    right: geo.gutter,
    height: geo.topBar,
    justifyContent: 'center',
  },
  notNow: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  footer: { paddingHorizontal: geo.gutter, paddingTop: space.related, gap: space.related },
  message: { textAlign: 'center' },
  cta: {
    height: geo.ctaHeight,
    borderRadius: geo.ctaHeight / 2,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.pillLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutter,
  },
  ctaDisabled: { backgroundColor: sheetColors.pillDark },
  ctaPressed: { transform: [{ scale: PRESS_SCALE }] },
  ctaInk: { color: sheetColors.pillLightInk },
  ctaInkDisabled: { color: sheetColors.muted },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space.related },
  link: { minHeight: TOUCH_TARGET, paddingHorizontal: space.related, justifyContent: 'center' },
  linkPressed: { opacity: PRESSED_OPACITY },
});
