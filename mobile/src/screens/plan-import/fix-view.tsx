import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { offlineCatalogExercises, searchLocalExercises } from '@/catalog/service';
import { liftKey, type PlanMatch } from '@/catalog/plan-import-match';
import { exercisePickerMeta } from '@/catalog/sections';
import {
  fontScaleCap,
  gadgetRadius,
  importGeometry as G,
  importType,
  sheetColors,
  signal,
  space,
} from '@/constants/theme';
import { newId } from '@/domain/id';
import type { CustomExerciseDefinition, ExercisePrescription } from '@/domain/types';
import { CUSTOM_KINDS, type CustomKind } from '@/device/sheets/exercise-picker';
import { DURATION, PRESS_SCALE } from '@/motion';

import { importChip } from './reading-view';

const SEARCH_RESULTS = 4;

type Mode = 'menu' | 'search' | 'create';

type Item = { key: string; name: string; meta: string; alternatives: ExercisePrescription[] };

/** The lifts Trim couldn't recognize or only guessed (decision 91), in plan order, with where they sit. */
export function unknownLifts(match: PlanMatch): Item[] {
  const items: Item[] = [];
  match.days.forEach((day, dayIndex) => {
    day.lifts.forEach((lift, liftIndex) => {
      if (!lift.exercise) {
        items.push({
          key: liftKey(dayIndex, liftIndex),
          name: lift.lift.name,
          meta: `${day.title}, ${importChip(lift)}`,
          alternatives: lift.alternatives,
        });
      }
    });
  });
  return items;
}

/** Every unknown lift has an answer (a lift, or left out). */
export function allFixed(match: PlanMatch, fixes: ReadonlyMap<string, ExercisePrescription | null>): boolean {
  return unknownLifts(match).every((item) => fixes.has(item.key));
}

/**
 * Fix (decision 88): one card per lift Trim couldn't recognize, the owner's words in quotes and
 * where it sits. The open card offers the closest catalog lifts, Search all lifts (Trim's offline
 * search, starting from their words), Create custom (asks how it's tracked, like the picker) and
 * Leave it out. An answered card folds to its answer and the next one opens; tap to change it.
 */
