import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CATALOG,
  catalogKey,
  exerciseCatalogDisplayText,
  exercisePickerMeta,
  groupExercisesForBrowse,
  offlineCatalogExercises,
  recentOfflineExercises,
  recordExerciseSelection,
  searchExercises,
  searchLocalExercises,
  uniqueCatalogExercises,
  type ExerciseSectionTitle,
} from '@/catalog';
import {
  PRESSED_OPACITY,
  fontScaleCap,
  gadgetRadius,
  plansGeometry as geo,
  plansType,
  progressColors,
  sheetColors,
  sheetGeometry,
  signal,
} from '@/constants/theme';
import { newId } from '@/domain/id';
import type { CustomExerciseDefinition, ExercisePrescription } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';

/** How a custom exercise is tracked; the meta says what its plan row will read (EP-2). */
const CUSTOM_KINDS = [
  { key: 'weight', title: 'Weight × reps', meta: '3 × 12 reps, load in the gym', exerciseType: 'strength', trackingMode: 'weightAndReps' },
  { key: 'reps', title: 'Reps only', meta: '3 × 12 reps, body weight', exerciseType: 'strength', trackingMode: 'reps' },
  { key: 'time', title: 'Time', meta: '3 × 30s holds', exerciseType: 'stability', trackingMode: 'duration' },
  { key: 'cardio', title: 'Cardio (minutes)', meta: '20 min', exerciseType: 'cardio', trackingMode: 'duration' },
] as const satisfies readonly {
  key: string;
  title: string;
  meta: string;
  exerciseType: CustomExerciseDefinition['exerciseType'];
  trackingMode: CustomExerciseDefinition['trackingMode'];
}[];

type CustomKind = (typeof CUSTOM_KINDS)[number];

/** Remote search waits for a pause in typing (off in production, `CATALOG.remote`). */
const REMOTE_DEBOUNCE_MS = 300;

export type ExercisePickerProps =
  | {
      /** The add lifts sheet: rows tick on and off; the sheet adds them all at once. */
      mode: 'multi';
      pickedKeys: ReadonlySet<string>;
      onToggle: (exercise: ExercisePrescription) => void;
      /** Catalog keys already in the day: `In this day`, not pickable. */
      takenKeys?: ReadonlySet<string>;
    }
  | {
      /** Choose another (Today, the log): one tap picks the replacement. */
      mode: 'replace';
      onPick: (exercise: ExercisePrescription) => void;
      takenKeys?: ReadonlySet<string>;
    };

/**
 * The exercise list for sheets (PA3; ported from `screens/exercise-picker.tsx`): the search
 * field (names and catalog aliases), muscle chips that scroll sideways and pick a section
 * (catalog `sections.ts`, recents first when there are any), rows with the name, `kit, muscle`
 * and a round tick, and creating a custom exercise from a search with no exact match. Renders
 * inside the caller's `SheetScroll`; the caller owns the header and the sticky action.
 */
