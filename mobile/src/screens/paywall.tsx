import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PaperLink } from '@/components/paper';
import { useTheme } from '@/theme/theme-context';
import {
  defaultProPlans,
  fetchProPlans,
  isExpoGo,
  purchaseProPlan,
  restorePurchases,
  type ProPlan,
  type ProPlanId,
} from '@/purchases/purchases';
import { useWorkoutStore } from '@/store/workout-store';

const FEATURES = ['Plan first', 'One set at a time', 'History on this iPhone'];

function priceLine(plan: ProPlan, kind: 'annual' | 'monthly'): string {
  if (plan.price === '—') {
    return kind === 'annual' ? 'Yearly' : 'Monthly';
  }
  return kind === 'annual' ? `${plan.price} a year` : `Monthly ${plan.price}`;
}

export function PaywallScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const from = useLocalSearchParams<{ from?: string | string[] }>().from;
  const fromSettings = (Array.isArray(from) ? from[0] : from) === 'settings';
  const insets = useSafeAreaInsets();
  const { dismissPaywall, setPro } = useWorkoutStore();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ProPlanId>('annual');
  const [plans, setPlans] = useState<ProPlan[]>(() => defaultProPlans());

  useEffect(() => {
    let cancelled = false;
    void fetchProPlans().then((next) => {
      if (!cancelled) {
        setPlans(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    if (!fromSettings) {
      dismissPaywall();
      router.replace('/');
      return;
    }
    router.back();
  };

  const annual = plans.find((plan) => plan.id === 'annual');
  const monthly = plans.find((plan) => plan.id === 'monthly');
  const lifetime = plans.find((plan) => plan.id === 'lifetime' && plan.available);
  const selectedPlan = plans.find((plan) => plan.id === selected) ?? annual ?? plans[0];

  const subscribe = async () => {
    if (!selectedPlan || busy) {
      return;
    }
    setBusy(true);
    const result = await purchaseProPlan(selectedPlan.id);
    setBusy(false);
    setMessage(result.message);
    if (result.isPro) {
      setPro(true);
      router.replace('/');
    }
  };

  const annualText = annual ? priceLine(annual, 'annual') : null;
  const monthlyText =
    monthly == null ? null : monthly.price === '—' ? 'Monthly' : `Monthly ${monthly.price}`;
  const lifetimeText =
    lifetime == null ? null : lifetime.price === '—' ? 'Lifetime' : `${lifetime.price} once`;

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 12),
        }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 10, paddingBottom: 12 }}>
          <Text style={type.hero}>Pro</Text>
          {annualText ? (
            <Pressable onPress={() => setSelected('annual')} accessibilityRole="button">
              <Text style={selected === 'annual' ? type.residue : type.kicker}>{annualText}</Text>
            </Pressable>
          ) : null}
          {monthlyText ? (
            <Pressable onPress={() => setSelected('monthly')} accessibilityRole="button">
              <Text style={selected === 'monthly' ? type.residue : type.kicker}>{monthlyText}</Text>
            </Pressable>
          ) : null}
          {lifetimeText ? (
            <Pressable onPress={() => setSelected('lifetime')} accessibilityRole="button">
              <Text style={selected === 'lifetime' ? type.residue : type.kicker}>{lifetimeText}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ paddingBottom: 24 }}>
          {FEATURES.map((feature) => (
            <View key={feature} style={{ paddingVertical: 10 }}>
              <Text style={type.row}>{feature}</Text>
            </View>
          ))}
        </View>
        <Button
          title={busy ? 'Loading…' : 'Subscribe'}
          variant="green"
          disabled={busy}
          onPress={() => void subscribe()}
        />
        <PaperLink title="Not now" testID="paywall-not-now" onPress={close} />
        <Pressable
          onPress={async () => {
            const result = await restorePurchases();
            setMessage(result.message);
            if (result.isPro) {
              setPro(true);
              router.replace('/');
            }
          }}
          style={({ pressed }) => ({ paddingTop: 8, opacity: pressed ? 0.55 : 1 })}>
          <Text style={[type.kicker, { textAlign: 'center' }]}>Restore</Text>
        </Pressable>
        {isExpoGo ? (
          <Text style={[type.kicker, { textAlign: 'center', paddingTop: 16 }]}>
            Purchases need a development build, not Expo Go.
          </Text>
        ) : null}
        {message ? (
          <Text style={[type.kicker, { textAlign: 'center', paddingTop: 8 }]}>{message}</Text>
        ) : null}
      </View>
      <Stack.Screen options={{ headerShown: false, title: 'Pro' }} />
    </>
  );
}
