import { SymbolView } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PrCrown } from '@/components/pr-crown';
import { fontScaleCap, iconSize, space, TOUCH_TARGET } from '@/constants/theme';
import { formatLoadWithUnit } from '@/domain/helpers';
import type { LiftChange, LiftNumber } from '@/domain/home-numbers';
import { DURATION, EASE_OUT, ENTER_OFFSET, SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';

type Units = 'kg' | 'lbs';

/**
 * From the larger Dynamic Type sizes up (xxxLarge and the accessibility sizes), a row stacks
 * the prescription and load under the name instead of squeezing the name to an ellipsis.
 */
export const STACK_FONT_SCALE = 1.3;

/** A single-line row: a 44pt touch target plus the air a `title` load needs (Paper V4: 48). */
const ROW_HEIGHT = TOUCH_TARGET + space.tight;
/**
 * Lanes, so every row's prescription and load line up (Paper V4; the load lane fits
 * `102.5 kg` with its ↑). They grow with the text.
 */
const METRIC_LANE = 44;
const LOAD_LANE = 100;

/** `62.5`, `60`: the load alone, for a number whose unit sits beside it. */
function formatLoad(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * One lift as a single-line row on the page (hairlines, no surface), shared by Home and Done
 * (trim-ui §13): `row` name, the prescription `4 × 6` in `caption`, and the trailing lane in
 * `title` + unit. `number`: the load for today (Pro: the target, with an ink ↑ when it rises;
 * free: last heaviest set). `change`: what the lift just did, ↑ / ↓ `2.5 kg`, `same`, or the
 * crown instead of the ↑ on a record.
 *
 * `landed` (Done): the ↑ waits, then rises 8pt into place `delayMs` after the screen lands,
 * and a record's crown pops in (trim-ui §8). Leave it out for a still row.
 */
export function LiftRow({
  name,
  metric,
  number = null,
  change = null,
  units,
  showSeparator,
  landed,
  delayMs = 0,
  testID,
}: {
  name: string;
  metric: string;
  number?: LiftNumber | null;
  change?: LiftChange | null;
  units: Units;
  showSeparator: boolean;
  landed?: boolean;
  delayMs?: number;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_FONT_SCALE;
  const motion = landed == null ? null : { landed, delayMs };
  const trailing = change ? (
    <ChangeValue change={change} units={units} motion={motion} />
  ) : number ? (
    <LoadValue number={number} units={units} />
  ) : null;

  let spoken: string | null = null;
  if (change) {
    spoken =
      change.kind === 'first'
        ? formatLoadWithUnit(change.load, units)
        : change.kind === 'same'
          ? 'same as last time'
          : `${change.kind === 'up' ? 'up' : 'down'} ${formatLoadWithUnit(change.delta, units)}`;
    if (change.record) {
      spoken += ', personal best';
    }
  } else if (number) {
    spoken = `${formatLoadWithUnit(number.load, units)}${number.loadUp != null ? ', up from last time' : ''}`;
  }

  const metricText = (
    <Text
      style={[
        type.caption,
        { fontVariant: ['tabular-nums'] },
        stacked ? { flex: 1 } : { minWidth: METRIC_LANE * fontScale, textAlign: 'right' },
      ]}>
      {metric}
    </Text>
  );
  const trailingLane = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
        gap: space.tight,
        flexShrink: 0,
        minWidth: stacked ? undefined : LOAD_LANE * fontScale,
      }}>
      {trailing}
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={[name, metric.replace(' × ', ' sets of '), spoken].filter(Boolean).join(', ')}
      testID={testID}
      style={{
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
        gap: stacked ? space.tight : space.inline,
        minHeight: ROW_HEIGHT,
        paddingVertical: space.related,
        justifyContent: 'center',
        borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: colors.separator,
      }}>
      <Text style={[type.row, stacked ? null : { flex: 1, minWidth: 0 }]} numberOfLines={stacked ? 2 : 1}>
        {name}
      </Text>
      {stacked ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.inline }}>
          {metricText}
          {trailingLane}
        </View>
      ) : (
        <>
          {metricText}
          {trailingLane}
        </>
      )}
    </View>
  );
}

