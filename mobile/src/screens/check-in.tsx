import { Stack, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '@/components/toast';
import {
  bodyMetricForDisplay,
  bodyweightToKg,
  checkInMetrics,
  type BodyCheckIn,
  type BodyMetricKey,
  type CheckInMetric,
} from '@/domain/check-in';
import { latestCheckIn } from '@/domain/progress';
import { useWorkoutStore } from '@/store/workout-store';
import { useTheme } from '@/theme/theme-context';
import { track } from '@/analytics/analytics';

const ACCESSORY_ID = 'check-in-accessory';
/** Lets the sheet finish closing before the toast rises over Progress. */
const TOAST_DELAY_MS = 280;

function formatFieldValue(value: number | undefined, metric: CheckInMetric): string {
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return metric.unit === 'cm' ? String(value) : value.toFixed(1);
}

function parseFieldValue(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Body check-in as a native form sheet. iOS owns the sheet, its safe area and the keyboard
 * inset, so nothing floats: Cancel and Save live in the sheet's header row, the fields
 * scroll, and Next / Done ride the keyboard as a native input accessory.
 */
export function CheckInScreen() {
  const { colors, type } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bodyCheckIns, saveCheckIn, units } = useWorkoutStore();
  const fields = useMemo(() => checkInMetrics(units), [units]);
  const latest = useMemo(() => latestCheckIn(bodyCheckIns), [bodyCheckIns]);
  const [draft, setDraft] = useState<Partial<Record<BodyMetricKey, string>>>({});
  const [focused, setFocused] = useState<BodyMetricKey | null>(null);
  const inputs = useRef<Partial<Record<BodyMetricKey, TextInput | null>>>({});
  const saving = useRef(false);

  const parsed = useMemo(() => {
    const next: Partial<BodyCheckIn> = {};
    for (const metric of fields) {
      const value = parseFieldValue(draft[metric.key] ?? '');
      if (value != null) {
        next[metric.key] = metric.key === 'bodyweightKg' ? bodyweightToKg(value, units) : value;
      }
    }
    return next;
  }, [draft, fields, units]);
  const count = Object.keys(parsed).length;

  const save = () => {
    if (count === 0 || saving.current) {
      return;
    }
    saving.current = true;
    Keyboard.dismiss();
    saveCheckIn(parsed);
    track('check_in_saved', { fields: count });
    router.back();
    setTimeout(() => showToast({ title: 'Check-in saved' }), TOAST_DELAY_MS);
  };

  const focusNext = () => {
    const index = fields.findIndex((field) => field.key === focused);
    const next = fields[index + 1];
    if (next) {
      inputs.current[next.key]?.focus();
    } else {
      Keyboard.dismiss();
    }
  };
  const lastFocused = focused === fields[fields.length - 1]?.key;

  return (
    <>
      <Stack.Screen options={{ title: 'Check in' }} />
      {/* RNScreens form sheets take one non-collapsable header plus one ScrollView. */}
      <View
        collapsable={false}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 20,
          paddingHorizontal: 12,
          paddingBottom: 8,
          backgroundColor: colors.secondarySystemBackground,
        }}>
        <HeaderButton title="Cancel" onPress={() => router.back()} testID="check-in-cancel" />
        <Text style={[type.body, { fontWeight: '600' }]} accessibilityRole="header">
          Check in
        </Text>
        <HeaderButton
          title="Save"
          strong
          disabled={count === 0}
          onPress={save}
          testID="check-in-save"
        />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        testID="check-in-sheet">
        {fields.map((field, index) => {
          const text = draft[field.key] ?? '';
          const active = parseFieldValue(text) != null;
          const stored = latest?.[field.key];
          const placeholder =
            formatFieldValue(
              stored == null ? undefined : bodyMetricForDisplay(field.key, stored, units),
              field,
            ) || '—';
          return (
            <Pressable
              key={field.key}
              onPress={() => inputs.current[field.key]?.focus()}
              accessible={false}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 52,
                borderBottomWidth: index < fields.length - 1 ? 0.5 : 0,
                borderBottomColor: colors.separator,
              }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: active ? colors.systemGreen : colors.systemGray4,
                }}
              />
              <Text style={[type.body, { flex: 1 }]}>{field.label}</Text>
              <TextInput
                ref={(node) => {
                  inputs.current[field.key] = node;
                }}
                value={text}
                onChangeText={(next) => setDraft((current) => ({ ...current, [field.key]: next }))}
                onFocus={() => setFocused(field.key)}
                onBlur={() => setFocused((current) => (current === field.key ? null : current))}
                keyboardType="decimal-pad"
                inputAccessoryViewID={Platform.OS === 'ios' ? ACCESSORY_ID : undefined}
                accessibilityLabel={`${field.label}, ${field.unit === 'cm' ? 'centimeters' : field.unit === 'lbs' ? 'pounds' : 'kilograms'}`}
                accessibilityHint={stored == null ? undefined : `Last ${placeholder}`}
                placeholder={placeholder}
                placeholderTextColor={colors.tertiaryLabel}
                selectionColor={colors.label}
                style={[
                  type.body,
                  {
                    minWidth: 72,
                    minHeight: 44,
                    textAlign: 'right',
                    padding: 0,
                    fontVariant: ['tabular-nums'],
                    color: colors.label,
                  },
                ]}
              />
              <Text
                style={[
                  type.kicker,
                  { width: 28, color: active ? colors.secondaryLabel : colors.tertiaryLabel },
                ]}>
                {field.unit}
              </Text>
            </Pressable>
          );
        })}
        {Platform.OS === 'ios' ? (
          <InputAccessoryView nativeID={ACCESSORY_ID} backgroundColor={colors.secondarySystemBackground}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                paddingHorizontal: 12,
                borderTopWidth: 0.5,
                borderTopColor: colors.separator,
              }}>
              <HeaderButton
                title={lastFocused ? 'Done' : 'Next'}
                strong
                onPress={lastFocused ? () => Keyboard.dismiss() : focusNext}
              />
            </View>
          </InputAccessoryView>
        ) : null}
      </ScrollView>
    </>
  );
}

function HeaderButton({
  title,
  onPress,
  strong = false,
  disabled = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 12,
        justifyContent: 'center',
        opacity: pressed ? 0.55 : 1,
      })}>
      <Text
        style={[
          type.body,
          {
            fontWeight: strong ? '600' : '400',
            color: disabled ? colors.tertiaryLabel : strong ? colors.label : colors.secondaryLabel,
          },
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}
