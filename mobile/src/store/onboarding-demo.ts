/**
 * Development only: `EXPO_PUBLIC_ONBOARDING_DEMO=1` starts the app on a fresh, empty snapshot
 * in memory, so onboarding can be walked like a new install without deleting the app. Like the
 * Home and Progress fixtures it is never saved: turning the flag off brings the real data back.
 */
export function onboardingDemo(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_ONBOARDING_DEMO === '1';
}
