import { ThemeProvider as NavigationThemeProvider, DefaultTheme, DarkTheme } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Component, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { KeyboardProvider } from '@/keyboard';

import { colors, spacing, type } from '@/constants/theme';
import { peekWorkoutFocus, rememberWorkoutFocus } from '@/live-activity/controller';
import { parseWorkoutLogUrl, workoutLogHref } from '@/live-activity/url';
import { startEntitlementSync } from '@/purchases/purchases';
import { progressDemoMode, shouldUseProgressDemo } from '@/store/progress-demo';
import { WorkoutProvider, useWorkoutStore } from '@/store/workout-store';
import { AppThemeProvider, useTheme } from '@/theme/theme-context';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || 'Something went wrong.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Scratch root error', error, info.componentStack);
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

function ThemedApp() {
  const { appearance, systemScheme, setSystemScheme } = useWorkoutStore();
  return (
    <AppThemeProvider
      appearance={appearance}
      systemScheme={systemScheme}
      onSystemSchemeChange={setSystemScheme}>
      <ThemedNavigation />
    </AppThemeProvider>
  );
}

function ThemedNavigation() {
  const { colors: themeColors, scheme } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: themeColors.systemBlue,
        background: themeColors.systemBackground,
        card: themeColors.systemBackground,
        text: themeColors.label,
        border: themeColors.separator,
        notification: themeColors.systemRed,
      },
    };
  }, [scheme, themeColors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootNav />
    </NavigationThemeProvider>
  );
}

function RootNav() {
  const { colors: themeColors } = useTheme();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const segments = useSegments();
  const { isHydrated, hasCompletedOnboarding, applyEntitlement } = useWorkoutStore();
  const segmentsRef = useRef(segments);
  const handledInitialUrl = useRef(false);
  const openedProgressDemo = useRef(false);
  const openedLiftDemo = useRef(false);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Keeps isPro live; a no-op in Expo Go, on web, and without a store key.
  useEffect(
    () => (isHydrated ? startEntitlementSync(applyEntitlement) : undefined),
    [isHydrated, applyEntitlement],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const onOnboarding = segments[0] === 'onboarding';
    if (!hasCompletedOnboarding && !onOnboarding) {
      router.replace('/onboarding');
      return;
    }
    if (hasCompletedOnboarding && onOnboarding) {
      router.replace('/');
    }
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [hasCompletedOnboarding, isHydrated, router, segments]);

  useEffect(() => {
    if (!isHydrated || !hasCompletedOnboarding || !shouldUseProgressDemo() || openedProgressDemo.current) {
      return;
    }
    openedProgressDemo.current = true;
    router.replace('/progress');
  }, [hasCompletedOnboarding, isHydrated, router]);

  useEffect(() => {
    const mode = progressDemoMode();
    if (
      !isHydrated ||
      !hasCompletedOnboarding ||
      !mode ||
      !openedProgressDemo.current ||
      openedLiftDemo.current ||
      segments[0] !== '(tabs)' ||
      (segments as readonly string[])[1] !== 'progress'
    ) {
      return;
    }
    if (mode !== 'lift' && mode !== 'body') {
      return;
    }
    openedLiftDemo.current = true;
    const timer = setTimeout(() => {
      if (mode === 'lift') {
        router.push({ pathname: '/progress-lift', params: { name: 'Bench press' } });
        return;
      }
      router.push({ pathname: '/progress-body', params: { metric: 'waistCm' } });
    }, 900);
    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding, isHydrated, router, segments]);

  // Live Activity taps open scratchworkout://…/log?planId&dayId&exerciseId.
  // Navigate here when log is not already up so we don't remount and wipe drafts.
  useEffect(() => {
    if (!isHydrated || !hasCompletedOnboarding) {
      return;
    }

    const openFromLiveActivity = (url: string) => {
      const segments = segmentsRef.current;
      const parsed = parseWorkoutLogUrl(url);
      if (!parsed) {
        return;
      }
      // Focus tracks the Live Activity card as the workout advances. Prefer it over
      // a possibly stale ActivityKit start URL that still points at exercise 1.
      const exerciseId = peekWorkoutFocus(parsed.planId, parsed.dayId) ?? parsed.exerciseId;
      if (exerciseId) {
        rememberWorkoutFocus({
          planId: parsed.planId,
          dayId: parsed.dayId,
          exerciseId,
        });
      }
      const link = { planId: parsed.planId, dayId: parsed.dayId, exerciseId };
      if (segments[0] === 'log') {
        router.setParams({
          planId: link.planId,
          dayId: link.dayId,
          ...(link.exerciseId ? { exerciseId: link.exerciseId } : {}),
        });
        return;
      }
      router.push(workoutLogHref(link));
    };

    const subscription = Linking.addEventListener('url', ({ url }) => openFromLiveActivity(url));
    // The launch URL never changes, so consuming it more than once would drag the
    // user back into /log every time they navigate away from it.
    if (!handledInitialUrl.current) {
      handledInitialUrl.current = true;
      void Linking.getInitialURL().then((url) => {
        if (url) {
          openFromLiveActivity(url);
        }
      });
    }
    return () => subscription.remove();
  }, [hasCompletedOnboarding, isHydrated, router]);

  if (!isHydrated) {
    return <View style={{ flex: 1, backgroundColor: themeColors.systemBackground }} />;
  }

  return (
    <Stack screenOptions={{ animation: reduceMotion ? 'fade' : 'default' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
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
      <Stack.Screen
        name="log"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          title: 'Log',
          keyboardHandlingEnabled: false,
        }}
      />
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
        name="prescribe"
        options={{
          headerShown: false,
          title: 'Day',
          headerBackButtonDisplayMode: 'minimal',
          keyboardHandlingEnabled: false,
        }}
      />
      <Stack.Screen
        name="day-preview"
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          headerShown: false,
          gestureEnabled: false,
          contentStyle: { backgroundColor: 'transparent' },
          title: 'Day',
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
        name="exercise-sheet"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
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
            <ThemedApp />
          </WorkoutProvider>
        </RootErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
