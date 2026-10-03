import { ThemeProvider as NavigationThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { KeyboardProvider } from '@/keyboard';

import { colors, darkColors, sheetColors, spacing, type } from '@/constants/theme';
import { DeviceProvider, useDevice } from '@/device/device-context';
import { FinishProvider } from '@/device/finish';
import { logCommandForLink } from '@/device/log-link';
import { parseWorkoutLogUrl } from '@/live-activity/url';
import { startEntitlementSync } from '@/purchases/purchases';
import { progressDemoMode, shouldUseProgressDemo } from '@/store/progress-demo';
import { WorkoutProvider, useWorkoutStore } from '@/store/workout-store';
import { ToastHost } from '@/components/toast';
import { trackScreen } from '@/analytics/analytics';
import { useTheme } from '@/theme/theme-context';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * The old routes still pushed above the device draw on the navigator's background; sheets and
 * moments are always dark (D2), so they get the dark one. gadget: delete in Phase 10.
 */
const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.brand,
    background: darkColors.systemBackground,
    card: darkColors.systemBackground,
    text: darkColors.label,
    border: darkColors.separator,
    notification: darkColors.systemRed,
  },
};

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || 'Something went wrong.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Trim root error', error, info.componentStack);
  }

  render() {
    if (this.state.message) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.systemBackground,
            padding: spacing.lg,
            justifyContent: 'center',
          }}>
          <Text style={type.title}>Trim hit an error</Text>
          <Text style={[type.body, { marginTop: spacing.sm }]}>{this.state.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

function DeviceApp() {
  return (
    <FinishProvider>
      <DeviceProvider>
        <NavigationThemeProvider value={NAVIGATION_THEME}>
          <RootNav />
        </NavigationThemeProvider>
        <ScreenTracker />
        {/* Above SheetHost (which lives in the device screen); the paywall modal mounts its own. */}
        <ToastHost />
      </DeviceProvider>
    </FinishProvider>
  );
}

/** One `$screen` event per route change; the pathname carries no ids or params. */
function ScreenTracker() {
  const pathname = usePathname();
  useEffect(() => {
    trackScreen(pathname);
  }, [pathname]);
  return null;
}

function RootNav() {
  // gadget: the old routes below still read the (always dark) compatibility theme.
  const { colors: themeColors } = useTheme();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const segments = useSegments();
  const { open } = useDevice();
  const { isHydrated, hasCompletedOnboarding, applyEntitlement } = useWorkoutStore();
  const handledInitialUrl = useRef(false);
  const openedProgressDemo = useRef(false);

  // Keeps isPro live; a no-op in Expo Go, on web, and without a store key.
  useEffect(
    () => (isHydrated ? startEntitlementSync(applyEntitlement) : undefined),
    [isHydrated, applyEntitlement],
  );

  // Onboarding closes its own one-way door: in one tap it saves the plan, completes
  // onboarding, replaces itself with the device and opens the paywall or plan editor on top.
  // Segments can trail that state by a render, so while that exit is in flight a stale
  // `onboarding` segment must not trigger a second replace here (it would remove the
  // paywall). Once the app has been reached, any way back into onboarding (a stale link, web
  // history) is sent to the device.
  const onboardingExit = useRef<'none' | 'pending' | 'done'>('none');
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const onOnboarding = segments[0] === 'onboarding';
    if (!hasCompletedOnboarding) {
      onboardingExit.current = 'pending';
      if (!onOnboarding) {
        router.replace('/onboarding');
        return;
      }
    } else if (!onOnboarding) {
      onboardingExit.current = 'done';
    } else if (onboardingExit.current !== 'pending') {
      router.replace('/');
    }
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [hasCompletedOnboarding, isHydrated, router, segments]);

  // Dev only (EXPO_PUBLIC_PROGRESS_DEMO): open Progress, or a lift's or body's detail, on the device.
  useEffect(() => {
    const mode = progressDemoMode();
    if (!isHydrated || !hasCompletedOnboarding || !shouldUseProgressDemo() || openedProgressDemo.current) {
      return;
    }
    openedProgressDemo.current = true;
    if (mode === 'lift') {
      open({ sheet: 'lift', params: { name: 'Bench press' } });
    } else if (mode === 'body') {
      open({ sheet: 'body', params: { metric: 'waistCm' } });
    } else {
      open({ sheet: 'progress' });
    }
  }, [hasCompletedOnboarding, isHydrated, open]);

  // Live Activity taps open scratchworkout://…/log?planId&dayId&exerciseId. `+native-intent`
  // keeps the router on the device; here the same URL puts the device in log mode.
  useEffect(() => {
    if (!isHydrated || !hasCompletedOnboarding) {
      return;
    }

    const openFromLiveActivity = (url: string) => {
      const link = parseWorkoutLogUrl(url);
      if (link) {
        open(logCommandForLink(link));
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => openFromLiveActivity(url));
    // The launch URL never changes, so consuming it more than once would drag the user back
    // into the log every time this effect re-runs.
    if (!handledInitialUrl.current) {
      handledInitialUrl.current = true;
      void Linking.getInitialURL().then((url) => {
        if (url) {
          openFromLiveActivity(url);
        }
      });
    }
    return () => subscription.remove();
  }, [hasCompletedOnboarding, isHydrated, open]);

  if (!isHydrated) {
    return <View style={{ flex: 1, backgroundColor: sheetColors.sheet }} />;
  }

  return (
    <Stack screenOptions={{ animation: reduceMotion ? 'fade' : 'default' }}>
      {/* The device (PLAN §4.1): the app's one home. Sheets live inside it. */}
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Trim' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="paywall"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
          title: 'Trim Pro',
        }}
      />
      {/* A deep-link alias: it opens the device in log mode and leaves (app/log.tsx). */}
      <Stack.Screen name="log" options={{ headerShown: false, animation: 'none', title: 'Log' }} />
      <Stack.Screen
        name="workout-complete"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
          title: 'Nice work',
        }}
      />
      <Stack.Screen
        name="history-session"
        options={{ headerShown: false, gestureEnabled: true, title: 'Session' }}
      />
      <Stack.Screen
        name="progress-lift"
        options={{ headerShown: false, gestureEnabled: true, title: 'Progress' }}
      />
      <Stack.Screen
        name="progress-body"
        options={{ headerShown: false, gestureEnabled: true, title: 'Progress' }}
      />
      <Stack.Screen
        name="plan/[id]"
        options={{
          headerShown: false,
          title: 'Plan',
          headerBackButtonDisplayMode: 'minimal',
          keyboardHandlingEnabled: false,
        }}
      />
      <Stack.Screen
        name="day-preview"
        options={{
          // Native sheet: system glass, detent and drag-to-dismiss (trim-ui §5). Every sheet
          // draws Trim's grabber (`PaperGrabber overlay`): iOS's sits 5pt from the edge.
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.systemBackground },
          title: 'Day',
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          // A plan's or a day's name, and a day's actions (trim-ui §10 Rename).
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.systemBackground },
          title: 'Edit',
        }}
      />
      <Stack.Screen
        name="day-workout"
        options={{
          // A trained day from Home's week: a record, read-only, sized to its content like Day
          // preview, with Trim's grabber (trim-ui §10 Sheets).
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.systemBackground },
          title: 'Workout',
        }}
      />
      <Stack.Screen
        name="exercises"
        options={{
          // A step in the editor stack: a push, so the back chevron and edge swipe agree.
          headerShown: false,
          title: 'Exercises',
        }}
      />
      <Stack.Screen
        name="check-in"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [1],
          sheetGrabberVisible: false,
          sheetCornerRadius: 24,
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.secondarySystemBackground },
          title: 'Check in',
        }}
      />
      <Stack.Screen
        name="goal"
        options={{
          // The goal sheet (trim-ui §13 Goals): native, sized to its content, Trim's grabber.
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.systemBackground },
          title: 'Goal',
        }}
      />
      <Stack.Screen
        name="weeks"
        options={{
          // F6: Home's week amount over the last weeks. Read-only, so a medium detent that
          // can grow for large text; the grouped background matches Check in.
          presentation: 'formSheet',
          sheetAllowedDetents: [0.7, 1],
          sheetGrabberVisible: false,
          sheetCornerRadius: 24,
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.secondarySystemBackground },
          title: 'Weeks',
        }}
      />
      <Stack.Screen
        name="exercise-sheet"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.systemBackground },
          title: 'Exercise',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <RootErrorBoundary>
          <WorkoutProvider>
            <DeviceApp />
          </WorkoutProvider>
        </RootErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
