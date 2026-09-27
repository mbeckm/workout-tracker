import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CATALOG,
  catalogKey,
  EXERCISE_JUMP_CHIP_ORDER,
  exerciseCatalogDisplayText,
  exercisePickerMeta,
  EXERCISE_CATALOG_NOTICE_MESSAGE,
  groupExercisesForBrowse,
  offlineCatalogExercises,
  recentOfflineExercises,
  recordExerciseSelection,
  searchExercises,
  searchLocalExercises,
  uniqueCatalogExercises,
} from '@/catalog';
import type {
  ExerciseBrowseSection,
  ExerciseCatalogNotice,
  ExerciseJumpChipTitle,
} from '@/catalog';
import { Button } from '@/components/button';
import { PaperBack } from '@/components/paper';
import { useTheme } from '@/theme/theme-context';
import { clonePrescription, withDay } from '@/domain/helpers';
import type { CustomExerciseDefinition, ExercisePrescription } from '@/domain/types';
import { newId } from '@/domain/types';
import { useWorkoutStore } from '@/store/workout-store';

function addTitle(count: number): string {
  return count <= 0 ? 'Add' : `Add ${count}`;
}

type PickerRow = ExercisePrescription & { listKey: string };

/** EP-2: how a custom exercise is tracked. Meta shows what the plan row will read. */
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

type PickerSection = {
  title: string;
  data: PickerRow[];
};

function withListKeys(
  sections: ExerciseBrowseSection[] | { title: string; data: ExercisePrescription[] }[],
): PickerSection[] {
  return sections.map((section) => ({
    title: section.title,
    data: section.data
      .filter((item): item is ExercisePrescription => Boolean(item?.name))
      .map((item) => ({
        ...item,
        listKey: `${section.title}:${catalogKey(item)}`,
      })),
  }));
}

