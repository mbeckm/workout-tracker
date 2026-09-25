import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { paywallPreviewLoader } from '@/components/paywall/dev-preview';
import { PlanOption, PlanOptionPlaceholder } from '@/components/paywall/plan-option';
import { TrialTimeline } from '@/components/paywall/trial-timeline';
import { billedPerPeriod } from '@/purchases/offers';
import { proFeaturesFor } from '@/purchases/pro-features';
import type { ProReason } from '@/purchases/pro-gate';
import { usePaywallController, type PaywallController } from '@/purchases/use-paywall-controller';
import { useTheme } from '@/theme/theme-context';

/** What happened, or what they tried to do. Facts; no hype. */
const REASON_COPY: Record<ProReason, { headline: string; lead: string }> = {
  onboarding: { headline: 'Your plan is ready.', lead: 'Logging stays free. Trim Pro adds more.' },
  post_workout: { headline: 'First workout logged.', lead: 'Logging stays free. Trim Pro adds more.' },
  second_plan: { headline: 'Add another plan.', lead: 'More than one plan is part of Trim Pro.' },
  switch_plan: { headline: 'Switch plans.', lead: 'Switching plans is part of Trim Pro.' },
  progress_history: { headline: 'See all of your progress.', lead: 'Older progress is part of Trim Pro.' },
  body_trends: { headline: 'See your body trends.', lead: 'Body trends are part of Trim Pro.' },
  targets: { headline: 'See a target for every set.', lead: 'Targets are part of Trim Pro.' },
  settings: { headline: 'Trim Pro', lead: 'Logging stays free. Pro adds more.' },
};

export function PaywallScreen({ reason, session }: { reason: ProReason; session?: string }) {
  // Development only: `?mock=trial|notrial|unavailable|offline|loading` previews without StoreKit.
  const { mock } = useLocalSearchParams<{ mock?: string | string[] }>();
  const paywall = usePaywallController(reason, session, { loadOffers: paywallPreviewLoader(mock) });
  return <PaywallView paywall={paywall} />;
}

function PaywallView({ paywall }: { paywall: PaywallController }) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  // Hairline over the footer only while content continues beneath it.
  const [contentBelow, setContentBelow] = useState(false);
  const scrollMetrics = useRef({ offset: 0, viewport: 0, content: 0 });
  const updateEdge = (next: Partial<typeof scrollMetrics.current>) => {
    const metrics = { ...scrollMetrics.current, ...next };
    scrollMetrics.current = metrics;
    setContentBelow(metrics.viewport > 0 && metrics.offset + metrics.viewport < metrics.content - 1);
  };

  const copy = REASON_COPY[paywall.reason];
  const features = proFeaturesFor(paywall.reason);
  const busy = paywall.busy !== null;
  const { load, selected, trial } = paywall;
  const failed = paywall.loadError != null;

  const select = (offer: (typeof paywall.offers)[number]) => {
    if (offer.id === selected?.id) {
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.selectionAsync();
    }
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

  // Next to the button: what happens to money when it is tapped.
  const ctaNote = selected
    ? trial
      ? `No payment due now. Then ${billedPerPeriod(selected)}.`
      : `${billedPerPeriod(selected)}. Cancel anytime.`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
      <Stack.Screen options={{ headerShown: false, title: 'Trim Pro' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={32}
        onLayout={(event) => updateEdge({ viewport: event.nativeEvent.layout.height })}
        onContentSizeChange={(_, height) => updateEdge({ content: height })}
        onScroll={(event) => updateEdge({ offset: event.nativeEvent.contentOffset.y })}
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 32,
        }}>
        <View style={{ gap: 8 }}>
          <Text style={type.largeTitle} accessibilityRole="header" testID="paywall-headline">
            {copy.headline}
          </Text>
          <Text style={[type.body, { color: colors.secondaryLabel }]}>{copy.lead}</Text>
        </View>

        <View style={{ gap: 16 }} testID="paywall-features">
          {features.map((feature) => (
            <View key={feature.id} accessible style={{ gap: 2 }}>
              <Text style={[type.row, { fontWeight: '600' }]}>{feature.title}</Text>
              <Text style={type.kicker}>{feature.detail}</Text>
            </View>
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
      </ScrollView>

      <View
        style={{
          paddingTop: 12,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: contentBelow ? 0.5 : 0,
          borderTopColor: colors.separator,
          backgroundColor: colors.systemBackground,
        }}>
        {paywall.message ? (
          <Text
            style={[type.kicker, { textAlign: 'center', paddingBottom: 12 }]}
            accessibilityLiveRegion="polite"
            testID="paywall-message">
            {paywall.message}
          </Text>
        ) : null}

        <Button
          title={ctaTitle}
          variant="black"
          testID="paywall-cta"
          disabled={failed ? load.status === 'loading' : !paywall.canPurchase}
          onPress={failed ? paywall.retry : paywall.purchase}
        />
        {ctaNote ? (
          <Text
            style={[type.kicker, { textAlign: 'center', paddingTop: 8, fontVariant: ['tabular-nums'] }]}
            testID="paywall-cta-note">
            {ctaNote}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          testID="paywall-not-now"
          disabled={busy}
          onPress={paywall.close}
          style={({ pressed }) => ({
            minHeight: 44,
            marginTop: 4,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.4 : pressed ? 0.55 : 1,
          })}>
          <Text style={[type.body, { color: colors.secondaryLabel }]}>Not now</Text>
        </Pressable>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <FooterLink
            title={paywall.busy === 'restore' ? 'Restoring…' : 'Restore'}
            accessibilityLabel="Restore Purchases"
            onPress={paywall.restore}
            disabled={busy}
          />
          <Dot />
          <FooterLink title="Terms of Use" onPress={paywall.openTerms} />
          <Dot />
          <FooterLink title="Privacy Policy" onPress={paywall.openPrivacy} />
        </View>
      </View>
    </View>
  );
}

function Dot() {
  const { type } = useTheme();
  return (
    <Text style={type.caption} accessible={false} importantForAccessibility="no">
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
      <Text style={type.caption}>{title}</Text>
    </Pressable>
  );
}
