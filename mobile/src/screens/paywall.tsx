import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, HeaderActions } from '@/components/button';
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
  const [footerHeight, setFooterHeight] = useState(0);

  const headline = REASON_HEADLINE[paywall.reason];
  const features = proFeaturesFor(paywall.reason);
  const busy = paywall.busy !== null;
  const { load, selected, trial, message } = paywall;
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
      {/* `Not now` is a native toolbar item on the system glass, always reachable, never hidden
          or delayed; content scrolls under it with the scroll-edge effect (trim-ui §13 Paywall). */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerTitle: '',
          headerTintColor: colors.label,
          title: 'Trim Pro',
        }}
      />
      <HeaderActions right={{ title: 'Not now', variant: 'plain', disabled: busy, onPress: paywall.close }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: space.related,
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

      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={{
          paddingTop: space.inline,
          paddingHorizontal: space.gutter,
          paddingBottom: Math.max(insets.bottom, space.related),
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
