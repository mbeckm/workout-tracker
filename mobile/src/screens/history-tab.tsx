import { Link } from 'expo-router';
import { useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PrCrownCount } from '@/components/pr-crown';
import { PRESSED_OPACITY, space } from '@/constants/theme';
import {
  formatHistoryMonth,
  formatHistorySessionMeta,
  formatHistoryWhenInMonth,
  formatPaperMinutes,
  formatSessionsCount,
  personalBestCount,
} from '@/domain/helpers';
import { formatPrCount } from '@/domain/set-lines';
import type { LoggedWorkout } from '@/domain/types';
import { confirmDeleteWorkout } from '@/screens/history-session';
import { useTheme } from '@/theme/theme-context';
import { useWorkoutStore } from '@/store/workout-store';

/** Width of the revealed Delete action, like a system list's. */
const DELETE_ACTION_WIDTH = 88;
/** A swipe past this share of the row commits the delete (it still confirms). */
const FULL_SWIPE_SHARE = 0.5;

function groupByMonth(workouts: LoggedWorkout[]) {
  const groups: { key: string; label: string; workouts: LoggedWorkout[] }[] = [];

  for (const workout of workouts) {
    const date = new Date(workout.completedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = groups[groups.length - 1];
    if (current?.key === key) {
      current.workouts.push(workout);
    } else {
      groups.push({ key, label: formatHistoryMonth(workout.completedAt), workouts: [workout] });
    }
  }

  return groups;
}

/**
 * The red Delete behind a row. It stretches with the drag, and past `fullSwipe` it arms a
 * full-swipe delete (one light tick when it arms, like a system list).
 */
function DeleteAction({
  translation,
  fullSwipe,
  onArm,
  onPress,
}: {
  translation: SharedValue<number>;
  fullSwipe: number;
  onArm: (armed: boolean) => void;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  const style = useAnimatedStyle(() => ({
    width: Math.max(DELETE_ACTION_WIDTH, -translation.value),
  }));
  useAnimatedReaction(
    () => -translation.value > fullSwipe,
    (armed, previous) => {
      if (previous !== null && armed !== previous) {
        scheduleOnRN(onArm, armed);
      }
    },
    [fullSwipe, onArm],
  );

  return (
    <Animated.View style={[{ backgroundColor: colors.systemRed }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete workout"
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: space.inset,
          opacity: pressed ? PRESSED_OPACITY : 1,
        })}>
        {/* White on red in both schemes, like the system's swipe actions. */}
        <Text style={[type.body, { color: colors.onTint }]} numberOfLines={1}>
          Delete
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Tap opens the session. Swipe left reveals Delete (a full swipe commits it); long-press opens
 * the native context menu with the same Delete; VoiceOver gets it as an action. Every path
 * confirms, because a completed workout can't come back (trim-ui → Forgiveness).
 */
function SessionRow({
  workout,
  prCount,
  showDivider,
  onDelete,
}: {
  workout: LoggedWorkout;
  prCount: number;
  showDivider: boolean;
  onDelete: () => void;
}) {
  const { colors, type } = useTheme();
  const { width } = useWindowDimensions();
  const swipeable = useRef<SwipeableMethods>(null);
  const armed = useRef(false);
  const meta = formatHistorySessionMeta(workout, undefined, { inMonth: true });
  const accessibility =
    prCount > 0
      ? `${workout.title}, ${meta}, ${formatPrCount(prCount)}`
      : `${workout.title}, ${meta}`;

  const confirm = () =>
    confirmDeleteWorkout(workout, onDelete, () => swipeable.current?.close());

  // No haptic when armed: trim-ui §8 lists every haptic, and this isn't one of them.
  const arm = (next: boolean) => {
    armed.current = next;
  };

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1}
      overshootRight
      rightThreshold={DELETE_ACTION_WIDTH / 2}
      onSwipeableWillOpen={() => {
        if (armed.current) {
          armed.current = false;
          confirm();
        }
      }}
      renderRightActions={(_progress, translation) => (
        <DeleteAction
          translation={translation}
          fullSwipe={width * FULL_SWIPE_SHARE}
          onArm={arm}
          onPress={confirm}
        />
      )}>
      <Link href={`/history-session?id=${encodeURIComponent(workout.id)}`} asChild>
        <Link.Trigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibility}
            accessibilityActions={[{ name: 'delete', label: 'Delete workout' }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'delete') {
                confirm();
              }
            }}
            // iOS long-press belongs to the native context menu; elsewhere it is the shortcut.
            onLongPress={Platform.OS === 'ios' ? undefined : confirm}
            testID={`history-session-${workout.id}`}
            style={({ pressed }) => ({ opacity: pressed ? PRESSED_OPACITY : 1 })}>
            {/* Layout lives on an inner View: Link's Slot does not carry a style function on web.
                Opaque, so the red action only shows where the row has moved away. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.inline,
                paddingVertical: space.inset,
                paddingHorizontal: space.margin,
                backgroundColor: colors.systemBackground,
              }}>
              <View style={{ flex: 1, minWidth: 0, gap: space.pair }}>
                <Text style={type.row} numberOfLines={2}>
                  {workout.title}
                </Text>
                <Text style={type.caption} numberOfLines={1}>
                  {formatHistoryWhenInMonth(workout.completedAt)}
                </Text>
              </View>
              {prCount > 0 ? <PrCrownCount count={prCount} /> : null}
              <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>
                {formatPaperMinutes(workout.durationMinutes)}
              </Text>
              {showDivider ? (
                <View
                  style={{
                    position: 'absolute',
                    left: space.margin,
                    right: space.margin,
                    bottom: 0,
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: colors.separator,
                  }}
                />
              ) : null}
            </View>
          </Pressable>
        </Link.Trigger>
        <Link.Menu>
          <Link.MenuAction title="Delete" icon="trash" destructive onPress={confirm} />
        </Link.Menu>
      </Link>
    </ReanimatedSwipeable>
  );
}

/**
 * History (trim-ui → History): native large title, then months. Each month is a section
 * caption with its amount in the trailing lane, over its sessions with hairlines between.
 * Rhythm, measured text to text (trim-ui → Layout → Under a large title): the large title →
 * the first month `section`, counted from the bar, so it always reads a little looser than the
 * months below; a month's last row → the next month `section` (the row's own 16 + 16); a
 * month's caption → its first row `related`. Months part by their caption and the missing
 * hairline, not by extra air, so the title stays the largest gap on the page.
 */
export function HistoryTab() {
  const { colors, type } = useTheme();
  const { workoutHistory, deleteWorkout } = useWorkoutStore();
  const groups = useMemo(() => groupByMonth(workoutHistory), [workoutHistory]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: space.section, paddingBottom: space.section }}>
      {workoutHistory.length === 0 ? (
        <View testID="history-empty" style={{ paddingHorizontal: space.margin }}>
          <Text style={type.title}>No workouts yet</Text>
        </View>
      ) : (
        // The last row's own bottom padding (16) + 16 = `section` from its text to the next month.
        <View style={{ gap: space.inset }}>
          {groups.map((group) => (
            <View key={group.key} style={{ gap: space.related }}>
              <View
                accessible
                accessibilityRole="header"
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: space.inline,
                  paddingHorizontal: space.margin,
                  // The rows below are pulled up into this caption's padding and paint an
                  // opaque swipe background; drawn above them, the caption never clips.
                  zIndex: 1,
                }}>
                <Text style={[type.caption, { flexShrink: 1 }]}>{group.label}</Text>
                <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]}>
                  {formatSessionsCount(group.workouts.length)}
                </Text>
              </View>
              {/* Rows pad themselves: the caption's 8 is to the row's text, not its edge. */}
              <View style={{ marginTop: -space.inset }}>
                {group.workouts.map((workout, index) => (
                  <SessionRow
                    key={workout.id}
                    workout={workout}
                    prCount={personalBestCount(workout, workoutHistory)}
                    showDivider={index < group.workouts.length - 1}
                    onDelete={() => deleteWorkout(workout.id)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
