import { ThemeProvider as NavigationThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { KeyboardProvider } from '@/keyboard';

import { gadgetType, sheetColors, signal, space } from '@/constants/theme';
import { DeviceProvider, useDevice } from '@/device/device-context';
import { FinishProvider } from '@/device/finish';
import { logCommandForLink } from '@/device/log-link';
import { parseWorkoutLogUrl } from '@/live-activity/url';
import { startEntitlementSync } from '@/purchases/purchases';
import { progressDemoMode, shouldUseProgressDemo } from '@/store/progress-demo';
import { WorkoutProvider, useWorkoutStore } from '@/store/workout-store';
import { ToastHost } from '@/components/toast';
import { trackScreen } from '@/analytics/analytics';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * What the navigator draws behind a route while it moves (onboarding, the paywall modal): the
 * sheets' dark, never a white flash (D2).
 */
const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: signal.orange,
    background: sheetColors.sheet,
    card: sheetColors.sheet,
    text: sheetColors.ink,
    border: sheetColors.rule,
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
            backgroundColor: sheetColors.sheet,
            padding: space.gutter,
            justifyContent: 'center',
          }}>
          <Text style={gadgetType.sheetTitle}>Trim hit an error</Text>
          <Text style={[gadgetType.rowSub, { marginTop: space.related }]}>{this.state.message}</Text>
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
