import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { iconSize, PRESSED_OPACITY, radius, space } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

export function PaperScreen({
  children,
  contentContainerStyle,
  keyboardShouldPersistTaps,
  testID,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
  testID?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
      <ScrollView
        testID={testID}
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          {
            flexGrow: 1,
            paddingTop: insets.top + space.gutter,
            paddingHorizontal: space.gutter,
            paddingBottom: insets.bottom + space.inline,
          },
          contentContainerStyle,
        ]}>
        {children}
      </ScrollView>
      {insets.top > 0 ? (
        // Long lists scroll under the clock and Dynamic Island; keep that strip quiet.
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: colors.systemBackground,
            opacity: 0.94,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Empty state under the native large title: the fact in `title` (`No plans yet`) and one ink
 * action if there is one. No caption (trim-ui §10).
 */
export function PaperEmpty({
  subject,
  action,
  testID,
}: {
  subject: string;
  action?: { title: string; onPress: () => void; testID?: string };
  testID?: string;
}) {
  const { type } = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, gap: space.gutter }}>
      <Text style={type.title}>{subject}</Text>
      {action ? (
        <Button title={action.title} variant="black" onPress={action.onPress} testID={action.testID} />
      ) : null}
    </View>
  );
}

export function PaperBack({ onPress, label }: { onPress: () => void; label?: string }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ? `Back to ${label}` : 'Back'}
      testID={label ? `paper-back-${label.toLowerCase().replace(/\s+/g, '-')}` : 'paper-back'}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.tight,
        paddingTop: space.tight,
        paddingBottom: space.inline,
        opacity: pressed ? PRESSED_OPACITY : 1,
      })}>
      <SymbolView name="chevron.left" tintColor={colors.label} size={iconSize.control} weight="medium" />
      {label ? (
        <Text style={[type.body, { color: colors.label }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

export function PaperRow({
  title,
  meta,
  trailing,
  onPress,
  onLongPress,
  destructive = false,
  link = false,
  testID,
}: {
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  destructive?: boolean;
  /** Opens something outside the app (web page, Mail): link role + trailing arrow. */
  link?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const trailingContent = link ? (
    <SymbolView
      name="arrow.up.right"
      tintColor={colors.tertiaryLabel}
      size={iconSize.caption}
      weight="semibold"
      fallback={<Text style={[type.row, { color: colors.tertiaryLabel }]}>↗</Text>}
    />
  ) : (
    trailing
  );
  return (
    <Pressable
      accessibilityRole={link ? 'link' : onPress ? 'button' : undefined}
      accessibilityLabel={meta ? `${title}, ${meta}` : title}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: space.inset,
        gap: space.inline,
        opacity: pressed && onPress ? PRESSED_OPACITY : 1,
      })}>
      <View style={{ flex: 1, gap: space.pair, minWidth: 0 }}>
        <Text
          style={[type.row, destructive ? { color: colors.systemRed } : null]}
          numberOfLines={2}
          selectable={!onPress}>
          {title}
        </Text>
        {meta ? (
          <Text style={type.kicker} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailingContent ? <View style={{ flexShrink: 0 }}>{trailingContent}</View> : null}
    </Pressable>
  );
}

export function PaperLink({
  title,
  onPress,
  testID,
}: {
  title: string;
  onPress: () => void;
  testID?: string;
}) {
  const { type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ paddingTop: space.inset, opacity: pressed ? PRESSED_OPACITY : 1 })}>
      <Text style={[type.kicker, { textAlign: 'center' }]}>{title}</Text>
    </Pressable>
  );
}

export function PaperGrabber() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: space.inline }}>
      <View
        style={{
          width: 36,
          height: 5,
          borderRadius: radius.full,
          backgroundColor: colors.systemGray4,
        }}
      />
    </View>
  );
}

export function PaperSheetFrame({
  children,
  onScrimPress,
}: {
  children: ReactNode;
  onScrimPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onScrimPress} accessibilityLabel="Dismiss" />
      <View
        style={{
          backgroundColor: colors.systemBackground,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderCurve: 'continuous',
          paddingHorizontal: space.gutter,
          paddingTop: space.related,
        }}>
        <PaperGrabber />
        {children}
      </View>
    </View>
  );
}
