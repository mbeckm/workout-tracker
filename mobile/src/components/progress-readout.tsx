import { useState, type ReactNode } from 'react';
import { Text, useWindowDimensions, View, type TextLayoutEvent } from 'react-native';

import { ProgressLineChart } from '@/components/progress-line-chart';
import { space } from '@/constants/theme';
import type { ProgressPoint } from '@/domain/progress';
import { useTheme } from '@/theme/theme-context';

const CHART_HEIGHT = 180;

/**
 * The readout and the chart as one object (trim-ui §11 rule 11, lift detail v5): a `caption`
 * (the scrubbed date takes its place), the `hero` on the left and the ink delta right-aligned
 * on the same line, above the chart's latest point, then the chart full-bleed directly under
 * it. At large text the delta drops under the hero instead of crowding it.
 */
export function ProgressReadout({
  caption,
  hero,
  unit,
  delta,
  points,
  emptyText,
  onScrub,
  accessibilityLabel,
  goal = null,
  goalLabel,
  firstLabel,
}: {
  caption: string;
  /** The number alone, in `hero` (a `StaggerValue`, so scrubbing rolls it). */
  hero: ReactNode;
  /** Its unit, set small in `title` on the number's baseline (Paper `Lift detail v5`). */
  unit: string;
  delta: ReactNode;
  points: ProgressPoint[];
  /** Where the chart would be when the range has no points (same height, so nothing jumps). */
  emptyText: string;
  onScrub: (point: ProgressPoint | null) => void;
  accessibilityLabel?: string;
  goal?: number | null;
  goalLabel?: string;
  firstLabel?: string;
}) {
  const { type } = useTheme();
  const { width } = useWindowDimensions();
  const baseline = useBaselineLift();
  // `title` with no lineHeight, like the NumberFlow runs beside it: every box then ends at its
  // font's descender, which is what the lift below measures.
  const { lineHeight: _lineHeight, ...unitStyle } = type.title;
  return (
    <View>
      <Text style={type.caption}>{caption}</Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          columnGap: space.inline,
          rowGap: space.tight,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.tight }}>
          {hero}
          <Text style={[unitStyle, { marginBottom: baseline.lift }]}>{unit}</Text>
        </View>
        {delta ? <View style={{ marginBottom: baseline.lift }}>{delta}</View> : null}
      </View>
      {baseline.probes}
      {/* Full-bleed: out of the page gutter, edge to edge; the line keeps the text edges. */}
      <View style={{ marginHorizontal: -space.gutter, paddingTop: space.related }}>
        {points.length > 0 ? (
          <ProgressLineChart
            points={points}
            width={width}
            height={CHART_HEIGHT}
            inset={space.gutter}
            goal={goal}
            goalLabel={goalLabel}
            firstLabel={firstLabel}
            onScrub={onScrub}
            accessibilityLabel={accessibilityLabel}
          />
        ) : (
          <View style={{ height: CHART_HEIGHT, paddingHorizontal: space.gutter }}>
            <Text style={type.caption}>{emptyText}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * NumberFlow has no text baseline for flexbox to align to, so the small `title` runs (the unit,
 * the delta) sit on the hero number's baseline by lifting them off the shared bottom edge by
 * the difference of the two fonts' descenders, measured from hidden text at the current
 * Dynamic Type size.
 */
function useBaselineLift(): { lift: number; probes: ReactNode } {
  const { type } = useTheme();
  const [heroDescender, setHeroDescender] = useState(0);
  const [titleDescender, setTitleDescender] = useState(0);
  const { lineHeight: _heroLine, ...heroStyle } = type.hero;
  const { lineHeight: _titleLine, ...titleStyle } = type.title;
  const read = (set: (value: number) => void) => (event: TextLayoutEvent) =>
    set(event.nativeEvent.lines[0]?.descender ?? 0);
  const probe = { position: 'absolute' as const, opacity: 0, left: 0, top: 0 };
  return {
    lift: Math.max(0, heroDescender - titleDescender),
    probes: (
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[heroStyle, probe]} onTextLayout={read(setHeroDescender)}>
          0
        </Text>
        <Text style={[titleStyle, probe]} onTextLayout={read(setTitleDescender)}>
          0
        </Text>
      </View>
    ),
  };
}
