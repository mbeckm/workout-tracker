import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontScaleCap, gadgetType, keypadGeometry, logType, sheetColors } from '@/constants/theme';
import { clampReps, useLogSession, type DrumKind, type SetValues } from '@/device/log';

import { SheetHeader, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

const MAX_DIGITS = 6;
const MAX_DECIMALS = 2;
/** The heaviest load the keypad takes (kg or lb). */
const MAX_LOAD = 9999;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

const TITLES: Record<DrumKind, string> = {
  weight: 'Weight',
  assist: 'Assistance',
  reps: 'Reps',
  seconds: 'Seconds',
  minutes: 'Minutes',
};

/** The drum's value as the keypad starts it (plain digits, no padding). */
function startText(kind: DrumKind, values: SetValues): string {
  const value =
    kind === 'weight'
      ? values.weight
      : kind === 'assist'
        ? values.counterweight
        : kind === 'reps'
          ? values.reps
          : kind === 'minutes'
            ? values.durationSeconds != null
              ? Math.round(values.durationSeconds / 60)
              : null
            : values.durationSeconds;
  return value == null ? '' : String(Math.round(value * 100) / 100);
}

function patchFor(kind: DrumKind, text: string): Partial<SetValues> | null {
  const value = Number(text);
  if (text === '' || text === '.' || !Number.isFinite(value)) {
    return null;
  }
  switch (kind) {
    case 'weight':
      return { weight: Math.min(MAX_LOAD, value) };
    case 'assist':
      return { counterweight: Math.min(MAX_LOAD, value) };
    case 'reps':
      return { reps: clampReps(value) };
    case 'seconds':
      return value > 0 ? { durationSeconds: Math.round(value) } : null;
    case 'minutes':
      return value > 0 ? { durationSeconds: Math.round(value) * 60 } : null;
  }
}

/**
 * The keypad (D19): a long press on the drum types an exact value (`81.25`, a big jump). It
 * sits low, so the drum stays in view; Done sets the drum, and Log still commits the set.
 */
export function KeypadSheet() {
  const { close } = useSheetChrome();
  const { stage, controls, units, setStageValues } = useLogSession();
  const kind = controls?.drum ?? 'weight';
  const decimals = kind === 'weight' || kind === 'assist';
  /** `fresh`: the first key replaces the value it opened with, like a calculator. */
  const [entry, setEntry] = useState(() => ({ text: stage ? startText(kind, stage.values) : '', fresh: true }));
  const { text, fresh } = entry;

  // Functional updates: fast typing never reads a stale value.
  const press = (key: (typeof KEYS)[number]) =>
    setEntry((current) => {
      const base = current.fresh ? '' : current.text;
      if (key === '⌫') {
        return { text: base.slice(0, -1), fresh: false };
      }
      if (key === '.') {
        if (!decimals || base.includes('.')) return { text: base, fresh: false };
        return { text: base === '' ? '0.' : `${base}.`, fresh: false };
      }
      const [, fraction] = base.split('.');
      if ((fraction != null && fraction.length >= MAX_DECIMALS) || base.replace('.', '').length >= MAX_DIGITS) {
        return { text: base, fresh: false };
      }
      return { text: base === '0' ? key : `${base}${key}`, fresh: false };
    });

  const done = () => {
    const patch = patchFor(kind, text);
    if (patch) setStageValues(patch);
    close();
  };

  const unit = kind === 'weight' || kind === 'assist' ? units : kind === 'reps' ? 'reps' : kind === 'minutes' ? 'min' : 's';

  return (
    <SheetScroll
      header={
        <SheetHeader
          title={TITLES[kind]}
          left={{ kind: 'close', onPress: close }}
          right={{ kind: 'text', label: 'Done', onPress: done }}
        />
      }>
      <View
        style={styles.value}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={text === '' ? 'Empty' : `${text} ${unit}`}>
        <Text maxFontSizeMultiplier={fontScaleCap.title} numberOfLines={1} style={[gadgetType.bigNumber, fresh && styles.fresh]}>
          {text === '' ? '–' : text}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={[gadgetType.rowSub, styles.unit]}>
          {unit}
        </Text>
      </View>
      <View style={styles.pad}>
        {KEYS.map((key) => {
          const inert = key === '.' && !decimals;
          return (
            <Pressable
              key={key}
              disabled={inert}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={key === '⌫' ? 'Delete' : key === '.' ? 'Decimal point' : key}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed, inert && styles.inert]}>
              <Text maxFontSizeMultiplier={fontScaleCap.display} style={logType.keypadDigit}>
                {key}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  value: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: keypadGeometry.gap,
    marginTop: keypadGeometry.valueTop,
    marginBottom: keypadGeometry.valueBottom,
  },
  fresh: { color: sheetColors.muted },
  unit: { flexShrink: 0 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: keypadGeometry.gap },
  key: {
    // Three to a row: a third of the row, less the two gaps shared between them.
    flexBasis: '30%',
    flexGrow: 1,
    height: keypadGeometry.key,
    borderRadius: keypadGeometry.radius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: sheetColors.cardRaised },
  inert: { opacity: 0 },
});
