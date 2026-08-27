import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { parsePositiveNumber } from '@/domain/helpers';
import { useTheme } from '@/theme/theme-context';

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function MetricStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const { colors, type } = useTheme();
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [focused, value]);

  const parsedDraft = (): number | null => {
    const parsed = parsePositiveNumber(draft);
    return parsed == null ? null : clampInt(parsed, min, max);
  };

  const commit = (raw: string) => {
    const parsed = parsePositiveNumber(raw);
    if (parsed == null) {
      setDraft(String(value));
      return;
    }
    const next = clampInt(parsed, min, max);
    setDraft(String(next));
    onChange(next);
  };

  const adjust = (delta: number) => {
    const base = parsedDraft() ?? value;
    const next = clampInt(base + delta, min, max);
    setDraft(String(next));
    onChange(next);
  };

  const current = parsedDraft() ?? value;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        gap: 8,
      }}>
      <Text style={[type.subhead, { flex: 1 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
        <StepperButton
          symbol="minus.circle"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          disabled={current <= min}
          onPress={() => adjust(-1)}
        />
        <TextInput
          accessibilityLabel={label}
          keyboardType="number-pad"
          selectTextOnFocus
          value={focused ? draft : String(value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(draft);
          }}
          onChangeText={(text) => {
            setDraft(text);
            const parsed = parsePositiveNumber(text);
            if (parsed != null) {
              onChange(clampInt(parsed, min, max));
            }
          }}
          placeholder="—"
          placeholderTextColor={colors.tertiaryLabel}
          style={{
            ...type.body,
            width: 40,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
            paddingVertical: 8,
          }}
        />
        <StepperButton
          symbol="plus.circle"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          disabled={current >= max}
          onPress={() => adjust(1)}
        />
      </View>
    </View>
  );
}

function StepperButton({
  symbol,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  symbol: 'minus.circle' | 'plus.circle';
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.28 : pressed ? 0.55 : 1,
      })}>
      <SymbolView name={symbol} tintColor={colors.secondaryLabel} size={22} />
    </Pressable>
  );
}