type Motion = { landed: boolean; delayMs: number } | null;

/**
 * A glyph that sits on the number's line: the lane aligns by baseline, a symbol has none.
 * With `motion`, it waits for the screen to land, then rises 8pt into place (an ↑) or pops in
 * from half size (a record's crown, `SPRING.pop`). Reduce Motion: a fade.
 */
function LaneGlyph({ children, motion, pop = false }: { children: ReactNode; motion: Motion; pop?: boolean }) {
  const reduceMotion = useReducedMotion();
  const still = motion == null;
  const shown = useSharedValue(still ? 1 : 0);
  const offset = useSharedValue(still || reduceMotion || pop ? 0 : ENTER_OFFSET);
  const scale = useSharedValue(still || reduceMotion || !pop ? 1 : 0.5);
  const landed = motion?.landed ?? false;
  const delayMs = motion?.delayMs ?? 0;

  useEffect(() => {
    if (!landed) {
      return;
    }
    // The fade is the reduced-motion moment, so it plays either way.
    shown.set(
      withDelay(
        delayMs,
        withTiming(1, {
          duration: reduceMotion ? DURATION.change : DURATION.enter,
          easing: EASE_OUT,
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    );
    if (reduceMotion) {
      return;
    }
    if (pop) {
      scale.set(withDelay(delayMs, withSpring(1, SPRING.pop)));
    } else {
      offset.set(withDelay(delayMs, withTiming(0, { duration: DURATION.enter, easing: EASE_OUT })));
    }
  }, [delayMs, landed, offset, pop, reduceMotion, scale, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: offset.get() }, { scale: scale.get() }],
  }));

  return <Animated.View style={[{ alignSelf: 'center' }, style]}>{children}</Animated.View>;
}

function Amount({ value, units }: { value: number; units: Units }) {
  const { type } = useTheme();
  return (
    <>
      <Text style={[type.title, { fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={fontScaleCap.title}>
        {formatLoad(value)}
      </Text>
      <Text style={type.caption} maxFontSizeMultiplier={fontScaleCap.title}>
        {units}
      </Text>
    </>
  );
}

/** Today's load; an ink ↑ when the Pro target raises it (change is ink, trim-ui §5). */
function LoadValue({ number, units }: { number: LiftNumber; units: Units }) {
  const { colors } = useTheme();
  return (
    <>
      {number.loadUp != null ? (
        <LaneGlyph motion={null}>
          <SymbolView name="arrow.up" size={iconSize.caption} weight="bold" tintColor={colors.label} />
        </LaneGlyph>
      ) : null}
      <Amount value={number.load} units={units} />
    </>
  );
}

/** What a lift just did: ↑ / ↓ and the difference, `same`, or the crown on a record. */
function ChangeValue({ change, units, motion }: { change: LiftChange; units: Units; motion: Motion }) {
  const { colors, type } = useTheme();
  if (change.kind === 'first') {
    return <Amount value={change.load} units={units} />;
  }
  const glyph = change.record ? (
    <LaneGlyph motion={motion} pop>
      <PrCrown size={iconSize.caption} />
    </LaneGlyph>
  ) : change.kind === 'same' ? null : (
    <LaneGlyph motion={motion}>
      <SymbolView
        name={change.kind === 'up' ? 'arrow.up' : 'arrow.down'}
        size={iconSize.caption}
        weight="bold"
        tintColor={colors.label}
      />
    </LaneGlyph>
  );
  return (
    <>
      {glyph}
      {change.kind === 'same' ? (
        <Text style={type.caption} maxFontSizeMultiplier={fontScaleCap.title}>
          same
        </Text>
      ) : (
        <Amount value={change.delta} units={units} />
      )}
    </>
  );
}
