import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { AnimatedSheet } from '@/components/animated-sheet';
import { KeyboardStickyView } from '@/keyboard';
import { spacing } from '@/constants/theme';
import { CHECK_IN_METRICS, type BodyCheckIn, type BodyMetricKey } from '@/domain/check-in';
import { useTheme } from '@/theme/theme-context';

function emptyDraft(): Record<BodyMetricKey, string> {
  return Object.fromEntries(CHECK_IN_METRICS.map((metric) => [metric.key, ''])) as Record<
    BodyMetricKey,
    string
  >;
}

function formatFieldValue(value: number | undefined, unit: 'kg' | 'cm'): string {
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return unit === 'kg' ? value.toFixed(1) : String(value);
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
  onClose,
  onSave,
}: {
  visible: boolean;
  latest: BodyCheckIn | null;
  onClose: () => void;
  onSave: (input: Partial<BodyCheckIn>) => void;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(emptyDraft);
  const [focused, setFocused] = useState<BodyMetricKey | null>(null);
  const inputs = useRef<Partial<Record<BodyMetricKey, TextInput | null>>>({});
  const lastField = CHECK_IN_METRICS[CHECK_IN_METRICS.length - 1]?.key;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDraft(emptyDraft());
    setFocused(null);
  }, [visible]);

  const placeholders = useMemo(() => {
    const next = emptyDraft();
    for (const metric of CHECK_IN_METRICS) {
      next[metric.key] = formatFieldValue(latest?.[metric.key], metric.unit) || '0';
    }
    return next;
  }, [latest]);

  const save = () => {
    Keyboard.dismiss();
    const next: Partial<BodyCheckIn> = {};
    let hasValue = false;
    for (const metric of CHECK_IN_METRICS) {
      const parsed = parseFieldValue(draft[metric.key]);
      if (parsed != null) {
        next[metric.key] = parsed;
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
    const index = CHECK_IN_METRICS.findIndex((field) => field.key === focused);
    const next = CHECK_IN_METRICS[index + 1];
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
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.secondarySystemBackground,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
          }}>
          <Pressable
            onPress={focusNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={focused === lastField ? 'Done' : 'Next field'}>
            <Text style={[type.body, { color: colors.systemBlue }]}>
              {focused === lastField ? 'Done' : 'Next'}
            </Text>
          </Pressable>
          <Pressable
            onPress={dismissKeyboard}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss keyboard">
            <Text style={[type.body, { color: colors.systemBlue, fontWeight: '600' }]}>Done</Text>
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
            {CHECK_IN_METRICS.map((field, index) => {
              const active = draft[field.key].trim().length > 0;
              return (
                <View
                  key={field.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.md,
                    borderBottomWidth: index < CHECK_IN_METRICS.length - 1 ? 1 : 0,
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
                      height: 22,
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
                          const stillFocused = CHECK_IN_METRICS.some((item) =>
                            inputs.current[item.key]?.isFocused(),
                          );
                          if (!stillFocused) {
                            setFocused(null);
                          }
                        }, 40);
                      }}
                      keyboardType="decimal-pad"
                      placeholder={placeholders[field.key]}
                      placeholderTextColor={colors.tertiaryLabel}
                      selectionColor={colors.label}
                      style={{
                        minWidth: 72,
                        height: 22,
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