export function ExercisePickerScreen() {
  const { colors, type } = useTheme();
  const { planId, dayId, from, dayTitle } = useLocalSearchParams<{
    planId?: string;
    dayId?: string;
    from?: string;
    dayTitle?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plans, customExercises, updatePlan, saveCustomExercise } = useWorkoutStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ExercisePrescription[]>([]);
  const [recent, setRecent] = useState<ExercisePrescription[]>([]);
  const [activeChip, setActiveChip] = useState<ExerciseJumpChipTitle | null>(null);
  /** The query whose Create row is open on the tracking choice; closes when the query changes. */
  const [choosingFor, setChoosingFor] = useState<string | null>(null);
  const [remote, setRemote] = useState<{
    query: string;
    exercises: ExercisePrescription[];
    notice: ExerciseCatalogNotice | null;
  } | null>(null);
  const listRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const jumpingRef = useRef(false);

  const offline = useMemo(() => offlineCatalogExercises(customExercises), [customExercises]);
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;

  const inDayKeys = useMemo(() => {
    const plan = plans.find((item) => item.id === planId);
    const day = plan?.days.find((item) => item.id === dayId);
    return new Set((day?.exercises ?? []).map((exercise) => catalogKey(exercise)));
  }, [plans, planId, dayId]);

  useEffect(() => {
    let cancelled = false;
    void recentOfflineExercises(customExercises).then((items) => {
      if (!cancelled) {
        setRecent(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [customExercises]);

  useEffect(() => {
    // Remote search is off in 1.0: local results below are the whole answer.
    if (!trimmedQuery || CATALOG.remote === 'off') {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchExercises(trimmedQuery, customExercises, controller.signal)
        .then((response) => {
          setRemote({
            query: trimmedQuery,
            exercises: response.exercises,
            notice: response.notice,
          });
        })
        .catch((error: { name?: string; code?: string }) => {
          if (error?.name === 'AbortError' || error?.code === 'aborted') {
            return;
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, trimmedQuery, customExercises]);

  const results = uniqueCatalogExercises(
    !trimmedQuery
      ? offline
      : remote?.query === trimmedQuery
        ? remote.exercises
        : searchLocalExercises(trimmedQuery, customExercises),
    trimmedQuery,
  );
  const notice = remote?.query === trimmedQuery ? remote.notice : null;

  const browseSections = useMemo(
    () => groupExercisesForBrowse({ exercises: offline, recent }),
    [offline, recent],
  );

  const jumpChips = useMemo(() => {
    const present = new Set(browseSections.map((section) => section.title));
    return EXERCISE_JUMP_CHIP_ORDER.filter((title) => present.has(title));
  }, [browseSections]);

  const sections: PickerSection[] = useMemo(() => {
    if (!isSearching) {
      return withListKeys(browseSections);
    }
    return withListKeys([{ title: '', data: results }]);
  }, [browseSections, isSearching, results]);

  const shownChip: ExerciseJumpChipTitle | null = isSearching
    ? null
    : activeChip && jumpChips.includes(activeChip)
      ? activeChip
      : (jumpChips[0] ?? null);

  const canCreateCustom =
    trimmedQuery.length >= 2 &&
    !results.some((item) => item.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showNoResults = isSearching && results.length === 0;
  const choosingKind = canCreateCustom && choosingFor === trimmedQuery;
  const canAdd = selected.length > 0 && Boolean(planId && dayId);

  const jumpToSection = (title: ExerciseJumpChipTitle) => {
    const y = sectionOffsets.current[title];
    if (y == null) {
      return;
    }
    setActiveChip(title);
    jumpingRef.current = true;
    listRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
    setTimeout(() => {
      jumpingRef.current = false;
    }, 450);
  };

  const syncActiveChipFromScroll = (offsetY: number) => {
    if (jumpingRef.current || isSearching) {
      return;
    }
    let next: ExerciseJumpChipTitle | null = null;
    for (const title of jumpChips) {
      const y = sectionOffsets.current[title];
      if (y == null) {
        continue;
      }
      if (offsetY + 24 >= y) {
        next = title;
      }
    }
    if (next) {
      setActiveChip(next);
    }
  };

  const onListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncActiveChipFromScroll(event.nativeEvent.contentOffset.y);
  };

  const toggle = (item: ExercisePrescription) => {
    if (inDayKeys.has(catalogKey(item))) {
      return;
    }
    const key = catalogKey(item);
    setSelected((current) => {
      if (current.some((entry) => catalogKey(entry) === key)) {
        return current.filter((entry) => catalogKey(entry) !== key);
      }
      return [...current, clonePrescription(item)];
    });
  };

  const addSelected = () => {
    const plan = plans.find((item) => item.id === planId);
    if (!plan || !dayId || selected.length === 0) {
      router.back();
      return;
    }

    const day = plan.days.find((item) => item.id === dayId) ?? {
      id: dayId,
      title: dayTitle ? decodeURIComponent(dayTitle) : 'Day 1',
      exercises: [],
    };

    updatePlan(
      withDay(
        {
          ...plan,
          days: plan.days.some((item) => item.id === day.id) ? plan.days : [...plan.days, day],
        },
        day.id,
        (current) => ({
          ...current,
          exercises: [...current.exercises, ...selected],
        }),
      ),
    );

    for (const exercise of selected) {
      void recordExerciseSelection(exercise);
    }

    if (from === 'prescribe') {
      router.back();
      return;
    }

    router.replace(`/prescribe?planId=${plan.id}&dayId=${day.id}`);
  };

  const createCustom = (kind: CustomKind) => {
    const name = exerciseCatalogDisplayText(trimmedQuery);
    if (name.length < 2) {
      return;
    }
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
      (item) => item.customExerciseID === definition.id,
    );
    if (created) {
      setSelected((current) => [...current, clonePrescription(created)]);
      void recordExerciseSelection(created);
    }
    setChoosingFor(null);
    setQuery('');
  };

  const renderRow = (item: PickerRow) => {
    const key = catalogKey(item);
    const isOn = selected.some((entry) => catalogKey(entry) === key);
    const inDay = inDayKeys.has(key);
    const detail = inDay ? 'In this day' : exercisePickerMeta(item);
    return (
      <Pressable
        key={item.listKey}
        accessibilityRole="button"
        accessibilityState={{ selected: isOn, disabled: inDay }}
        disabled={inDay}
        onPress={() => toggle(item)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 44,
          paddingVertical: 8,
          opacity: inDay ? 1 : pressed ? 0.7 : 1,
        })}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text
            style={[type.row, inDay ? { color: colors.secondaryLabel } : null]}
            numberOfLines={1}>
            {item.name}
          </Text>
          {detail ? (
            <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {inDay ? null : (
            <SymbolView
              name={isOn ? 'checkmark.circle.fill' : 'circle'}
              tintColor={isOn ? colors.label : colors.systemGray4}
              size={22}
              weight="regular"
            />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.systemBackground,
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
        }}>
        <PaperBack onPress={() => router.back()} />
        <Text style={[type.planTitle, { paddingBottom: 12 }]}>Exercises</Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minHeight: 36,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: colors.secondarySystemBackground,
          }}>
          <SymbolView
            name="magnifyingglass"
            tintColor={colors.tertiaryLabel}
            size={17}
            weight="regular"
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={colors.tertiaryLabel}
            accessibilityLabel="Search exercises"
            returnKeyType="search"
            testID="exercises-search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            style={{
              flex: 1,
              padding: 0,
              margin: 0,
              fontSize: 17,
              fontWeight: '400',
              lineHeight: 22,
              color: colors.label,
            }}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => setQuery('')}
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
              <SymbolView
                name="xmark.circle.fill"
                tintColor={colors.tertiaryLabel}
                size={17}
                weight="regular"
              />
            </Pressable>
          ) : null}
        </View>

        {notice && isSearching ? (
          <Text style={[type.kicker, { color: colors.tertiaryLabel, paddingTop: 10 }]}>
            {EXERCISE_CATALOG_NOTICE_MESSAGE[notice]}
          </Text>
        ) : null}

        {!isSearching && jumpChips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, marginTop: 12 }}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {jumpChips.map((title) => {
              const isActive = shownChip === title;
              return (
                <Pressable
                  key={title}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  hitSlop={{ top: 6, bottom: 6 }}
                  onPress={() => jumpToSection(title)}
                  style={({ pressed }) => ({
                    minHeight: 32,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive
                      ? colors.systemGray5
                      : colors.secondarySystemBackground,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Text
                    style={[
                      type.kicker,
                      {
                        color: isActive ? colors.secondaryLabel : colors.tertiaryLabel,
                        fontWeight: isActive ? '600' : '400',
                      },
                    ]}>
                    {title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <ScrollView
          ref={listRef}
          style={{ flex: 1, marginTop: 16 }}
          contentContainerStyle={{ paddingBottom: 12, flexGrow: 1, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={onListScroll}
          scrollEventThrottle={16}>
          {showNoResults ? (
            <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>
              No exercises match “{exerciseCatalogDisplayText(trimmedQuery)}.”
            </Text>
          ) : null}

          {sections.map((section, sectionIndex) => (
            <View
              key={section.title || 'results'}
              onLayout={(event) => {
                if (!section.title) {
                  return;
                }
                sectionOffsets.current[section.title] = event.nativeEvent.layout.y;
              }}
              style={{ gap: 8 }}>
              {section.title ? (
                <Text
                  style={[
                    type.caption,
                    {
                      color: colors.tertiaryLabel,
                      paddingTop: sectionIndex === 0 ? 0 : 12,
                      paddingBottom: 0,
                    },
                  ]}>
                  {section.title}
                </Text>
              ) : null}
              {section.data.map((item) => renderRow(item))}
            </View>
          ))}

          {isSearching && canCreateCustom ? (
            // EP-1: always the last peer row of the results, not only on zero matches.
            <View style={{ gap: 8 }} testID="exercises-create-block">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: choosingKind }}
                accessibilityLabel={`Create ${exerciseCatalogDisplayText(trimmedQuery)}`}
                accessibilityHint="Choose how it's tracked"
                testID="exercises-create"
                onPress={() => setChoosingFor(choosingKind ? null : trimmedQuery)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 44,
                  paddingVertical: 8,
                  opacity: pressed ? 0.7 : 1,
                })}>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text style={type.row} numberOfLines={1}>
                    Create “{exerciseCatalogDisplayText(trimmedQuery)}”
                  </Text>
                  <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={1}>
                    {choosingKind ? 'How is it tracked?' : 'Your own exercise'}
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <SymbolView name="plus" tintColor={colors.label} size={17} weight="semibold" />
                </View>
              </Pressable>
              {choosingKind
                ? CUSTOM_KINDS.map((kind) => (
                    <Pressable
                      key={kind.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Track as ${kind.title}`}
                      testID={`exercises-create-${kind.key}`}
                      onPress={() => createCustom(kind)}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        paddingVertical: 8,
                        gap: 2,
                        opacity: pressed ? 0.7 : 1,
                      })}>
                      <Text style={type.row} numberOfLines={1}>
                        {kind.title}
                      </Text>
                      <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={1}>
                        {kind.meta}
                      </Text>
                    </Pressable>
                  ))
                : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={{ paddingBottom: Math.max(insets.bottom, 12), paddingTop: 8 }}>
          <Button
            title={addTitle(selected.length)}
            variant="black"
            testID="exercises-add"
            disabled={!canAdd}
            onPress={addSelected}
          />
        </View>
      </View>
      <Stack.Screen options={{ headerShown: false, title: 'Exercises' }} />
    </>
  );
}
