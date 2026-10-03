import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import {
  device,
  finishColors,
  gadgetRadius,
  gadgetType,
  lcd,
  space,
  signal,
} from '@/constants/theme';
import { FINISHES, normalizeFinish, type Finish } from '@/domain/finish';
import { FinishProvider } from '@/device/finish';
import { useAppFonts } from '@/device/fonts';
import { useHaptics } from '@/device/haptics';
import {
  BigKey,
  DeviceBody,
  Display,
  Drum,
  EngravedLabel,
  HistoryGlyph,
  HoldRing,
  Lamp,
  LampPlate,
  MenuGlyph,
  RoundKey,
  Rocker,
  TallKey,
  Well,
  Wheel,
  type DrumNudge,
  type LampState,
} from '@/device/parts';
import { DEVICE, LINEAR_FN } from '@/motion';
import { useWorkoutStore } from '@/store/workout-store';

/**
 * Dev-only gallery (PLAN Phase 1 step 4): every device primitive in every state, and a static
 * device at the 390 × 844 reference in the Home, Log, Rest and Finish looks, per finish, for
 * screenshot comparison with design/gadget/screens. Deep link:
 * `scratchworkout:///dev-gallery?look=log&finish=101`.
 *
 * In a look: the menu key returns to the parts list, the history key (Home) cycles the finish,
 * and the keys walk Home → Log → Rest → Log; undo opens Finish, Back returns.
 */
export default function DevGalleryRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <DevGallery />;
}

type Look = 'parts' | 'home' | 'log' | 'rest' | 'finish';
const LOOKS: readonly Look[] = ['parts', 'home', 'log', 'rest', 'finish'];

/** The reference frame (SPEC §4). */
const FRAME = { width: 390, height: 844 } as const;
const REF = {
  topY: device.topRowY,
  rockerX: 96,
  labelY: 118,
  displayY: device.displayY,
  tallKeyX: 22,
  tallKeyTopY: 592,
  tallKeyBottomY: 680,
  backKeyY: 636,
  wellX: 110,
  wellY: 590,
  bigKeyX: 122,
  bigKeyY: 600,
  wheelRight: 22,
  wheelY: 588,
  plateX: 100,
  plateY: 62,
} as const;

