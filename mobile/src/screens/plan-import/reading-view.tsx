import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { LiftMatch } from '@/catalog/plan-import-match';
import {
  fontScaleCap,
  gadgetRadius,
  importColors as C,
  importGeometry as G,
  importType,
  onboardingType,
  sheetColors,
  signal,
  space,
} from '@/constants/theme';
import { SectionLabel } from '@/device/sheets/primitives';
import { DURATION, EASE_OUT_FN, IMPORT } from '@/motion';

import type { ReadState } from './reader';

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A found lift's sets × reps as the editor's chip writes it (`3 × 8`, a hold `3 × 0:45`). */
export function importChip(match: LiftMatch): string {
  const { lift, exercise } = match;
  const sets = lift.sets ?? exercise?.sets ?? 3;
  if (lift.seconds != null) {
    return `${sets} × ${clock(lift.seconds)}`;
  }
  return `${sets} × ${lift.reps ?? exercise?.reps ?? 10}`;
}

/** A lift's name in Trim: the catalog's when it matched, the owner's words when it didn't. */
export function importName(match: LiftMatch): string {
  return match.exercise?.name ?? match.lift.name;
}

/**
 * Reading (decision 88): `Reading…` over what Trim is doing and a filling bar, then the plan's
 * days with each found lift landing in turn: ✓ when Trim knows it, an orange ? when it doesn't.
 * When it's done the title becomes the plan's name, editable, empty with `Name your plan` when
 * the source had none; days without names read `Day 1`, `Day 2`.
 */
export function ReadingView({
  state,
  name,
  onRename,
  centered = false,
}: {
  state: ReadState;
  name: string;
  onRename: (name: string) => void;
  /** Onboarding centres its titles; a sheet's page starts at the left. */
  centered?: boolean;
}) {
  const align = centered ? styles.center : null;
  const done = state.phase === 'done';
  const empty = state.phase === 'empty';

  const days = revealedDays(state);

  return (
    <View style={styles.root}>
      {done ? (
        <TextInput
          value={name}
          onChangeText={onRename}
          placeholder="Name your plan"
          placeholderTextColor={sheetColors.sectionLabel}
          accessibilityLabel="Plan name"
          returnKeyType="done"
          keyboardAppearance="dark"
          maxFontSizeMultiplier={fontScaleCap.title}
          selectionColor={signal.orange}
          style={[importType.name, styles.name, align]}
          testID="import-name"
        />
      ) : (
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap.title} style={[onboardingType.title, align]}>
          {empty ? 'No plan found' : 'Reading…'}
        </Text>
      )}

      <Text
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={fontScaleCap.title}
        style={[onboardingType.sub, styles.status, align]}>
        {empty ? 'Trim couldn’t find any exercises in that.' : state.status}
        {state.unknown > 0 ? <Text style={styles.unknownText}>{`, ${state.unknown} to fix`}</Text> : null}
      </Text>

      {empty ? null : <ProgressBar progress={state.progress} visible={!done} />}

      <View style={styles.days}>
        {state.phase === 'reading' && state.shown === 0 ? <Placeholders /> : null}
        {days.map((day) => (
          <View key={day.title} style={styles.day}>
            <SectionLabel>{day.title}</SectionLabel>
            <View style={styles.card}>
              {day.lifts.map((lift, index) => (
                <Animated.View
                  key={`${lift.lift.raw}-${index}`}
                  entering={FadeInDown.duration(IMPORT.ROW_IN)}
                  style={[styles.row, index > 0 && styles.rule]}>
                  <Text
                    numberOfLines={1}
                    maxFontSizeMultiplier={fontScaleCap.text}
                    style={[importType.lift, styles.liftName, !lift.exercise && styles.unknownText]}>
                    {importName(lift)}
                  </Text>
                  <Text maxFontSizeMultiplier={fontScaleCap.text} style={[importType.liftValue, styles.tabular]}>
                    {importChip(lift)}
                  </Text>
                  <View
                    accessibilityLabel={lift.exercise ? 'Recognized' : 'Not recognized'}
                    style={[styles.mark, { backgroundColor: lift.exercise ? C.found : C.unknown }]}>
                    <Text maxFontSizeMultiplier={fontScaleCap.display} style={importType.mark}>
                      {lift.exercise ? '✓' : '?'}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The days with only their first `shown` lifts (in plan order), empty days dropped. */
function revealedDays(state: ReadState): { title: string; lifts: LiftMatch[] }[] {
  const out: { title: string; lifts: LiftMatch[] }[] = [];
  let remaining = state.shown;
  for (const day of state.match?.days ?? []) {
    const lifts = day.lifts.slice(0, Math.max(0, remaining));
    remaining -= lifts.length;
    if (lifts.length > 0) out.push({ title: day.title, lifts });
  }
  return out;
}

function ProgressBar({ progress, visible }: { progress: number; visible: boolean }) {
  const value = useSharedValue(progress);
  const shown = useSharedValue(1);
  useEffect(() => {
    value.set(withTiming(progress, { duration: IMPORT.BAR, easing: EASE_OUT_FN }));
  }, [progress, value]);
  useEffect(() => {
    shown.set(withTiming(visible ? 1 : 0, { duration: DURATION.change }));
  }, [shown, visible]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.round(value.get() * 100)}%` }));
  const track = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.track, track]}>
      <Animated.View style={[styles.fill, fill]} />
    </Animated.View>
  );
}

/** Before the first lift: two day-shaped placeholders that breathe (still under Reduce Motion). */
function Placeholders() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.55, { duration: IMPORT.BREATHE }), -1, true));
  }, [opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[styles.placeholders, style]} accessible={false}>
      <View style={styles.placeholderLabel} />
      <View style={[styles.placeholderCard, { height: G.placeholderCardTall }]} />
      <View style={styles.placeholderLabel} />
      <View style={[styles.placeholderCard, { height: G.placeholderCardShort }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.related },
  center: { textAlign: 'center' },
  name: { height: G.nameHeight, padding: 0 },
  status: { fontVariant: ['tabular-nums'] },
  unknownText: { color: signal.orange },
  track: {
    height: G.barHeight,
    borderRadius: G.barTrackRadius,
    backgroundColor: sheetColors.control,
    overflow: 'hidden',
    marginTop: space.tight,
  },
  fill: { height: '100%', borderRadius: G.barTrackRadius, backgroundColor: signal.orange },
  days: { gap: space.gutter, marginTop: space.related },
  day: { gap: space.tight },
  card: {
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: G.liftRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.inline,
    paddingHorizontal: space.inset,
    paddingVertical: space.related,
  },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sheetColors.rule },
  liftName: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  mark: {
    width: G.mark,
    height: G.mark,
    borderRadius: G.markRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholders: { gap: space.tight },
  placeholderLabel: {
    width: G.placeholderLabelWidth,
    height: G.placeholderLabelHeight,
    borderRadius: G.barTrackRadius * 3,
    backgroundColor: C.placeholderLabel,
    marginTop: space.related,
  },
  placeholderCard: { borderRadius: gadgetRadius.card, borderCurve: 'continuous', backgroundColor: C.placeholder },
});

