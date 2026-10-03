import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useDevice } from '@/device/device-context';
import { logCommandForLink } from '@/device/log-link';

/**
 * `/log` is a deep-link alias now (PLAN §4.1): it puts the device in log mode and leaves. Live
 * Activity URLs are redirected before they get here (`+native-intent`); this catches in-app links.
 */
export default function LogRoute() {
  const params = useLocalSearchParams<{ planId?: string; dayId?: string; exerciseId?: string; start?: string }>();
  const router = useRouter();
  const { open } = useDevice();

  useEffect(() => {
    if (params.planId && params.dayId) {
      open(
        logCommandForLink({
          planId: params.planId,
          dayId: params.dayId,
          exerciseId: params.exerciseId,
          start: params.start === '1',
        }),
      );
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
    // Runs once: the route leaves right away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