function DevGallery() {
  const params = useLocalSearchParams<{ look?: string; finish?: string }>();
  const { finish: savedFinish } = useWorkoutStore();
  const fontsReady = useAppFonts();
  // The URL wins whenever it changes (a new `openurl` while mounted); taps change the local
  // state in between. Reset during render, React's pattern for state derived from props.
  const source = `${params.look ?? ''}|${params.finish ?? ''}`;
  const fromParams = () => ({
    source,
    look: LOOKS.includes(params.look as Look) ? (params.look as Look) : ('parts' as Look),
    finish: normalizeFinish(params.finish ?? savedFinish),
  });
  const [state, setState] = useState(fromParams);
  if (state.source !== source) {
    setState(fromParams());
  }
  const { look, finish } = state;
  const setLook = useCallback((next: Look) => setState((s) => ({ ...s, look: next })), []);
  const setFinish = useCallback((next: Finish) => setState((s) => ({ ...s, finish: next })), []);
  const cycleFinish = useCallback(
    () =>
      setState((s) => ({
        ...s,
        finish: FINISHES[(FINISHES.indexOf(s.finish) + 1) % FINISHES.length],
      })),
    [],
  );

  if (!fontsReady) return null;

  return (
    <FinishProvider override={finish}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={finishColors[finish].statusBar} />
      {look === 'parts' ? (
        <Parts finish={finish} onFinish={setFinish} onLook={setLook} />
      ) : (
        <Composition look={look} onLook={setLook} onCycleFinish={cycleFinish} />
      )}
    </FinishProvider>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Compositions
 * ----------------------------------------------------------------------------------------- */

function Composition({
  look,
  onLook,
  onCycleFinish,
}: {
  look: Exclude<Look, 'parts'>;
  onLook: (look: Look) => void;
  onCycleFinish: () => void;
}) {
  const { width } = useWindowDimensions();
  const haptics = useHaptics();
  const [weight, setWeight] = useState(85);
  const [reps, setReps] = useState(8);
  const [nudge, setNudge] = useState<DrumNudge | null>(null);
  const [rest, setRest] = useState(89);
  const [restTotal, setRestTotal] = useState(90);
  const hold = useSharedValue(0);
  const step = 2.5;
  // Refs mirror the values so several notches inside one frame each see the latest one.
  const weightRef = useRef(85);
  const restRef = useRef({ rest: 89, total: 90, notches: 0 });

  const onWeightNotch = useCallback((direction: 1 | -1) => {
    const next = weightRef.current + direction * step;
    if (next < 0) return false;
    weightRef.current = next;
    setWeight(next);
    setNudge((current) => ({ direction, id: (current?.id ?? 0) + 1 }));
    return next % 10 === 0 ? 'major' : true;
  }, []);

  const addRest = useCallback((delta: number) => {
    const state = restRef.current;
    state.rest = Math.max(0, Math.min(600, state.rest + delta));
    state.total = Math.max(state.total, state.rest);
    setRest(state.rest);
    setRestTotal(state.total);
  }, []);
  // Two notches = 15 s (SPEC §7).
  const onRestNotch = useCallback(
    (direction: 1 | -1) => {
      const state = restRef.current;
      state.notches += direction;
      if (Math.abs(state.notches) >= 2) {
        addRest(Math.sign(state.notches) * 15);
        state.notches = 0;
        return 'major' as const;
      }
      return true;
    },
    [addRest],
  );

  const logLamps: LampState[] = ['on', 'off', 'off'];
  const restLamps: LampState[] = ['on', 'off', 'off'];
  const isWork = look === 'log' || look === 'rest';

  return (
    <DeviceBody>
      <View style={[styles.frame, { left: (width - FRAME.width) / 2 }]}>
        <RoundKey
          accessibilityLabel="Menu"
          onPress={() => onLook('parts')}
          style={[styles.abs, { left: device.edge, top: REF.topY }]}>
          <MenuGlyph />
        </RoundKey>

        {look === 'home' ? (
          <>
            <Rocker
              variant="week"
              lamps={['done', 'done', 'on', 'off']}
              accessibilityLabel="Week 12, 2 of 4 days done"
              style={[styles.abs, { left: REF.rockerX, top: REF.topY }]}
            />
            <EngravedLabel style={[styles.abs, styles.rockerLabel]}>WEEK 12</EngravedLabel>
            <RoundKey
              accessibilityLabel="History"
              onPress={onCycleFinish}
              style={[styles.abs, { right: device.edge, top: REF.topY }]}>
              <HistoryGlyph />
            </RoundKey>
          </>
        ) : null}

        {isWork ? (
          <>
            <Rocker
              variant="lifts"
              lamps={look === 'rest' ? restLamps : logLamps}
              prevDisabled
              onPrev={() => undefined}
              onNext={() => undefined}
              onMiddle={() => undefined}
              style={[styles.abs, { left: REF.rockerX, top: REF.topY }]}
            />
            <RoundKey
              accessibilityLabel="Undo last set"
              label="↶"
              onPress={() => onLook('finish')}
              style={[styles.abs, { right: device.edge, top: REF.topY }]}
            />
          </>
        ) : null}

        {look === 'finish' ? (
          <LampPlate
            lamps={['off', 'off', 'off']}
            accessibilityLabel="0 of 3 lifts done"
            style={[styles.abs, { left: REF.plateX, top: REF.plateY }]}
          />
        ) : null}

        <Display contentKey={look} style={styles.display}>
          {look === 'home' ? <HomeContent /> : null}
          {look === 'log' ? <LogContent weight={weight} reps={reps} step={step} nudge={nudge} /> : null}
          {look === 'rest' ? <RestContent rest={rest} total={restTotal} /> : null}
          {look === 'finish' ? <FinishContent /> : null}
        </Display>

        {look === 'log' ? (
          <>
            <TallKey
              accessibilityLabel="More reps"
              label="+"
              onPress={() => setReps((r) => Math.min(50, r + 1))}
              style={[styles.abs, { left: REF.tallKeyX, top: REF.tallKeyTopY }]}
            />
            <TallKey
              accessibilityLabel="Fewer reps"
              label="−"
              onPress={() => setReps((r) => Math.max(1, r - 1))}
              style={[styles.abs, { left: REF.tallKeyX, top: REF.tallKeyBottomY }]}
            />
          </>
        ) : null}
        {look === 'rest' ? (
          <>
            <TallKey
              accessibilityLabel="Add 15 seconds"
              label="+15"
              text="word"
              onPress={() => addRest(15)}
              style={[styles.abs, { left: REF.tallKeyX, top: REF.tallKeyTopY }]}
            />
            <TallKey
              accessibilityLabel="Take off 15 seconds"
              label="−15"
              text="word"
              onPress={() => addRest(-15)}
              style={[styles.abs, { left: REF.tallKeyX, top: REF.tallKeyBottomY }]}
            />
          </>
        ) : null}
        {look === 'finish' ? (
          <TallKey
            accessibilityLabel="Back to the workout"
            label="Back"
            text="wordSmall"
            onPress={() => onLook('log')}
            style={[styles.abs, { left: REF.tallKeyX, top: REF.backKeyY }]}
          />
        ) : null}

        <Well style={[styles.abs, { left: REF.wellX, top: REF.wellY }]} />
        <HoldRing progress={hold} style={[styles.abs, { left: REF.wellX, top: REF.wellY }]} />
        {look === 'home' ? (
          <BigKey label="Start" onPress={() => onLook('log')} style={styles.bigKey} />
        ) : null}
        {look === 'log' ? (
          <BigKey label="Log" onPress={() => onLook('rest')} style={styles.bigKey} />
        ) : null}
        {look === 'rest' ? (
          <BigKey label="Skip" variant="metal" onPress={() => onLook('log')} style={styles.bigKey} />
        ) : null}
        {look === 'finish' ? (
          <BigKey
            label="Finish"
            accessibilityLabel="Finish workout, hold"
            onPressIn={() => {
              haptics.startHoldFinish();
              hold.set(withTiming(1, { duration: DEVICE.HOLD, easing: LINEAR_FN }));
            }}
            onPressOut={() => {
              haptics.stopHoldFinish();
              hold.set(0);
            }}
            style={styles.bigKey}
          />
        ) : null}

        <Wheel
          stowed={look === 'home'}
          label={look === 'log' ? 'KG' : look === 'rest' ? 'TIME' : undefined}
          accessibilityLabel={look === 'rest' ? 'Rest time' : 'Weight'}
          accessibilityValue={look === 'rest' ? `${rest} seconds` : `${weight} kilograms`}
          onNotch={look === 'rest' ? onRestNotch : onWeightNotch}
          style={[styles.abs, { right: REF.wheelRight, top: REF.wheelY }]}
        />
      </View>
    </DeviceBody>
  );
}

const fmtWeight = (w: number) => (Math.round(w * 10) / 10).toFixed(1);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Lcd({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[gadgetType.lcdSmall, dim && styles.dim]}>
      {children}
    </Text>
  );
}

function HomeContent() {
  const lifts = [
    ['BENCH PRESS', '3×8'],
    ['CABLE FLY', '3×12'],
    ['OVERHEAD PRESS', '3×8'],
  ];
  const doneTop = device.rowInset;
  const done2Top = doneTop + device.rowHeight + device.rowGap;
  const nextTop = done2Top + device.rowHeight + device.rowGap;
  const nextHeight = device.rowExpandedBase + lifts.length * device.rowExpandedLine;
  const todoTop = nextTop + nextHeight + device.rowGap;
  return (
    <>
      <DoneRow top={doneTop} name="PULL 1" when="MON 48 MIN" sets="9 SETS" />
      <DoneRow top={done2Top} name="LEGS 1" when="TUE 55 MIN" sets="9 SETS" stamp="SQUAT PR" />
      <View style={[styles.dayRow, styles.nextRow, { top: nextTop, height: nextHeight }]}>
        <View style={styles.rowHead}>
          <Text maxFontSizeMultiplier={1} style={gadgetType.lcdRow}>PUSH 1</Text>
          <Text maxFontSizeMultiplier={1} style={gadgetType.lcdRow}>~45 MIN</Text>
        </View>
        <View style={styles.liftList}>
          {lifts.map(([name, rx]) => (
            <Text key={name} maxFontSizeMultiplier={1} style={gadgetType.lcdList}>
              {name}
              <Text style={styles.dim}>{` ${rx}`}</Text>
            </Text>
          ))}
        </View>
      </View>
      <View style={[styles.dayRow, styles.todoRow, { top: todoTop }]}>
        <View style={styles.rowHead}>
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdRow, styles.dim]}>LEGS 2</Text>
          <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdRow, styles.dim]}>3 LIFTS</Text>
        </View>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdMeta, styles.dim, styles.meta]}>~45 MIN</Text>
      </View>
    </>
  );
}

