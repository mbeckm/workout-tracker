import { SymbolView } from 'expo-symbols';
import {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  type ReactNode,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, type ThemeColors, type ThemeType } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

export function GroupedScreen({
  children,
  keyboardShouldPersistTaps,
}: {
  children: ReactNode;
  keyboardShouldPersistTaps?: 'handled';
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.secondarySystemBackground }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentContainerStyle={{
        padding: spacing.md,
        gap: spacing.lg,
        paddingBottom: spacing.xl,
      }}>
      {children}
    </ScrollView>
  );
}

export function GroupedSection({
  title,
  children,
  separatorInset,
}: {
  title?: string;
  children: ReactNode;
  separatorInset?: number;
}) {
  const { colors, type } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <Text
          style={[
            type.caption,
            {
              paddingHorizontal: spacing.md,
              textTransform: 'uppercase',
              color: colors.tertiaryLabel,
            },
          ]}>
          {title}
        </Text>
      ) : null}
      <GroupedList separatorInset={separatorInset}>{children}</GroupedList>
    </View>
  );
}

export function GroupedList({
  children,
  separatorInset = spacing.md,
}: {
  children: ReactNode;
  separatorInset?: number;
}) {
  const { colors } = useTheme();
  const items = Children.toArray(children);
  return (
    <View
      style={{
        backgroundColor: colors.systemBackground,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}>
      {items.map((child, index) => (
        <Fragment key={isValidElement(child) && child.key != null ? String(child.key) : String(index)}>
          {index > 0 ? (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.separator,
                marginLeft: separatorInset,
              }}
            />
          ) : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

type ListRowProps = Omit<PressableProps, 'children'> & {
  chevron?: boolean;
  destructive?: boolean;
  accent?: boolean;
  accessory?: ReactNode;
  title?: string;
  subtitle?: string;
  value?: string;
  children?: ReactNode;
};

export const ListRow = forwardRef<View, ListRowProps>(function ListRow(
  {
    chevron = false,
    destructive = false,
    accent = false,
    accessory,
    title,
    subtitle,
    value,
    children,
    style,
    accessibilityRole,
    ...pressableProps
  },
  ref,
) {
  const { colors, type } = useTheme();
  const stacked = children != null || subtitle != null;
  const titleColor = destructive
    ? colors.systemRed
    : accent
      ? colors.systemBlue
      : colors.label;
  return (
    <Pressable
      ref={ref}
      accessibilityRole={
        accessibilityRole ?? (pressableProps.onPress || chevron ? 'button' : undefined)
      }
      style={(state) => {
        const base: ViewStyle = {
          minHeight: stacked ? 72 : 44,
          paddingHorizontal: spacing.md,
          paddingVertical: stacked ? spacing.md + spacing.xs : spacing.s,
          flexDirection: 'row',
          alignItems: children != null ? 'flex-start' : 'center',
          gap: spacing.sm,
          opacity: state.pressed ? 0.7 : 1,
        };
        const extra = typeof style === 'function' ? style(state) : style;
        return extra ? [base, extra] : base;
      }}
      {...pressableProps}>
      <View style={{ flex: 1, gap: subtitle ? spacing.xs : 0 }}>
        {children ?? (
          <>
            {title ? (
              <Text style={[type.body, { color: titleColor }]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={type.subhead} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {accessory}
      {value ? (
        <Text style={[type.body, { color: colors.secondaryLabel, flexShrink: 0 }]}>{value}</Text>
      ) : null}
      {chevron ? (
        <SymbolView
          name="chevron.right"
          tintColor={colors.tertiaryLabel}
          size={12}
          style={{ flexShrink: 0 }}
        />
      ) : null}
    </Pressable>
  );
});

export function EmptyState({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  const { type } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.md,
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.sm,
      }}>
      {title ? <Text style={[type.title, { textAlign: 'center' }]}>{title}</Text> : null}
      <Text style={[type.subhead, { textAlign: 'center' }]}>{message}</Text>
      {action}
    </View>
  );
}

export function groupFieldStyle(
  theme: { colors: ThemeColors; type: ThemeType },
  extra?: StyleProp<TextStyle>,
): StyleProp<TextStyle> {
  return [
    {
      fontSize: theme.type.headline.fontSize,
      fontWeight: theme.type.headline.fontWeight,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.s,
      color: theme.colors.label,
    },
    extra,
  ];
}
