import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Button } from '@/components/button';
import { fontScaleCap, iconSize, PRESSED_OPACITY, radius, ROW_GLYPH_SLOT, space } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

/**
 * A row's leading glyph grows with Dynamic Type like the `row` text beside it (trim-ui §7: a
 * symbol takes its text's size), capped where 17pt text is capped.
 */
export function useRowGlyph() {
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(Math.max(fontScale, 1), fontScaleCap.text);
  return { size: Math.round(iconSize.row * scale), slot: Math.round(ROW_GLYPH_SLOT * scale) };
}

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
  return (
    <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
      <ScrollView
        testID={testID}
        style={{ flex: 1, backgroundColor: colors.systemBackground }}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        // Under the native bar (transparent, with the system scroll-edge effect): content
        // scrolls under chrome, never under a painted strip (trim-ui §5 Liquid Glass).
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          {
            flexGrow: 1,
            paddingTop: space.related,
            paddingHorizontal: space.gutter,
            paddingBottom: space.gutter,
          },
          contentContainerStyle,
        ]}>
        {children}
      </ScrollView>
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
  symbol,
  trailing,
  onPress,
  onLongPress,
  destructive = false,
  link = false,
  testID,
}: {
  title: string;
  meta?: string;
  /**
   * Leading glyph for a command or setting row (Settings), in the same lane as the editors'
   * action rows. Content rows (plans, days, sessions, lifts) never take one: the name is the
   * identity (trim-ui §7).
   */
  symbol?: SFSymbol;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  destructive?: boolean;
  /** Opens something outside the app (web page, Mail): link role + trailing arrow. */
  link?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const glyph = useRowGlyph();
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
      {symbol ? (
        // Centred on a one-line row like the editors' action rows; with a meta line it stays
        // on the name's line instead of drifting between the two.
        <View
          style={{
            width: glyph.slot,
            height: glyph.slot,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: meta ? 'flex-start' : 'center',
            flexShrink: 0,
          }}>
          <SymbolView
            name={symbol}
            tintColor={destructive ? colors.systemRed : colors.label}
            size={glyph.size}
            weight="medium"
          />
        </View>
      ) : null}
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

/**
 * Sheet grabber → the sheet's top edge (trim-ui → Components → Sheets). One inset on every
 * sheet, native and custom: iOS draws its own grabber 5pt from the edge, tight under the
 * floating sheet's large corners, so native sheets hide it and draw this one instead.
 */
export const GRABBER_INSET = space.inline;

/**
 * The sheet's grabber. In flow at the top of a custom sheet (it is the drag handle there,
 * `space.inset` above the title), or `overlay` on a native `formSheet`, where the system's
 * pan owns the drag and the content keeps its own top padding.
 */
export function PaperGrabber({ overlay = false }: { overlay?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents={overlay ? 'none' : 'auto'}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        { alignItems: 'center', paddingTop: GRABBER_INSET },
        overlay
          ? { position: 'absolute', top: 0, left: 0, right: 0 }
          : { paddingBottom: space.inset },
      ]}>
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
        }}>
        <PaperGrabber />
        {children}
      </View>
    </View>
  );
}