function DoneRow({
  top,
  name,
  when,
  sets,
  stamp,
}: {
  top: number;
  name: string;
  when: string;
  sets: string;
  stamp?: string;
}) {
  return (
    <View style={[styles.dayRow, styles.doneRow, { top }]}>
      <View style={styles.rowHead}>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdRow, styles.doneInk]}>{name}</Text>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdRow, styles.doneInk]}>✓</Text>
      </View>
      <View style={[styles.rowHead, styles.meta]}>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdMeta, styles.doneMeta]}>{when}</Text>
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdMeta, styles.doneMeta]}>{sets}</Text>
      </View>
      {stamp ? (
        <Text maxFontSizeMultiplier={1} style={[gadgetType.lcdStamp, styles.stamp]}>
          {stamp}
        </Text>
      ) : null}
    </View>
  );
}

function LogContent({
  weight,
  reps,
  step,
  nudge,
}: {
  weight: number;
  reps: number;
  step: number;
  nudge: DrumNudge | null;
}) {
  return (
    <>
      <View style={styles.header}>
        <Lcd>BENCH PRESS ▾</Lcd>
        <Lcd dim>SET 1/3</Lcd>
      </View>
      <Drum
        current={fmtWeight(weight)}
        above={fmtWeight(weight + step)}
        below={weight - step >= 0 ? fmtWeight(weight - step) : undefined}
        nudge={nudge}
        compact={weight >= 1000}
      />
      <View style={[styles.footer, styles.bottomRow]}>
        <Text maxFontSizeMultiplier={1} style={gadgetType.lcdReps}>{`×${reps}`}</Text>
        <View style={styles.besideReps}>
          <Lcd dim>LAST 80×8</Lcd>
        </View>
      </View>
    </>
  );
}

