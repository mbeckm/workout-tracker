import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 12 }}>
        <TabTrigger name="(workout)" href="/">
          <Text>Workout</Text>
        </TabTrigger>
        <TabTrigger name="plans" href="/plans">
          <Text>Plans</Text>
        </TabTrigger>
        <TabTrigger name="progress" href={"/progress" as const}>
          <Text>Progress</Text>
        </TabTrigger>
        <TabTrigger name="history" href="/history">
          <Text>History</Text>
        </TabTrigger>
        <TabTrigger name="settings" href="/settings">
          <Text>Settings</Text>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
