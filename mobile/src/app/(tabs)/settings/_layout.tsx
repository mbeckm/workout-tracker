import { Stack } from 'expo-router/stack';

export default function SettingsStack() {
  return <Stack screenOptions={{ animation: 'none', headerShown: false }} />;
}