const REST_RING = {
  size: 230,
  top: 74,
  timeTop: 162,
};

function RestContent({ rest, total }: { rest: number; total: number }) {
  const c = REST_RING.size / 2;
  const r = device.restRingRadius;
  const circumference = 2 * Math.PI * r;
  return (
    <>
      <View style={styles.header}>
        <Lcd dim>REST</Lcd>
        <Lcd dim>NEXT 90×9</Lcd>
      </View>
      <View style={[styles.centerRow, { top: REST_RING.top }]}>
        <Svg width={REST_RING.size} height={REST_RING.size}>
          <Circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={lcd.amberOff}
            strokeWidth={device.restRingStroke}
            strokeDasharray="3 7"
          />
          <Circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={lcd.amber}
            strokeWidth={device.restRingStroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - rest / Math.max(1, total))}
            transform={`rotate(-90 ${c} ${c})`}
          />
        </Svg>
      </View>
      <Text
        maxFontSizeMultiplier={1}
        style={[gadgetType.lcdBig, styles.centerText, { top: REST_RING.timeTop }]}>
        {mmss(rest)}
      </Text>
      <View style={[styles.footer, styles.footerRest]}>
        <Lcd dim>BENCH PRESS ▾</Lcd>
        <Lcd dim>SET 2/3</Lcd>
      </View>
    </>
  );
}