export function ExercisePicker(props: ExercisePickerProps) {
  const { customExercises, saveCustomExercise } = useWorkoutStore();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<ExercisePrescription[]>([]);
  const [section, setSection] = useState<ExerciseSectionTitle | null>(null);
  /** The query whose Create row is open on the tracking choice; closes when the query changes. */
  const [choosingFor, setChoosingFor] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ query: string; exercises: ExercisePrescription[] } | null>(null);

  const offline = useMemo(() => offlineCatalogExercises(customExercises), [customExercises]);
  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  useEffect(() => {
    let cancelled = false;
    void recentOfflineExercises(customExercises).then((items) => {
      if (!cancelled) setRecent(items);
    });
    return () => {
      cancelled = true;
    };
  }, [customExercises]);

  useEffect(() => {
    // Remote search is off in production: local results are the whole answer.
    if (!trimmed || CATALOG.remote === 'off') {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchExercises(trimmed, customExercises, controller.signal)
        .then((response) => setRemote({ query: trimmed, exercises: response.exercises }))
        .catch(() => undefined);
    }, REMOTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, customExercises]);

  const sections = useMemo(() => groupExercisesForBrowse({ exercises: offline, recent }), [offline, recent]);
  const shown = sections.find((item) => item.title === section) ?? sections[0];

  const results = useMemo(
    () =>
      searching
        ? uniqueCatalogExercises(
            remote?.query === trimmed ? remote.exercises : searchLocalExercises(trimmed, customExercises),
            trimmed,
          )
        : [],
    [customExercises, remote, searching, trimmed],
  );
  const rows = searching ? results : (shown?.data ?? []);

  const canCreate =
    trimmed.length >= 2 && !results.some((item) => item.name.toLowerCase() === trimmed.toLowerCase());
  const choosingKind = canCreate && choosingFor === trimmed;
  const displayQuery = exerciseCatalogDisplayText(trimmed);

  const choose = (exercise: ExercisePrescription) => {
    if (props.mode === 'replace') {
      void recordExerciseSelection(exercise);
      props.onPick(exercise);
      return;
    }
    props.onToggle(exercise);
  };

  const createCustom = (kind: CustomKind) => {
    if (displayQuery.length < 2) {
      return;
    }
    const definition: CustomExerciseDefinition = {
      id: newId(),
      name: displayQuery,
      equipment: 'Other',
      muscle: 'Other',
      exerciseType: kind.exerciseType,
      trackingMode: kind.trackingMode,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    saveCustomExercise(definition);
    const created = offlineCatalogExercises([...customExercises, definition]).find(
      (item) => item.customExerciseID === definition.id,
    );
    setChoosingFor(null);
    setQuery('');
    if (created) {
      choose(created);
    }
  };

  return (
    <View testID="exercise-picker">
      <View style={styles.search}>
        <Text maxFontSizeMultiplier={fontScaleCap.title} style={plansType.searchGlyph} accessible={false}>
          ⌕
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${offline.length} exercises`}
          placeholderTextColor={sheetColors.muted}
          selectionColor={signal.orange}
          keyboardAppearance="dark"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel="Search exercises"
          maxFontSizeMultiplier={fontScaleCap.title}
          testID="picker-search"
          style={[plansType.search, styles.searchInput]}
        />
      </View>

      {searching ? null : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}>
          {sections.map((item) => {
            const on = item.title === shown?.title;
            return (
              <Pressable
                key={item.title}
                onPress={() => setSection(item.title)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                testID={`picker-chip-${item.title}`}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && styles.pressed]}>
                <Text
                  maxFontSizeMultiplier={fontScaleCap.title}
                  style={[plansType.muscleChip, on && styles.chipOnText]}>
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {searching && rows.length === 0 ? (
        <Text maxFontSizeMultiplier={fontScaleCap.text} style={[plansType.pickSub, styles.noResults]}>
          No exercises match “{displayQuery}”
        </Text>
      ) : null}

      {rows.length > 0 ? (
        <View style={[styles.card, searching && styles.results]}>
          {rows.map((exercise, index) => {
            const key = catalogKey(exercise);
            const taken = props.takenKeys?.has(key) ?? false;
            const picked = props.mode === 'multi' && props.pickedKeys.has(key);
            return (
              <PickRow
                key={`${shown?.title ?? ''}:${key}`}
                name={exercise.name}
                sub={taken ? 'In this day' : exercisePickerMeta(exercise)}
                first={index === 0}
                taken={taken}
                tick={props.mode === 'multi' ? (picked ? 'on' : 'off') : 'none'}
                onPress={() => choose(exercise)}
              />
            );
          })}
        </View>
      ) : null}

      {searching && canCreate ? (
        <View style={styles.card} testID="picker-create-block">
          <PickRow
            name={`Create “${displayQuery}”`}
            sub={choosingKind ? 'How is it tracked?' : 'Your own exercise'}
            first
            tick="plus"
            expanded={choosingKind}
            onPress={() => setChoosingFor(choosingKind ? null : trimmed)}
            testID="picker-create"
          />
          {choosingKind
            ? CUSTOM_KINDS.map((kind) => (
                <PickRow
                  key={kind.key}
                  name={kind.title}
                  sub={kind.meta}
                  tick="none"
                  accessibilityLabel={`Track as ${kind.title}`}
                  onPress={() => createCustom(kind)}
                  testID={`picker-create-${kind.key}`}
                />
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

/** A picker row (`.pickrow`): the name over `kit, muscle`, and a round tick (orange when picked). */
function PickRow({
  name,
  sub,
  first = false,
  taken = false,
  tick,
  expanded,
  accessibilityLabel,
  onPress,
  testID,
}: {
  name: string;
  sub: string;
  first?: boolean;
  taken?: boolean;
  tick: 'on' | 'off' | 'plus' | 'none';
  expanded?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={taken}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${name}, ${sub}`}
      accessibilityState={{
        ...(tick === 'on' || tick === 'off' ? { selected: tick === 'on' } : {}),
        ...(expanded != null ? { expanded } : {}),
        disabled: taken,
      }}
      testID={testID}
      style={({ pressed }) => [styles.row, !first && styles.rule, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[plansType.pickName, taken && styles.takenName]}>
          {name}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.text} style={[plansType.pickSub, styles.sub]}>
          {sub}
        </Text>
      </View>
      {tick === 'none' || taken ? null : (
        <View style={[styles.tick, tick === 'on' && styles.tickOn]}>
          {tick === 'on' || tick === 'plus' ? (
            <Text
              maxFontSizeMultiplier={fontScaleCap.display}
              style={[plansType.tick, tick === 'plus' && styles.plusInk]}>
              {tick === 'on' ? '✓' : '+'}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: PRESSED_OPACITY },
  search: {
    height: geo.searchHeight,
    borderRadius: geo.searchRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.card,
    marginHorizontal: geo.searchX,
    paddingHorizontal: geo.searchPadX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: geo.searchGap,
  },
  // A fixed height, no line height (AGENTS.md: the placeholder would sit apart from typed text).
  searchInput: { flex: 1, height: geo.searchHeight, color: sheetColors.ink, padding: 0 },
  chipsScroll: {
    flexGrow: 0,
    marginTop: geo.chipsTop,
    marginBottom: geo.chipsBottom,
    // Edge to edge: the chips scroll under the sheet's side padding.
    marginHorizontal: -sheetGeometry.sidePad,
  },
  chips: { gap: geo.chipGap, paddingHorizontal: geo.chipsPadX },
  chip: {
    height: geo.chipHeight,
    paddingHorizontal: geo.chipPadX,
    borderRadius: geo.chipRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.pillDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: signal.orange },
  chipOnText: { color: sheetColors.onOrange },
  // Under the search field while searching, where the chips would be.
  results: { marginTop: geo.chipsTop },
  noResults: { marginTop: geo.chipsTop, marginHorizontal: geo.dayX, marginBottom: geo.chipsBottom },
  card: {
    backgroundColor: sheetColors.card,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: sheetGeometry.cardGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: geo.pickGap,
    paddingVertical: geo.pickPadY,
    paddingHorizontal: geo.pickPadX,
  },
  rule: { borderTopWidth: 1, borderTopColor: sheetColors.rule },
  rowText: { flex: 1, minWidth: 0 },
  sub: { marginTop: geo.subTop },
  takenName: { color: sheetColors.muted },
  tick: {
    width: geo.tick,
    height: geo.tick,
    borderRadius: geo.tick / 2,
    boxShadow: `inset 0 0 0 ${geo.tickRing}px ${progressColors.tickRing}`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tickOn: { backgroundColor: signal.orange, boxShadow: 'none' },
  plusInk: { color: sheetColors.ink },
});
