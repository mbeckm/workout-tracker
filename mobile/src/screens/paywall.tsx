import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { paywallPreview } from '@/components/paywall/dev-preview';
import { FeatureRow } from '@/components/paywall/feature-row';
import { PlanOption, PlanOptionPlaceholder } from '@/components/paywall/plan-option';
import { PaywallSuccessBody, trialLine } from '@/components/paywall/success';
import { TrialTimeline } from '@/components/paywall/trial-timeline';
import { billedPerPeriod } from '@/purchases/offers';
import { proFeaturesFor } from '@/purchases/pro-features';
import type { ProReason } from '@/purchases/pro-gate';
import { usePaywallController, type PaywallController } from '@/purchases/use-paywall-controller';
import { EASE_OUT, enterUp, exitFade } from '@/motion';
import { useTheme } from '@/theme/theme-context';

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
  settings: 'Trim Pro',
};

/**
 * Success CTA: what tapping it resumes. Gates name the action they were holding; the rest
 * just continue where they were.
 */
const REASON_RESUME: Record<ProReason, string> = {
  onboarding: 'Start training',
  post_workout: 'Continue',
  second_plan: 'Add plan',
  switch_plan: 'Use this plan',
  // The gate doesn't know which window was tapped (6M, YTD or All), only that it was one.
  progress_history: 'Show progress',
  targets: 'Use targets',
  settings: 'Continue',
};

const NOTE_FADE = FadeIn.duration(200).easing(EASE_OUT);

/**
 * Dynamic Type cap for the fixed chrome (Not now, the footer's CTA, notes and links). They
 * never scroll, so uncapped at AX sizes they ate ~60% of the screen; the headline, features
 * and terms keep scaling fully in the scroll view above.
 */
const CHROME_TEXT_SCALE = 1.4;

export function PaywallScreen({ reason, session }: { reason: ProReason; session?: string }) {
  // Development only: `?mock=trial|notrial|unavailable|offline|loading` previews without
  // StoreKit (Subscribe and Restore then succeed locally); `?mock=success|success-notrial|restored`
  // opens on the success state.
  const { mock } = useLocalSearchParams<{ mock?: string | string[] }>();
  const paywall = usePaywallController(reason, session, { preview: paywallPreview(mock) });
  return <PaywallView paywall={paywall} />;
}

