import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { radius, spacing } from '@/constants/theme';
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
            paddingTop: insets.top + 28,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 12,
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
 * Stage empty: optional room title (28) + subject + optional fact caption + optional black CTA.
 * With a room title the subject is 40, like a Home day; without one it stays the 56 display.
 */
export function PaperEmpty({
  title,
  subject,
  caption,
  action,
  testID,
}: {
  title?: string;
  subject: string;
  caption?: string;
  action?: { title: string; onPress: () => void; testID?: string };
  testID?: string;
}) {
  const { colors, type } = useTheme();
  if (title) {
    return (
      <View testID={testID} style={{ flex: 1 }}>
        <View style={{ gap: spacing.s }}>
          <Text style={type.planTitle} maxFontSizeMultiplier={1.2} accessibilityRole="header">
            {title}
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Text style={type.displayDay} maxFontSizeMultiplier={1.2}>
              {subject}
            </Text>
            {caption ? (
              <Text style={[type.kicker, { color: colors.tertiaryLabel }]}>{caption}</Text>
            ) : null}
          </View>
        </View>
        {action ? (
          <View style={{ paddingTop: 28 }}>
            <Button
              title={action.title}
              variant="black"
              onPress={action.onPress}
              testID={action.testID}
            />
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View testID={testID} style={{ gap: spacing.s, flex: 1 }}>
      <View style={{ gap: spacing.sm }}>
        <Text style={type.display} maxFontSizeMultiplier={1.2}>
          {subject}
        </Text>
        {caption ? <Text style={type.kicker}>{caption}</Text> : null}
      </View>
      {action ? (
        <Button
          title={action.title}
          variant="black"
          onPress={action.onPress}
          testID={action.testID}
        />
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
        gap: 4,
        paddingTop: 4,
        paddingBottom: 12,
        opacity: pressed ? 0.55 : 1,
      })}>
      <SymbolView name="chevron.left" tintColor={colors.label} size={20} weight="medium" />
      {label ? (
        <Text style={[type.body, { color: colors.label, fontWeight: '400' }]}>{label}</Text>
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
  testID,
}: {
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
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
        paddingVertical: 14,
        gap: 12,
        opacity: pressed && onPress ? 0.7 : 1,
      })}>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
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
      {trailing ? <View style={{ flexShrink: 0 }}>{trailing}</View> : null}
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
      style={({ pressed }) => ({ paddingTop: 16, opacity: pressed ? 0.55 : 1 })}>
      <Text style={[type.kicker, { textAlign: 'center' }]}>{title}</Text>
    </Pressable>
  );
}

export function PaperGrabber() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 12 }}>
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
    <View style={{ flex: 1, backgroundColor: '#00000047', justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onScrimPress} accessibilityLabel="Dismiss" />
      <View
        style={{
          backgroundColor: colors.systemBackground,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderCurve: 'continuous',
          paddingHorizontal: 24,
          paddingTop: 8,
        }}>
        <PaperGrabber />
        {children}
      </View>
    </View>
  );
}
