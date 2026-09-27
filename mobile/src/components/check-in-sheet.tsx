import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { AnimatedSheet } from '@/components/animated-sheet';
import { KeyboardStickyView } from '@/keyboard';
import { spacing } from '@/constants/theme';
import {
  bodyMetricForDisplay,
  bodyweightToKg,
  checkInMetrics,
  type BodyCheckIn,
  type BodyMetricKey,
  type CheckInMetric,
  type WeightUnits,
} from '@/domain/check-in';
import { useTheme } from '@/theme/theme-context';

const FIELDS_KG = checkInMetrics('kg');

function emptyDraft(): Record<BodyMetricKey, string> {
  return Object.fromEntries(FIELDS_KG.map((metric) => [metric.key, ''])) as Record<
    BodyMetricKey,
    string
  >;
}

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

export function CheckInSheet({
  visible,
  latest,
  units = 'kg',
  onClose,
  onSave,
}: {
  visible: boolean;
  latest: BodyCheckIn | null;
  /** The user's weight units. Bodyweight is typed in these and stored in kg. */
  units?: WeightUnits;
  onClose: () => void;
  onSave: (input: Partial<BodyCheckIn>) => void;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(emptyDraft);
  const [focused, setFocused] = useState<BodyMetricKey | null>(null);
  const inputs = useRef<Partial<Record<BodyMetricKey, TextInput | null>>>({});
  const fields = useMemo(() => checkInMetrics(units), [units]);
  const lastField = fields[fields.length - 1]?.key;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDraft(emptyDraft());
    setFocused(null);
  }, [visible]);

  const placeholders = useMemo(() => {
    const next = emptyDraft();
    for (const metric of fields) {
      const stored = latest?.[metric.key];
      const shown = stored == null ? undefined : bodyMetricForDisplay(metric.key, stored, units);
      // Last value as a hint, never "0" (it reads as a value that will be saved).
      next[metric.key] = formatFieldValue(shown, metric) || '—';
    }
    return next;
  }, [fields, latest, units]);

  const save = () => {
    Keyboard.dismiss();
    const next: Partial<BodyCheckIn> = {};
    let hasValue = false;
    for (const metric of fields) {
      const parsed = parseFieldValue(draft[metric.key]);
      if (parsed != null) {
        next[metric.key] = metric.key === 'bodyweightKg' ? bodyweightToKg(parsed, units) : parsed;
        hasValue = true;
      }
    }
    if (!hasValue) {
      onClose();
      return;
    }
    onSave(next);
    onClose();
  };

  const focusField = (key: BodyMetricKey) => {
    inputs.current[key]?.focus();
  };

  const focusNext = () => {
    if (focused == null) {
      Keyboard.dismiss();
      return;
    }
    const index = fields.findIndex((field) => field.key === focused);
    const next = fields[index + 1];
    if (next) {
      focusField(next.key);
      return;
    }
    Keyboard.dismiss();
    setFocused(null);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setFocused(null);
  };

  const accessory =
    focused != null ? (
      <KeyboardStickyView>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.secondarySystemBackground,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
          }}>
          {/* One control: Next walks the fields, Done on the last one closes the keyboard. */}
          <Pressable
            onPress={focused === lastField ? dismissKeyboard : focusNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={focused === lastField ? 'Done' : 'Next field'}
            style={({ pressed }) => ({
              minHeight: 44,
              minWidth: 44,
              justifyContent: 'center',
              alignItems: 'flex-end',
              opacity: pressed ? 0.55 : 1,
            })}>
            <Text style={[type.body, { color: colors.label, fontWeight: '600' }]}>
              {focused === lastField ? 'Done' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </KeyboardStickyView>
    ) : null;

  return (
    <AnimatedSheet
      visible={visible}
      onClose={onClose}
      dragFrom="grabber"
      expandable
      expanded={focused != null}
      onDragStart={dismissKeyboard}
      header={<Text style={type.title}>Check in</Text>}
      keyboardAccessory={accessory}>
      <View testID="check-in-sheet" style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: spacing.sm,
          }}>
          <View>
            {fields.map((field, index) => {
              const active = draft[field.key].trim().length > 0;
              return (
                <View
                  key={field.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.md,
                    borderBottomWidth: index < fields.length - 1 ? 1 : 0,
                    borderBottomColor: colors.separator,
                  }}>
                  <Pressable
                    onPress={() => focusField(field.key)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      minHeight: 44,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${field.label}${active ? ', logging' : ', not logging'}`}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: active ? colors.systemGreen : colors.systemGray4,
                        flexShrink: 0,
                      }}
                    />
                    <Text style={type.body}>{field.label}</Text>
                  </Pressable>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      minWidth: 100,
                      minHeight: 22,
                      justifyContent: 'flex-end',
                    }}>
                    <TextInput
                      ref={(node) => {
                        inputs.current[field.key] = node;
                      }}
                      value={draft[field.key]}
                      onChangeText={(text) =>
                        setDraft((current) => ({ ...current, [field.key]: text }))
                      }
                      onFocus={() => setFocused(field.key)}
                      onBlur={() => {
                        setTimeout(() => {
                          const stillFocused = fields.some((item) =>
                            inputs.current[item.key]?.isFocused(),
                          );
                          if (!stillFocused) {
                            setFocused(null);
                          }
                        }, 40);
                      }}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`${field.label}, ${field.unit === 'cm' ? 'centimeters' : field.unit === 'lbs' ? 'pounds' : 'kilograms'}`}
                      placeholder={placeholders[field.key]}
                      placeholderTextColor={colors.tertiaryLabel}
                      selectionColor={colors.label}
                      style={{
                        minWidth: 72,
                        minHeight: 22,
                        fontSize: 17,
                        fontWeight: '400',
                        lineHeight: 22,
                        textAlign: 'right',
                        padding: 0,
                        margin: 0,
                        color: active ? colors.label : colors.tertiaryLabel,
                        fontVariant: ['tabular-nums'],
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '400',
                        lineHeight: 18,
                        marginLeft: 4,
                        paddingBottom: 2,
                        color: active ? colors.secondaryLabel : colors.tertiaryLabel,
                      }}>
                      {field.unit}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.separator,
              paddingTop: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.sm),
              backgroundColor: colors.secondarySystemBackground,
            }}>
            <Button title="Save check-in" variant="green" onPress={save} testID="check-in-save" />
          </View>
        </KeyboardStickyView>
      </View>
    </AnimatedSheet>
  );
}
