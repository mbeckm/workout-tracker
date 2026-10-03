import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartridgeInsert, isCartridgeInsertAvailable } from '../../modules/trim-device';
import { gadgetRadius, gadgetType, sheetColors, space } from '@/constants/theme';
import { normalizeFinish } from '@/domain/finish';
import { useWorkoutStore } from '@/store/workout-store';

/**
 * Dev-only preview of the native plan insert (PLAN Phase 9). Deep link:
 * `scratchworkout:///dev-insert?finish=212&plan=Upper%20Lower&days=Upper%20A,Lower%20A`.
 * `pause=<ms>` freezes the timeline for screenshots (and hides the controls); `speed=0.25`
 * plays it in slow motion; `reduce=1` acts as Reduce Motion. Replay remounts it.
 */
export default function DevInsertRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <DevInsertForParams />;
}

/** A new deep link starts a fresh run (the route stays mounted when only params change). */
function DevInsertForParams() {
  const params = useLocalSearchParams();
  return <DevInsert key={JSON.stringify(params)} />;
}

const DEFAULT_PLAN = 'Upper Lower';
const DEFAULT_DAYS = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];

function DevInsert() {
  const params = useLocalSearchParams<{
    finish?: string;
    plan?: string;
    days?: string;
    pause?: string;
    speed?: string;
    reduce?: string;
  }>();
  const insets = useSafeAreaInsets();
  const systemReduceMotion = useReducedMotion();
  const { soundsOn } = useWorkoutStore();
  const [run, setRun] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const finish = normalizeFinish(params.finish);
  const plan = params.plan ?? DEFAULT_PLAN;
  const days = params.days ? params.days.split(',').map((d) => d.trim()).filter(Boolean) : DEFAULT_DAYS;
  const pauseAt = params.pause != null ? Number(params.pause) : undefined;
  const speed = params.speed != null ? Number(params.speed) : undefined;
  const reduceMotion = systemReduceMotion || params.reduce === '1';

  const [t0, setT0] = useState(() => Date.now());
  const note = useCallback(
    (event: string) => setLog((current) => [...current, `${event} ${Date.now() - t0} ms`]),
    [t0],
  );
  const replay = useCallback(() => {
    setLog([]);
    setT0(Date.now());
    setRun((n) => n + 1);
  }, []);

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
      <StatusBar style="light" />
      {isCartridgeInsertAvailable ? (
        <CartridgeInsert
          key={run}
          style={styles.fill}
          finish={finish}
          planName={plan}
          days={days}
          playing
          reduceMotion={reduceMotion}
          soundsOn={soundsOn}
          safeTop={insets.top}
          safeBottom={insets.bottom}
          pauseAt={pauseAt}
          speed={speed}
          onSceneReady={() => note('ready')}
          onSeated={() => note('seated')}
          onFinished={() => note('finished')}
        />
      ) : (
        <Text style={[gadgetType.rowTitle, styles.missing]}>
          This build has no native insert. Rebuild the dev client.
        </Text>
      )}
      {pauseAt == null ? (
        <View style={[styles.controls, { bottom: insets.bottom + space.inset }]} pointerEvents="box-none">
          <Text style={gadgetType.rowSub} maxFontSizeMultiplier={1}>
            {log.join('   ')}
          </Text>
          <Pressable accessibilityRole="button" onPress={replay} style={styles.replay}>
            <Text style={[gadgetType.rowTitle, styles.replayInk]}>Replay</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: sheetColors.sheet },
  missing: { margin: space.gutter, marginTop: space.pause * 3 },
  controls: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    alignItems: 'center',
    gap: space.related,
  },
  replay: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.related,
    borderRadius: gadgetRadius.card,
    borderCurve: 'continuous',
    backgroundColor: sheetColors.pillLight,
  },
  replayInk: { color: sheetColors.pillLightInk },
});