const FINISH_LAYOUT = {
  titleTop: 64,
  gridTop: 150,
  gridRight: 120,
  statsTop: 220,
};

function FinishContent() {
  const total = 9;
  const logged = 1;
  const rows: number[][] = [];
  for (let i = 0; i < total; i += device.gridColumns) {
    rows.push(Array.from({ length: device.gridColumns }, (_, k) => i + k));
  }
  return (
    <>
      <View style={styles.header}>
        <Lcd dim>PUSH 1</Lcd>
        <Lcd dim>1 MIN</Lcd>
      </View>
      <Text
        maxFontSizeMultiplier={1}
        style={[gadgetType.lcdTitle, styles.absLeft, { top: FINISH_LAYOUT.titleTop }]}>
        END EARLY?
      </Text>
      <View
        style={[
          styles.absLeft,
          styles.grid,
          { top: FINISH_LAYOUT.gridTop, right: FINISH_LAYOUT.gridRight },
        ]}>
        {rows.map((row, r) => (
          <View key={r} style={styles.gridRow}>
            {row.map((index) => (
              <View
                key={index}
                style={[
                  styles.gridCell,
                  index >= total && styles.gridEmpty,
                  index < logged && styles.gridOn,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <Text
        maxFontSizeMultiplier={1}
        style={[gadgetType.lcdStat, styles.absLeft, { top: FINISH_LAYOUT.statsTop }]}>
        {`${logged} OF ${total} SETS\n810 KG`}
      </Text>
    </>
  );
}

/* ----------------------------------------------------------------------------------------- *
 * Parts
 * ----------------------------------------------------------------------------------------- */

function Parts({
  finish,
  onFinish,
  onLook,
}: {
  finish: Finish;
  onFinish: (finish: Finish) => void;
  onLook: (look: Look) => void;
}) {
  const insets = useSafeAreaInsets();
  const [litKey, setLitKey] = useState(0);
  const [displayKey, setDisplayKey] = useState(0);
  const [weight, setWeight] = useState(82.5);
  const partsWeight = useRef(82.5);
  const [nudge, setNudge] = useState<DrumNudge | null>(null);
  const [stowed, setStowed] = useState(false);
  const hold = useSharedValue(0);

  return (
    <DeviceBody>
      <ScrollView
        contentContainerStyle={[
          styles.parts,
          { paddingTop: insets.top + space.inset, paddingBottom: insets.bottom + space.pause },
        ]}>
        <Section title={`Finish ${finish} ${finishColors[finish].name}`}>
          <View style={styles.wrapRow}>
            {FINISHES.map((id) => (
              <RoundKey key={id} accessibilityLabel={`Finish ${id}`} label={id} text="wordSmall" onPress={() => onFinish(id)} />
            ))}
          </View>
        </Section>

        <Section title="Looks at 390 × 844">
          <View style={styles.wrapRow}>
            {(['home', 'log', 'rest', 'finish'] as const).map((id) => (
              <TallKey key={id} accessibilityLabel={`Open ${id}`} label={id.toUpperCase()} text="wordSmall" onPress={() => onLook(id)} />
            ))}
          </View>
        </Section>

        <Section title="Engraved label">
          <View style={styles.wrapRow}>
            <EngravedLabel>WEEK 12</EngravedLabel>
            <EngravedLabel accent={{ text: '  ▲3', color: signal.orange }}>WEEK 12</EngravedLabel>
            <EngravedLabel>KG</EngravedLabel>
            <EngravedLabel>TIME</EngravedLabel>
            <EngravedLabel>SETS</EngravedLabel>
          </View>
        </Section>

        <Section title="Round key">
          <View style={styles.wrapRow}>
            <RoundKey accessibilityLabel="Menu">
              <MenuGlyph />
            </RoundKey>
            <RoundKey accessibilityLabel="History">
              <HistoryGlyph />
            </RoundKey>
            <RoundKey accessibilityLabel="Undo last set" label="↶" />
            <RoundKey accessibilityLabel="Undo last set" label="↶" disabled />
            <RoundKey accessibilityLabel="Remove lift" label="✕" />
          </View>
        </Section>

        <Section title="Tall key">
          <View style={styles.wrapRow}>
            <TallKey accessibilityLabel="More reps" label="+" />
            <TallKey accessibilityLabel="Fewer reps" label="−" />
            <TallKey accessibilityLabel="Add 15 seconds" label="+15" text="word" />
            <TallKey accessibilityLabel="Back to the workout" label="Back" text="wordSmall" />
            <TallKey accessibilityLabel="Fewer reps" label="−" disabled />
          </View>
        </Section>

        <Section title="Rocker">
          <View style={styles.stack}>
            <Rocker
              key={litKey}
              variant="week"
              lamps={['done', 'done', 'on', 'off']}
              litIndex={1}
              accessibilityLabel="Week 12, 2 of 4 days done"
            />
            <RoundKey accessibilityLabel="Replay lamp" label="↻" onPress={() => setLitKey((k) => k + 1)} />
            <Rocker
              variant="lifts"
              lamps={['done', 'part', 'on', 'off']}
              prevDisabled
              onPrev={() => undefined}
              onNext={() => undefined}
              onMiddle={() => undefined}
            />
            <Rocker
              variant="lifts"
              lamps={Array.from({ length: 14 }, (_, i) => (i < 5 ? 'done' : i === 5 ? 'on' : 'off'))}
              nextDisabled
              onPrev={() => undefined}
              onNext={() => undefined}
              onMiddle={() => undefined}
            />
            <Rocker
              variant="lifts"
              lamps={Array.from({ length: 18 }, (_, i) => (i < 6 ? 'done' : i === 6 ? 'on' : 'off'))}
              onPrev={() => undefined}
              onNext={() => undefined}
              onMiddle={() => undefined}
            />
            <LampPlate lamps={['done', 'done', 'off']} />
          </View>
        </Section>

        <Section title="Lamps">
          <View style={styles.wrapRow}>
            {(['off', 'part', 'on', 'done'] as const).map((state) => (
              <Lamp key={state} state={state} />
            ))}
            <Lamp key={`lit-${litKey}`} state="done" lit />
            {(['off', 'on', 'done'] as const).map((state) => (
              <Lamp key={`plate-${state}`} state={state} surface="plate" />
            ))}
          </View>
        </Section>

        <Section title="Display, drum, wheel">
          <View style={styles.row}>
            <Display contentKey={String(displayKey)} style={styles.partDisplay}>
              <View style={styles.header}>
                <Lcd>BENCH PRESS ▾</Lcd>
                <Lcd dim>{`SET ${(displayKey % 3) + 1}/3`}</Lcd>
              </View>
              <Drum
                current={fmtWeight(weight)}
                above={fmtWeight(weight + 2.5)}
                below={fmtWeight(Math.max(0, weight - 2.5))}
                nudge={nudge}
              />
            </Display>
            <View style={styles.stack}>
              <Wheel
                label="KG"
                stowed={stowed}
                accessibilityLabel="Weight"
                accessibilityValue={`${weight} kilograms`}
                onNotch={(direction) => {
                  const next = partsWeight.current + direction * 2.5;
                  if (next < 0) return false;
                  partsWeight.current = next;
                  setWeight(next);
                  setNudge((n) => ({ direction, id: (n?.id ?? 0) + 1 }));
                  return next % 10 === 0 ? 'major' : true;
                }}
              />
              <RoundKey accessibilityLabel="Swap display" label="↻" onPress={() => setDisplayKey((k) => k + 1)} />
              <RoundKey accessibilityLabel="Stow wheel" label="⇥" onPress={() => setStowed((s) => !s)} />
            </View>
          </View>
        </Section>

        <Section title="Big key">
          <View style={styles.wrapRow}>
            <BigKey label="Log" />
            <BigKey label="Skip" variant="metal" />
            <BigKey label="Start" variant="disabled" />
          </View>
        </Section>

        <Section title="Well, hold ring">
          <View style={styles.wellDemo}>
            <Well style={styles.abs} />
            <HoldRing progress={hold} style={styles.abs} />
            <BigKey
              label="Finish"
              accessibilityLabel="Finish workout, hold"
              onPressIn={() => hold.set(withTiming(1, { duration: DEVICE.HOLD, easing: LINEAR_FN }))}
              onPressOut={() => hold.set(0)}
              style={styles.wellKey}
            />
          </View>
        </Section>
      </ScrollView>
    </DeviceBody>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <EngravedLabel style={styles.sectionTitle}>{title}</EngravedLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  absLeft: { position: 'absolute', left: device.displayPad },
  frame: { position: 'absolute', top: 0, width: FRAME.width, height: FRAME.height },
  rockerLabel: { left: REF.rockerX, top: REF.labelY, width: device.rockerWidth },
  display: {
    position: 'absolute',
    left: device.edge,
    right: device.edge,
    top: REF.displayY,
    height: device.displayHeight,
  },
  bigKey: { position: 'absolute', left: REF.bigKeyX, top: REF.bigKeyY },
  dim: { color: lcd.amberDim },
  header: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    top: device.displayHeaderY,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    position: 'absolute',
    left: device.displayPad,
    right: device.displayPad,
    bottom: device.displayFooterY,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerRest: { bottom: device.displayHeaderY },
  bottomRow: { alignItems: 'flex-end', bottom: device.repsFooterY },
  besideReps: { paddingBottom: device.lcdSmallBesideReps },
  centerRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  centerText: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  dayRow: {
    position: 'absolute',
    left: device.rowInset,
    right: device.rowInset,
    height: device.rowHeight,
    borderRadius: gadgetRadius.lcdRow,
    borderCurve: 'continuous',
    paddingHorizontal: device.rowPadX,
    paddingVertical: device.rowPadY,
  },
  doneRow: { backgroundColor: lcd.doneRow },
  // The prototype's undone rows are <button>s, which centre their content vertically.
  nextRow: { justifyContent: 'center', boxShadow: `inset 0 0 0 ${device.rowOutline}px ${lcd.amber}` },
  todoRow: { justifyContent: 'center', backgroundColor: lcd.todoRow },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { marginTop: device.rowMetaGap },
  liftList: { marginTop: device.rowListGap },
  doneInk: { color: lcd.doneRowInk },
  doneMeta: { color: lcd.doneRowMeta },
  stamp: {
    position: 'absolute',
    right: device.stampOffsetRight,
    top: device.stampOffsetTop,
    transform: [{ rotate: `${device.stampAngle}deg` }],
    borderWidth: device.stampBorder,
    borderColor: lcd.doneRowInk,
    borderRadius: gadgetRadius.stamp,
    paddingHorizontal: device.stampPadX,
    paddingVertical: device.stampPadY,
    color: lcd.doneRowInk,
    backgroundColor: lcd.doneRow,
    overflow: 'hidden',
  },
  grid: { gap: device.gridGap },
  gridRow: { flexDirection: 'row', gap: device.gridGap },
  gridCell: {
    flex: 1,
    height: device.gridLamp,
    borderRadius: device.gridLamp / 2,
    backgroundColor: lcd.amberOff,
  },
  gridEmpty: { opacity: 0 },
  gridOn: { backgroundColor: lcd.amber, boxShadow: `0 0 6px ${lcd.amber}` },
  parts: { paddingHorizontal: device.edge, gap: space.section },
  section: { gap: space.inline },
  sectionTitle: { textAlign: 'left' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.inset },
  row: { flexDirection: 'row', gap: space.inset, alignItems: 'flex-start' },
  stack: { gap: space.inset, alignItems: 'flex-start' },
  partDisplay: { flex: 1, height: device.displayHeight },
  wellDemo: { width: device.wellSize, height: device.wellSize },
  wellKey: {
    position: 'absolute',
    left: REF.bigKeyX - REF.wellX,
    top: REF.bigKeyY - REF.wellY,
  },
});
