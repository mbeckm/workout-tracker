import { Link, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View, type AccessibilityActionEvent } from 'react-native';

import type { WorkoutDay } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

export type PlanDayActions = {
  onRename: () => void;
  onDuplicate: () => void;
  /** Omitted for the first day. */
  onMoveUp?: () => void;
  /** Omitted for the last day. */
  onMoveDown?: () => void;
  /** Omitted when this is the plan's only day. */
  onRemove?: () => void;
};

/**
 * A day on the plan editor: title 17 + exercise names (2 lines). An empty day's meta is the
 * action itself (`+ Add exercises`, label color) and goes straight to the picker.
 * Long-press opens the native context menu; VoiceOver gets the same actions.
 */
export function PlanDetailDayRow({
  day,
  index,
  href,
  isFirst = false,
  actions,
}: {
  day: WorkoutDay;
  index: number;
  href: Href;
  isFirst?: boolean;
  actions: PlanDayActions;
}) {
  const { colors, type } = useTheme();
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
          style={({ pressed }) => ({ width: '100%', opacity: pressed ? 0.7 : 1 })}>
          {/* Padding lives on this View: Link asChild doesn't forward a style function on web. */}
          <View style={{ paddingTop: isFirst ? 0 : 14, paddingBottom: 14, gap: 2 }}>
            <Text style={type.row} numberOfLines={1}>
              {day.title}
            </Text>
            {count > 0 ? (
              <Text style={[type.kicker, { color: colors.tertiaryLabel }]} numberOfLines={2}>
                {names.join(' · ')}
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <SymbolView name="plus" tintColor={colors.label} size={15} weight="semibold" />
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
          title="Move up"
          icon="arrow.up"
          hidden={!actions.onMoveUp}
          onPress={() => actions.onMoveUp?.()}
        />
        <Link.MenuAction
          title="Move down"
          icon="arrow.down"
          hidden={!actions.onMoveDown}
          onPress={() => actions.onMoveDown?.()}
        />
        <Link.MenuAction
          title="Remove"
          icon="trash"
          destructive
          hidden={!actions.onRemove}
          onPress={() => actions.onRemove?.()}
        />
      </Link.Menu>
    </Link>
  );
}
