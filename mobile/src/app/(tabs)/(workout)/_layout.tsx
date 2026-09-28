import { Stack } from 'expo-router/stack';

export default function WorkoutStack() {
  return (
    <Stack screenOptions={{ animation: 'none', headerShown: false }}>
      {/*
        Home's day name is the native large title (trim-ui → Typography), collapsing into the
        system glass bar on scroll. Transparent so the bar is the system's own material, with
        the scroll-edge effect between it and the content (trim-ui → Liquid Glass). The title
        itself comes from the screen.
      */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerLargeTitleEnabled: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
        }}
      />
    </Stack>
  );
}
