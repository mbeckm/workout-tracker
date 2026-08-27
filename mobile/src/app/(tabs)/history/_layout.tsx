import { Stack } from 'expo-router/stack';

export default function HistoryStack() {
  return <Stack screenOptions={{ animation: 'none', headerShown: false }} />;
}
