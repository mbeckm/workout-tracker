import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, type ComponentRef } from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { space, TOUCH_TARGET } from '@/constants/theme';

/** Web stand-in for native tabs: same ink as iOS (label selected, tertiary waiting). */
const TabButton = forwardRef<ComponentRef<typeof Pressable>, TabTriggerSlotProps & { title: string }>(
  function TabButton({ title, isFocused, ...props }, ref) {
    const { colors, type } = useTheme();
    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityRole="tab"
        accessibilityState={{ selected: Boolean(isFocused) }}
        style={{ minHeight: TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space.tight }}>
        <Text
          style={[type.caption, { color: isFocused ? colors.brand : colors.tertiaryLabel }]}>
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
          paddingHorizontal: space.inline,
          paddingVertical: space.tight,
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
