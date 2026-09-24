import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PaperLink } from '@/components/paper';
import type { ProReason } from '@/purchases/pro-gate';
import { usePaywallController, type PaywallController } from '@/purchases/use-paywall-controller';
import { useTheme } from '@/theme/theme-context';

/** Only what Pro unlocks today. Keep in sync with the `requirePro` call sites. */
const PRO_FEATURES = ['More than one plan', 'Switch plans anytime'];

const REASON_LEAD: Record<ProReason, string | null> = {
  second_plan: 'A second plan needs Trim Pro.',
  switch_plan: 'Switching plans needs Trim Pro.',
  post_workout: null,
  settings: null,
};

export function PaywallScreen({ reason, session }: { reason: ProReason; session?: string }) {
  const paywall = usePaywallController(reason, session);
  return <PaywallView paywall={paywall} />;
}

/** Renders controller state only. The conversion redesign replaces this component. */
function PaywallView({ paywall }: { paywall: PaywallController }) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const lead = REASON_LEAD[paywall.reason];
  const busy = paywall.busy !== null;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-between',
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 12),
          gap: 32,
        }}>
        <View style={{ gap: 10 }}>
          <Text style={type.largeTitle} accessibilityRole="header">
            Trim Pro
          </Text>
          {lead ? <Text style={type.kicker}>{lead}</Text> : null}
          <View style={{ paddingTop: 12 }}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature} style={{ paddingVertical: 8 }}>
                <Text style={type.row}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          {paywall.load.status === 'loading' ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={colors.tertiaryLabel} accessibilityLabel="Loading prices" />
            </View>
          ) : null}

          {paywall.loadError ? (
            <View style={{ paddingVertical: 12, gap: 4 }}>
              <Text style={type.kicker}>{paywall.loadError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={paywall.retry}
                hitSlop={8}
                style={({ pressed }) => ({ alignSelf: 'flex-start', paddingVertical: 8, opacity: pressed ? 0.55 : 1 })}>
                <Text style={[type.row, { color: colors.systemBlue }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {paywall.offers.map((offer, index) => {
            const selected = paywall.selected?.id === offer.id;
            const detail = [
              offer.billedLine,
              offer.pricePerMonthString ? `${offer.pricePerMonthString} per month` : null,
              offer.savingsPercent ? `Save ${offer.savingsPercent}%` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={offer.id}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: busy }}
                accessibilityLabel={`${offer.title}, ${detail}`}
                disabled={busy}
                onPress={() => paywall.select(offer.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  borderTopWidth: index === 0 ? 0 : 0.5,
                  borderTopColor: colors.separator,
                  opacity: pressed ? 0.7 : 1,
                })}>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text style={[type.row, { color: selected ? colors.label : colors.secondaryLabel }]}>
                    {offer.label}
                  </Text>
                  <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{detail}</Text>
                </View>
                {selected ? (
                  <SymbolView name="checkmark" tintColor={colors.label} size={18} weight="medium" />
                ) : null}
              </Pressable>
            );
          })}

          {paywall.introLine ? (
            <Text style={[type.kicker, { paddingTop: 8 }]}>{paywall.introLine}</Text>
          ) : null}

          <View style={{ paddingTop: 20 }}>
            <Button
              title={paywall.busy === 'purchase' ? 'Purchasing…' : paywall.ctaTitle}
              variant="green"
              testID="paywall-cta"
              disabled={!paywall.canPurchase}
              onPress={paywall.purchase}
            />
          </View>
          <PaperLink title="Not now" testID="paywall-not-now" onPress={paywall.close} />

          {paywall.message ? (
            <Text style={[type.kicker, { textAlign: 'center', paddingTop: 12 }]} accessibilityLiveRegion="polite">
              {paywall.message}
            </Text>
          ) : null}

          {paywall.termsText ? (
            <Text style={[type.caption, { color: colors.tertiaryLabel, paddingTop: 20 }]}>
              {paywall.termsText}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              columnGap: 16,
              paddingTop: 16,
            }}>
            <FooterLink
              title={paywall.busy === 'restore' ? 'Restoring…' : 'Restore Purchases'}
              onPress={paywall.restore}
              disabled={busy}
            />
            <FooterLink title="Terms of Use" onPress={paywall.openTerms} />
            <FooterLink title="Privacy Policy" onPress={paywall.openPrivacy} />
          </View>
        </View>
      </ScrollView>
      <Stack.Screen options={{ headerShown: false, title: 'Trim Pro' }} />
    </>
  );
}

function FooterLink({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ paddingVertical: 6, opacity: disabled ? 0.4 : pressed ? 0.55 : 1 })}>
      <Text style={[type.caption, { color: colors.secondaryLabel }]}>{title}</Text>
    </Pressable>
  );
}
