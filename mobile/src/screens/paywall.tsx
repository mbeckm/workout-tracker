import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { paywallPreviewLoader } from '@/components/paywall/dev-preview';
import { PlanOption, PlanOptionPlaceholder } from '@/components/paywall/plan-option';
import { TrialTimeline } from '@/components/paywall/trial-timeline';
import { billedPerPeriod } from '@/purchases/offers';
import { proFeaturesFor, type ProFeature } from '@/purchases/pro-features';
import type { ProReason } from '@/purchases/pro-gate';
import { usePaywallController, type PaywallController } from '@/purchases/use-paywall-controller';
import { enterUp } from '@/motion';
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
  body_trends: 'See your body trends.',
  targets: 'Get a target for every set.',
  settings: 'Trim Pro',
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
          paddingTop: insets.top + 44,
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 28,
        }}>
        <Text style={type.largeTitle} accessibilityRole="header" testID="paywall-headline">
          {headline}
        </Text>

        <View style={{ gap: 18 }} testID="paywall-features">
          {features.map((feature, index) => (
            <Animated.View
              key={feature.id}
              entering={enterUp(Boolean(reduceMotion), 60 + index * 50)}>
              <FeatureRow feature={feature} />
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
      </ScrollView>

      {/* Solid band under the status bar and Not now, so scrolled copy never runs under
          either. Hairline only while content sits beneath it, like the footer. */}
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

      {/* Always reachable, never hidden or delayed: top right, where a close lives on iOS. */}
      <Pressable
        accessibilityRole="button"
        testID="paywall-not-now"
        disabled={busy}
        onPress={paywall.close}
        hitSlop={8}
        style={({ pressed }) => ({
          position: 'absolute',
          top: insets.top,
          right: 12,
          minHeight: 44,
          paddingHorizontal: 12,
          justifyContent: 'center',
          opacity: busy ? 0.4 : pressed ? 0.55 : 1,
        })}>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>Not now</Text>
      </Pressable>

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
        <View style={{ height: 4 }} />


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

/** Icon tile + title + one line. The tile gives each benefit a scannable anchor. */
function FeatureRow({ feature }: { feature: ProFeature }) {
  const { colors, type } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${feature.title}. ${feature.detail}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondarySystemBackground,
        }}>
        <SymbolView name={feature.symbol as SFSymbol} size={18} weight="semibold" tintColor={colors.label} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={[type.row, { fontWeight: '600' }]}>{feature.title}</Text>
        <Text style={type.kicker}>{feature.detail}</Text>
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
