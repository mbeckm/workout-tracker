import { Stack } from 'expo-router/stack';

export default function WorkoutStack() {
  return (
    <Stack screenOptions={{ animation: 'none', headerShown: false }}>
      {/*
        Home v3 has no navigation bar: the streak and the week head the page (trim-ui §13 Home).
        The classic Home (`screens/workout-tab.tsx`) needs `headerShown`, a large title and a
        transparent header here to come back.
      */}
      <Stack.Screen name="index" />
    </Stack>
  );
}
