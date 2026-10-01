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

/** A single-line row: a 44pt touch target plus the air a 22pt load needs (Paper V4: 48). */
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
 * One lift as a row on the page (hairlines, no surface), shared by Home, Done and a trained
 * day's sheet (trim-ui §13): `row` name and the trailing lane in `valueCompact` + unit.
 * `number`: the load for today (Pro: the target, with an ink ↑ when it rises; free: last
 * heaviest set). `change`: what the lift just did, ↑ / ↓ `2.5 kg`, `same`, or the crown
 * instead of the ↑ on a record.
 *
 * `metric` (Done): the prescription `4 × 6` in `caption`, on the name's line in its own lane.
 * Home leaves it out: the rows say what to lift, the day editor says how many.
 * `detail` (a trained day's sheet): a `caption` line under the name (`80 kg × 8`), making it
 * a two-line row. `detailSpoken` replaces how VoiceOver reads it (Home's prescription line).
 *
 * `riseBelow` (Home): the Pro target's rise goes on its own line under the load, `↑ 2.5 kg`,
 * level with the prescription under the name, instead of a bare ↑ beside the load: the amount
 * says what the arrow means (PRODUCT-DECISIONS 69).
 *
 * `landed` (Done): the ↑ waits, then rises 8pt into place `delayMs` after the screen lands,
 * and a record's crown pops in (trim-ui §8). Leave it out for a still row.
 */
export function LiftRow({
  name,
  metric,
  detail,
  detailSpoken,
  number = null,
  change = null,
  units,
  showSeparator,
  riseBelow = false,
  landed,
  delayMs = 0,
  testID,
}: {
  name: string;
  metric?: string;
  detail?: string;
  detailSpoken?: string;
  number?: LiftNumber | null;
  change?: LiftChange | null;
  units: Units;
  showSeparator: boolean;
  riseBelow?: boolean;
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
    <LoadValue number={number} units={units} riseBelow={riseBelow} />
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

  const metricText = metric ? (
    <Text
      style={[
        type.caption,
        { fontVariant: ['tabular-nums'] },
        stacked ? { flex: 1 } : { minWidth: METRIC_LANE * fontScale, textAlign: 'right' },
      ]}>
      {metric}
    </Text>
  ) : null;
  // Every row keeps the lane, even empty, so the names in a list wrap at one edge (trim-ui §4).
  const trailingLane = trailing || !stacked ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
        gap: space.tight,
        flexShrink: 0,
        // Stacked with no metric beside it, the lane still ends on the row's trailing edge.
        flexGrow: stacked && !metric ? 1 : 0,
        minWidth: stacked ? undefined : LOAD_LANE * fontScale,
      }}>
      {trailing}
    </View>
  ) : null;
  const nameText = (
    <Text
      style={[type.row, stacked || detail ? null : { flex: 1, minWidth: 0 }]}
      numberOfLines={stacked || detail ? 2 : 1}>
      {name}
    </Text>
  );
  const lead = detail ? (
    <View style={stacked ? { gap: space.pair } : { flex: 1, minWidth: 0, gap: space.pair }}>
      {nameText}
      <Text style={[type.caption, { fontVariant: ['tabular-nums'] }]} numberOfLines={2}>
        {detail}
      </Text>
    </View>
  ) : (
    nameText
  );
  const spokenMetric = metric ? metric.replace(' × ', ' sets of ') : null;
  const spokenDetail = detailSpoken ?? (detail ? detail.replace(' × ', ' for ') : null);

  return (
    <View
      accessible
      accessibilityLabel={[name, spokenMetric, spokenDetail, spoken].filter(Boolean).join(', ')}
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
      {lead}
      {stacked ? (
        metricText || trailingLane ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.inline }}>
            {metricText}
            {trailingLane}
          </View>
        ) : null
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
      <Text style={[type.valueCompact, { fontVariant: ['tabular-nums'] }]} maxFontSizeMultiplier={fontScaleCap.title}>
        {formatLoad(value)}
      </Text>
      <Text style={type.caption} maxFontSizeMultiplier={fontScaleCap.title}>
        {units}
      </Text>
    </>
  );
}

/**
 * Today's load; an ink ↑ when the Pro target raises it (change is ink, trim-ui §5), beside the
 * load or, with `riseBelow`, as `↑ 2.5 kg` on a line under it.
 */
function LoadValue({ number, units, riseBelow }: { number: LiftNumber; units: Units; riseBelow: boolean }) {
  const { colors, type } = useTheme();
  if (riseBelow && number.loadUp != null) {
    return (
      <View style={{ alignItems: 'flex-end', gap: space.pair }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.tight }}>
          <Amount value={number.load} units={units} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
          <SymbolView name="arrow.up" size={iconSize.caption} weight="bold" tintColor={colors.label} />
          <Text
            style={[type.caption, { color: colors.label, fontVariant: ['tabular-nums'] }]}
            maxFontSizeMultiplier={fontScaleCap.title}>
            {formatLoadWithUnit(number.loadUp, units)}
          </Text>
        </View>
      </View>
    );
  }
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