function PaywallView({ paywall }: { paywall: PaywallController }) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Hairline over the footer only while content continues beneath it.
  const [contentBelow, setContentBelow] = useState(false);
  const [contentAbove, setContentAbove] = useState(false);
  const scrollMetrics = useRef({ offset: 0, viewport: 0, content: 0 });
  const updateEdge = (next: Partial<typeof scrollMetrics.current>) => {
    const metrics = { ...scrollMetrics.current, ...next };
    scrollMetrics.current = metrics;
    setContentBelow(metrics.viewport > 0 && metrics.offset + metrics.viewport < metrics.content - 1);
    setContentAbove(metrics.offset > 1);
  };

  const headline = REASON_HEADLINE[paywall.reason];
  const features = proFeaturesFor(paywall.reason);
  const busy = paywall.busy !== null;
  const { load, selected, trial, success } = paywall;
  const failed = paywall.loadError != null;

  // The success state starts at the top, even if the offer was scrolled to its terms.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (success) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [success]);

  const select = (offer: (typeof paywall.offers)[number]) => {
    if (offer.id === selected?.id) {
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
    paywall.select(offer.id);
  };

  const ctaTitle = success
    ? REASON_RESUME[paywall.reason]
    : paywall.busy === 'purchase'
      ? 'Purchasing…'
      : failed
        ? 'Try again'
        : load.status === 'loading'
          ? 'Loading prices…'
          : paywall.ctaTitle;

  // Under the button: what happens to money. After a purchase, only the trial's end is left.
  const ctaNote = success
    ? trialLine(success)
    : selected
      ? trial
        ? `No payment due now. Then ${billedPerPeriod(selected)}.`
        : `${billedPerPeriod(selected)}. Cancel anytime.`
      : null;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      onAccessibilityEscape={success ? paywall.proceed : busy ? undefined : paywall.close}>
      <Stack.Screen options={{ headerShown: false, title: 'Trim Pro' }} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={32}
        onLayout={(event) => updateEdge({ viewport: event.nativeEvent.layout.height })}
        onContentSizeChange={(_, height) => updateEdge({ content: height })}
        onScroll={(event) => updateEdge({ offset: event.nativeEvent.contentOffset.y })}
        contentContainerStyle={{
          paddingTop: insets.top + 44,
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}>
        {success ? (
          // Same modal, same footer: the offer fades out and the success state rises in its place.
          <PaywallSuccessBody
            key="success"
            success={success}
            features={features}
            reduceMotion={Boolean(reduceMotion)}
          />
        ) : (
          <Animated.View key="offer" exiting={exitFade(Boolean(reduceMotion))} style={{ gap: 28 }}>
            <Text style={type.largeTitle} accessibilityRole="header" testID="paywall-headline">
              {headline}
            </Text>

            <View style={{ gap: 18 }} testID="paywall-features">
              {features.map((feature, index) => (
                <Animated.View
                  key={feature.id}
                  entering={enterUp(Boolean(reduceMotion), 60 + index * 50)}>
                  <FeatureRow title={feature.title} detail={feature.detail} symbol={feature.symbol} />
                </Animated.View>
              ))}
            </View>

            {load.status === 'loading' ? (
              <View
                accessible
                accessibilityLabel="Loading prices"
                accessibilityRole="progressbar"
                style={{ gap: 12 }}>
                <PlanOptionPlaceholder tall />
                <PlanOptionPlaceholder />
              </View>
            ) : null}

            {failed ? (
              <Text style={[type.body, { color: colors.secondaryLabel }]} accessibilityLiveRegion="polite">
                {paywall.loadError}
              </Text>
            ) : null}

            {paywall.offers.length > 0 ? (
              <View accessibilityRole="radiogroup" accessibilityLabel="Subscription" style={{ gap: 12 }}>
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

            {paywall.termsText ? (
              <Text style={[type.caption, { fontWeight: '400' }]} testID="paywall-terms">
                {paywall.termsText}
              </Text>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>

      {/* Solid band under the status bar and Not now, so scrolled copy never runs under
          either. Hairline only while content sits beneath it, like the footer. On the success
          state (no Not now) it only appears once content scrolls, so the check's rings can
          open into the air above it. */}
      {success && !contentAbove ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 44,
            backgroundColor: colors.systemBackground,
            borderBottomWidth: contentAbove ? 0.5 : 0,
            borderBottomColor: colors.separator,
          }}
        />
      )}

      {/* On the offer, always reachable, never hidden or delayed: top right, where a close
          lives on iOS. Gone on the success state, where the one way on is the CTA. */}
      {success ? null : (
        <Animated.View
          exiting={exitFade(Boolean(reduceMotion))}
          style={{ position: 'absolute', top: insets.top, right: 12 }}>
          <Pressable
            accessibilityRole="button"
            testID="paywall-not-now"
            disabled={busy}
            onPress={paywall.close}
            hitSlop={8}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: 12,
              justifyContent: 'center',
              opacity: busy ? 0.4 : pressed ? 0.55 : 1,
            })}>
            <Text
              maxFontSizeMultiplier={CHROME_TEXT_SCALE}
              style={[type.body, { color: colors.secondaryLabel }]}>
              Not now
            </Text>
          </Pressable>
        </Animated.View>
      )}

      <View
        style={{
          paddingTop: 12,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: contentBelow ? 0.5 : 0,
          borderTopColor: colors.separator,
          backgroundColor: colors.systemBackground,
        }}>
        {paywall.message && !success ? (
          <Text
            maxFontSizeMultiplier={CHROME_TEXT_SCALE}
            style={[type.kicker, { textAlign: 'center', paddingBottom: 12 }]}
            accessibilityLiveRegion="polite"
            testID="paywall-message">
            {paywall.message}
          </Text>
        ) : null}

        {/* The one element that stays put through the success transition: same pill, same
            place, new job. Only the label changes. */}
        <Button
          title={ctaTitle}
          variant="black"
          maxFontSizeMultiplier={CHROME_TEXT_SCALE}
          testID={success ? 'paywall-success-cta' : 'paywall-cta'}
          disabled={success ? false : failed ? load.status === 'loading' : !paywall.canPurchase}
          onPress={success ? paywall.proceed : failed ? paywall.retry : paywall.purchase}
        />
        {ctaNote ? (
          <Animated.Text
            key={success ? 'success-note' : 'offer-note'}
            entering={success ? NOTE_FADE : undefined}
            maxFontSizeMultiplier={CHROME_TEXT_SCALE}
            style={[type.kicker, { textAlign: 'center', paddingTop: 8, fontVariant: ['tabular-nums'] }]}
            testID={success ? 'paywall-trial-note' : 'paywall-cta-note'}>
            {ctaNote}
          </Animated.Text>
        ) : success ? (
          // Holds the note's line (at any text size) so the CTA doesn't drop without a trial.
          <Text
            accessible={false}
            importantForAccessibility="no"
            maxFontSizeMultiplier={CHROME_TEXT_SCALE}
            style={[type.kicker, { paddingTop: 8 }]}>
            {' '}
          </Text>
        ) : null}
        <View style={{ height: 4 }} />

        {/* On success the links fade but keep their row, so the CTA stays exactly where the
            buyer's thumb just was. */}
        <Animated.View
          accessibilityElementsHidden={success != null}
          importantForAccessibility={success ? 'no-hide-descendants' : 'auto'}
          pointerEvents={success ? 'none' : 'auto'}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: success ? 0 : 1,
            transitionProperty: 'opacity',
            transitionDuration: reduceMotion ? 120 : 150,
            transitionTimingFunction: 'ease-out',
          }}>
          <FooterLink
            title={paywall.busy === 'restore' ? 'Restoring…' : 'Restore'}
            accessibilityLabel="Restore Purchases"
            onPress={paywall.restore}
            disabled={busy || success != null}
          />
          <Dot />
          <FooterLink title="Terms of Use" onPress={paywall.openTerms} />
          <Dot />
          <FooterLink title="Privacy Policy" onPress={paywall.openPrivacy} />
        </Animated.View>
      </View>
    </View>
  );
}

function Dot() {
  const { type } = useTheme();
  return (
    <Text
      style={type.caption}
      accessible={false}
      importantForAccessibility="no"
      maxFontSizeMultiplier={CHROME_TEXT_SCALE}>
      ·
    </Text>
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
  const { type } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 8,
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
      })}>
      <Text style={type.caption} maxFontSizeMultiplier={CHROME_TEXT_SCALE}>
        {title}
      </Text>
    </Pressable>
  );
}
