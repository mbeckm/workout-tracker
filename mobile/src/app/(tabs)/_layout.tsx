import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/theme/theme-context';

export default function TabsLayout() {
  const { colors, scheme } = useTheme();
  return (
    // The system's glass bar (trim-ui §5 Liquid Glass): no background, no hairline, and it
    // turns clear at the scroll edge. Light and dark are JS-only, so the material follows
    // Trim's scheme instead of the OS appearance.
    <NativeTabs
      tintColor={colors.label}
      iconColor={{ default: colors.tertiaryLabel, selected: colors.label }}
      labelStyle={{
        default: { color: colors.tertiaryLabel },
        selected: { color: colors.label },
      }}
      blurEffect={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      minimizeBehavior="never"
      disableIndicator
      labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="(workout)" disableAutomaticContentInsets testID="tab-workout">
        <NativeTabs.Trigger.Icon sf="dumbbell" md="fitness_center" />
        <NativeTabs.Trigger.Label>Workout</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plans" disableAutomaticContentInsets testID="tab-plans">
        <NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
        <NativeTabs.Trigger.Label>Plans</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress" disableAutomaticContentInsets testID="tab-progress">
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="show_chart" />
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history" disableAutomaticContentInsets testID="tab-history">
        <NativeTabs.Trigger.Icon sf="clock" md="schedule" />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" disableAutomaticContentInsets testID="tab-settings">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