export function FixView({
  match,
  fixes,
  onFix,
  customExercises,
  saveCustomExercise,
}: {
  match: PlanMatch;
  fixes: ReadonlyMap<string, ExercisePrescription | null>;
  onFix: (key: string, exercise: ExercisePrescription | null) => void;
  customExercises: CustomExerciseDefinition[];
  saveCustomExercise: (exercise: CustomExerciseDefinition) => void;
}) {
  const items = useMemo(() => unknownLifts(match), [match]);
  const [active, setActive] = useState<string | null>(() => items.find((item) => !fixes.has(item.key))?.key ?? null);
  const [mode, setMode] = useState<Mode>('menu');
  const [queries, setQueries] = useState<Record<string, string>>({});
  // Their words start selected, so typing replaces them (selectTextOnFocus doesn't with autoFocus).
  const [selectAll, setSelectAll] = useState(true);

  const answer = (key: string, exercise: ExercisePrescription | null) => {
    onFix(key, exercise);
    const next = items.find((item) => item.key !== key && !fixes.has(item.key));
    setActive(next?.key ?? null);
    setMode('menu');
  };

  const create = (item: Item, kind: CustomKind) => {
    const name = (queries[item.key] ?? item.name).trim();
    if (name.length < 2) return;
    const definition: CustomExerciseDefinition = {
      id: newId(),
      name,
      equipment: 'Other',
      muscle: 'Other',
      exerciseType: kind.exerciseType,
      trackingMode: kind.trackingMode,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    saveCustomExercise(definition);
    const created = offlineCatalogExercises([...customExercises, definition]).find(
      (exercise) => exercise.customExerciseID === definition.id,
    );
    if (created) answer(item.key, created);
  };

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const open = active === item.key;
        const fixed = fixes.has(item.key);
        const choice = fixes.get(item.key);
        const query = queries[item.key] ?? item.name;
        return (
          <View key={item.key} style={[styles.card, open && styles.cardOpen]} testID={`import-fix-${item.key}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => {
                setActive(open ? null : item.key);
                setMode('menu');
                setSelectAll(true);
              }}
              style={styles.head}>
              <View style={styles.headText}>
                <Text maxFontSizeMultiplier={fontScaleCap.text} style={[importType.cardTitle, !fixed && styles.orange]}>
                  {`“${item.name}”`}
                </Text>
                <Text maxFontSizeMultiplier={fontScaleCap.text} style={importType.cardMeta}>
                  {item.meta}
                </Text>
              </View>
              {fixed && !open ? (
                <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.text} style={[importType.cardTitle, styles.answer, choice == null && styles.muted]}>
                  {choice ? choice.name : 'Left out'}
                </Text>
              ) : null}
            </Pressable>

            {open && mode === 'menu' ? (
              <Animated.View entering={FadeIn.duration(DURATION.enter)} style={styles.body}>
                {item.alternatives.map((exercise) => (
                  <Choice key={exercise.id} title={exercise.name} meta={exercisePickerMeta(exercise)} onPress={() => answer(item.key, exercise)} />
                ))}
                <Choice title="Search all lifts" searchIcon quiet onPress={() => setMode('search')} testID="import-fix-search" />
                <View style={styles.pair}>
                  <Choice title="Create custom" outline onPress={() => setMode('create')} style={styles.half} testID="import-fix-create" />
                  <Choice title="Leave it out" bare onPress={() => answer(item.key, null)} style={styles.half} testID="import-fix-leave" />
                </View>
              </Animated.View>
            ) : null}

            {open && mode === 'search' ? (
              <Animated.View entering={FadeIn.duration(DURATION.enter)} style={styles.body}>
                <View style={styles.search}>
                  <SearchIcon />
                  <TextInput
                    value={query}
                    onChangeText={(text) => {
                      setSelectAll(false);
                      setQueries((current) => ({ ...current, [item.key]: text }));
                    }}
                    onSelectionChange={() => setSelectAll(false)}
                    selection={selectAll ? { start: 0, end: query.length } : undefined}
                    autoFocus
                    autoCorrect={false}
                    placeholder="Search lifts"
                    placeholderTextColor={sheetColors.sectionLabel}
                    selectionColor={signal.orange}
                    accessibilityLabel="Search lifts"
                    returnKeyType="search"
                    maxFontSizeMultiplier={fontScaleCap.text}
                    style={[importType.choice, styles.searchField]}
                  />
                </View>
                {searchLocalExercises(query, customExercises)
                  .slice(0, SEARCH_RESULTS)
                  .map((exercise) => (
                    <Choice key={exercise.id} title={exercise.name} meta={exercisePickerMeta(exercise)} onPress={() => answer(item.key, exercise)} />
                  ))}
                {query.trim().length >= 2 ? (
                  <Choice title={`Create “${query.trim()}”`} outline onPress={() => setMode('create')} />
                ) : null}
              </Animated.View>
            ) : null}

            {open && mode === 'create' ? (
              <Animated.View entering={FadeIn.duration(DURATION.enter)} style={styles.body}>
                <Text maxFontSizeMultiplier={fontScaleCap.text} style={[importType.cardMeta, styles.ask]}>
                  {`How is “${query.trim() || item.name}” tracked?`}
                </Text>
                {CUSTOM_KINDS.map((kind) => (
                  <Choice key={kind.key} title={kind.title} meta={kind.meta} stacked onPress={() => create(item, kind)} testID={`import-fix-kind-${kind.key}`} />
                ))}
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** The magnifier, drawn like Import plan's other icons (a 2-pt stroke on a 24 grid). */
function SearchIcon() {
  return (
    <Svg
      width={G.rowIcon - 4}
      height={G.rowIcon - 4}
      viewBox="0 0 24 24"
      fill="none"
      stroke={sheetColors.muted}
      strokeWidth={2.4}
      strokeLinecap="round"
      accessible={false}>
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

function Choice({
  title,
  meta,
  searchIcon = false,
  quiet = false,
  outline = false,
  bare = false,
  stacked = false,
  onPress,
  style,
  testID,
}: {
  title: string;
  meta?: string;
  searchIcon?: boolean;
  quiet?: boolean;
  outline?: boolean;
  bare?: boolean;
  stacked?: boolean;
  onPress: () => void;
  style?: object;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta ? `${title}, ${meta}` : title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choice,
        stacked && styles.stacked,
        outline && styles.outline,
        bare && styles.bare,
        pressed && styles.pressed,
        style,
      ]}>
      {searchIcon ? <SearchIcon /> : null}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[importType.choice, (quiet || bare) && styles.muted, !stacked && styles.grow, outline && styles.centerText, bare && styles.centerText]}>
        {title}
      </Text>
      {meta ? (
        <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.text} style={importType.choiceMeta}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.related, paddingTop: space.gutter },
  card: {
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.card,
    overflow: 'hidden',
  },
  cardOpen: { borderWidth: 2, borderColor: signal.orange },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.inline,
    paddingHorizontal: space.inset,
    paddingVertical: space.inline,
  },
  headText: { flex: 1, gap: space.pair },
  answer: { maxWidth: '50%', textAlign: 'right' },
  orange: { color: signal.orange },
  muted: { color: sheetColors.muted },
  body: { gap: space.tight + space.pair, paddingHorizontal: space.related + space.pair, paddingBottom: space.related + space.pair },
  pair: { flexDirection: 'row', gap: space.tight + space.pair },
  half: { flex: 1 },
  choice: {
    minHeight: G.choiceHeight,
    borderRadius: G.choiceRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.cardRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.inline,
    paddingHorizontal: space.inline + space.pair,
  },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 0, paddingVertical: space.related },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: sheetColors.track },
  bare: { backgroundColor: 'transparent' },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
  grow: { flex: 1 },
  centerText: { textAlign: 'center' },
  search: {
    height: G.choiceHeight,
    borderRadius: G.choiceRadius,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.sheet,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.inline,
    paddingHorizontal: space.inline + space.pair,
  },
  searchField: { flex: 1, height: G.choiceHeight, padding: 0 },
  ask: { paddingHorizontal: space.tight, paddingBottom: space.pair },
});
