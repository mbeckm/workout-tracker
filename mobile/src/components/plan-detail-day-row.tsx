import { Link, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View, type AccessibilityActionEvent } from 'react-native';

import { SortableHandle, useSortableLifted } from '@/components/sortable-column';
import { formatExerciseNames } from '@/domain/day-facts';
import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';
import { iconSize, PRESSED_OPACITY, space, TOUCH_TARGET } from '@/constants/theme';

/** The trailing lane the drag handle takes: its target plus the gutter it lines up with. */
const HANDLE_LANE = TOUCH_TARGET + space.gutter - (TOUCH_TARGET - iconSize.control) / 2;

export type PlanDayActions = {
  onRename: () => void;
  onDuplicate: () => void;
  /** VoiceOver only (sighted users drag the handle). Omitted for the first day. */
  onMoveUp?: () => void;
  /** VoiceOver only (sighted users drag the handle). Omitted for the last day. */
  onMoveDown?: () => void;
  /** Omitted when this is the plan's only day. */
  onRemove?: () => void;
};

/**
 * A day on the plan editor: title 17 + exercise names (2 lines). An empty day's meta is the
 * action itself (`+ Add exercises`, label color) and goes straight to the picker.
 * Long-press opens the native context menu; the trailing handle drags to reorder (trim-ui →
 * Reorder); VoiceOver gets every action, Move up / down included.
 *
 * The row spans the screen edge to edge (it pads its own gutter) on an opaque background, so
 * the context menu lifts a clean cell and a dragged row covers the ones it passes. Render it
 * inside a full-width `SortableColumn`, keyed by the day's id.
 */
export function PlanDetailDayRow({
  day,
  index,
  href,
  reorderable,
  actions,
}: {
  day: WorkoutDay;
  index: number;
  href: Href;
  /** Shows the drag handle (a plan with more than one day). */
  reorderable: boolean;
  actions: PlanDayActions;
}) {
  const { colors, type } = useTheme();
  // Lifted by the handle: the row wears the secondary surface over the rows it passes.
  const fill = useSortableLifted(day.id) ? colors.secondarySystemBackground : colors.systemBackground;
  const names = day.exercises.map((exercise) => exercise.name.trim()).filter(Boolean);
  const count = names.length;
  const exerciseWord = count === 1 ? 'exercise' : 'exercises';

  const a11yActions = [
    { name: 'rename', label: 'Rename day' },
    { name: 'duplicate', label: 'Duplicate day' },
    ...(actions.onMoveUp ? [{ name: 'moveUp', label: 'Move up' }] : []),
    ...(actions.onMoveDown ? [{ name: 'moveDown', label: 'Move down' }] : []),
    ...(actions.onRemove ? [{ name: 'delete', label: 'Remove day' }] : []),
  ];

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'rename':
        actions.onRename();
        break;
      case 'duplicate':
        actions.onDuplicate();
        break;
      case 'moveUp':
        actions.onMoveUp?.();
        break;
      case 'moveDown':
        actions.onMoveDown?.();
        break;
      case 'delete':
        actions.onRemove?.();
        break;
      default:
        break;
    }
  };

  return (
    <View style={{ backgroundColor: fill }}>
      <Link href={href} asChild>
        <Link.Trigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              count > 0
                ? `${day.title}, ${count} ${exerciseWord}`
                : `${day.title}, no exercises. Add exercises`
            }
            accessibilityHint={count > 0 ? 'Opens this training day' : 'Opens the exercise list'}
            accessibilityActions={a11yActions}
            onAccessibilityAction={onAccessibilityAction}
            testID={`plan-detail-day-${index}`}
            style={({ pressed }) => ({ width: '100%', opacity: pressed ? PRESSED_OPACITY : 1 })}>
            {/* Padding lives on this View: Link asChild doesn't forward a style function on web. */}
            <View
              style={{
                paddingVertical: space.inset,
                paddingLeft: space.gutter,
                // Leaves the handle's lane free (it sits on top, outside the menu trigger).
                paddingRight: reorderable ? HANDLE_LANE : space.gutter,
                gap: space.pair,
                backgroundColor: fill,
              }}>
              <Text style={type.row} numberOfLines={1}>
                {day.title}
              </Text>
              {count > 0 ? (
                <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={2}>
                  {formatExerciseNames(names)}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
                  <SymbolView name="plus" tintColor={colors.label} size={iconSize.caption} weight="semibold" />
                  <Text style={[type.kicker, { color: colors.label }]}>Add exercises</Text>
                </View>
              )}
            </View>
          </Pressable>
        </Link.Trigger>
        <Link.Menu>
          <Link.MenuAction title="Rename" icon="pencil" onPress={actions.onRename} />
          <Link.MenuAction title="Duplicate" icon="plus.square.on.square" onPress={actions.onDuplicate} />
          <Link.MenuAction
            title="Remove"
            icon="trash"
            destructive
            hidden={!actions.onRemove}
            onPress={() => actions.onRemove?.()}
          />
        </Link.Menu>
      </Link>
      {reorderable ? (
        // Outside the menu trigger, so holding the handle drags instead of opening the menu.
        // The row lifts on touch-down and follows the finger (trim-ui §8, Row reorder).
        <SortableHandle rowKey={day.id}>
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              // The glyph, not its touch target, lines up with the gutter.
              right: space.gutter - (TOUCH_TARGET - iconSize.control) / 2,
              width: TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <SymbolView
              name="line.3.horizontal"
              size={iconSize.control}
              tintColor={colors.tertiaryLabel}
              fallback={<Text style={[type.body, { color: colors.tertiaryLabel }]}>≡</Text>}
            />
          </View>
        </SortableHandle>
      ) : null}
    </View>
  );
}
