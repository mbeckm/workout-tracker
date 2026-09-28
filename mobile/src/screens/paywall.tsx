import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { paywallPreview } from '@/components/paywall/dev-preview';
import { FeatureRow } from '@/components/paywall/feature-row';
import { PlanOption, PlanOptionPlaceholder } from '@/components/paywall/plan-option';
import { TrialTimeline } from '@/components/paywall/trial-timeline';
import { ToastHost } from '@/components/toast';
import { PRESSED_OPACITY, TOUCH_TARGET, fontScaleCap, space } from '@/constants/theme';
import { billedPerPeriod } from '@/purchases/offers';
import { proFeaturesFor } from '@/purchases/pro-features';
import type { ProReason } from '@/purchases/pro-gate';
import { usePaywallController, type PaywallController } from '@/purchases/use-paywall-controller';
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

export function PaywallScreen({ reason, session }: { reason: ProReason; session?: string }) {
  // Development only: `?mock=trial|notrial|unavailable|offline|loading|none` previews without
  // StoreKit (Subscribe and Restore then succeed locally; `none` restores nothing).
  const { mock } = useLocalSearchParams<{ mock?: string | string[] }>();
  const paywall = usePaywallController(reason, session, { preview: paywallPreview(mock) });
  return <PaywallView paywall={paywall} />;
}

function PaywallView({ paywall }: { paywall: PaywallController }) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  // Hairline over the footer only while content continues beneath it.
  const [contentBelow, setContentBelow] = useState(false);
  const [contentAbove, setContentAbove] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
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
  const { load, selected, trial, message } = paywall;
  const failed = paywall.loadError != null;
  /** The bar `Not now` sits in: one touch target tall, under the status bar. */
  const barHeight = insets.top + TOUCH_TARGET;

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

  // Under the button: what happens to money.
  const ctaNote = selected
    ? trial
      ? `No payment due now. Then ${billedPerPeriod(selected)}.`
      : `${billedPerPeriod(selected)}. Cancel anytime.`
    : null;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      onAccessibilityEscape={busy ? undefined : paywall.close}>
      <Stack.Screen options={{ headerShown: false, title: 'Trim Pro' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={32}
        onLayout={(event) => updateEdge({ viewport: event.nativeEvent.layout.height })}
        onContentSizeChange={(_, height) => updateEdge({ content: height })}
        onScroll={(event) => updateEdge({ offset: event.nativeEvent.contentOffset.y })}
        contentContainerStyle={{
          paddingTop: barHeight,
          paddingHorizontal: space.gutter,
          paddingBottom: space.gutter,
          gap: space.section,
        }}>
        <Text
          style={type.displayCompact}
          maxFontSizeMultiplier={fontScaleCap.display}
          accessibilityRole="header"
          testID="paywall-headline">
          {headline}
        </Text>

        <View style={{ gap: space.inset }} testID="paywall-features">
          {features.map((feature) => (
            <FeatureRow key={feature.id} title={feature.title} detail={feature.detail} symbol={feature.symbol} />
          ))}
        </View>

        {/* The price block: options 8 apart, the selected option's trial timeline 16 under them. */}
        <View style={{ gap: space.inset }}>
          {load.status === 'loading' ? (
            <View
              accessible
              accessibilityLabel="Loading prices"
              accessibilityRole="progressbar"
              style={{ gap: space.related }}>
              <PlanOptionPlaceholder tall />
              <PlanOptionPlaceholder />
            </View>
          ) : null}

          {failed ? (
            <Text style={[type.caption, { color: colors.systemRed }]} accessibilityLiveRegion="polite">
              {paywall.loadError}
            </Text>
          ) : null}

          {paywall.offers.length > 0 ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Subscription" style={{ gap: space.related }}>
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
          <Text style={type.footnote} testID="paywall-terms">
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
          height: barHeight,
          backgroundColor: colors.systemBackground,
          borderBottomWidth: contentAbove ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: colors.separator,
        }}
      />

      {/* Always reachable, never hidden or delayed: top right, where a close lives on iOS. */}
      <View style={{ position: 'absolute', top: insets.top, right: space.inline }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          testID="paywall-not-now"
          disabled={busy}
          onPress={paywall.close}
          style={({ pressed }) => ({
            minHeight: TOUCH_TARGET,
            paddingHorizontal: space.inline,
            justifyContent: 'center',
            opacity: pressed ? PRESSED_OPACITY : 1,
          })}>
          <Text
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[type.body, { color: busy ? colors.tertiaryLabel : colors.secondaryLabel }]}>
            Not now
          </Text>
        </Pressable>
      </View>

      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={{
          paddingTop: space.inline,
          paddingHorizontal: space.gutter,
          paddingBottom: Math.max(insets.bottom, space.related),
          borderTopWidth: contentBelow ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.separator,
          backgroundColor: colors.systemBackground,
        }}>
        {message ? (
          <Text
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[
              type.caption,
              { textAlign: 'center', paddingBottom: space.related },
              message.error ? { color: colors.systemRed } : null,
            ]}
            accessibilityLiveRegion="polite"
            testID="paywall-message">
            {message.text}
          </Text>
        ) : null}

        <Button
          title={ctaTitle}
          variant="black"
          maxFontSizeMultiplier={fontScaleCap.text}
          testID="paywall-cta"
          disabled={failed ? load.status === 'loading' : !paywall.canPurchase}
          onPress={failed ? paywall.retry : paywall.purchase}
        />
        {ctaNote ? (
          <Text
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[type.footnote, { textAlign: 'center', paddingTop: space.related, fontVariant: ['tabular-nums'] }]}
            testID="paywall-cta-note">
            {ctaNote}
          </Text>
        ) : null}

        {/* Three quiet links separated by air, not dots (trim-ui §9). Each keeps a 44pt target. */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            columnGap: space.related,
            paddingTop: space.tight,
          }}>
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

      {/* The root toast sits under this full-screen modal; `No purchases to restore` lands here. */}
      <ToastHost bottom={footerHeight + space.related} />
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
  const { type } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH_TARGET,
        paddingHorizontal: space.related,
        justifyContent: 'center',
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <Text style={type.footnote} maxFontSizeMultiplier={fontScaleCap.text}>
        {title}
      </Text>
    </Pressable>
  );
}
