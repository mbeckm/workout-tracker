import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, type ComponentRef } from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme/theme-context';

/** Web stand-in for native tabs: same ink as iOS (label selected, tertiary waiting). */
const TabButton = forwardRef<ComponentRef<typeof Pressable>, TabTriggerSlotProps & { title: string }>(
  function TabButton({ title, isFocused, ...props }, ref) {
    const { colors } = useTheme();
    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityRole="tab"
        accessibilityState={{ selected: Boolean(isFocused) }}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: isFocused ? colors.label : colors.tertiaryLabel,
          }}>
          {title}
        </Text>
      </Pressable>
    );
  },
);

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingHorizontal: 12,
          paddingVertical: 4,
          backgroundColor: colors.systemBackground,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        }}>
        <TabTrigger name="(workout)" href="/" asChild>
          <TabButton title="Workout" />
        </TabTrigger>
        <TabTrigger name="plans" href="/plans" asChild>
          <TabButton title="Plans" />
        </TabTrigger>
        <TabTrigger name="progress" href={'/progress' as const} asChild>
          <TabButton title="Progress" />
        </TabTrigger>
        <TabTrigger name="history" href="/history" asChild>
          <TabButton title="History" />
        </TabTrigger>
        <TabTrigger name="settings" href="/settings" asChild>
          <TabButton title="Settings" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
