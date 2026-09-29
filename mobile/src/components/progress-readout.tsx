import type { ReactNode } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

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
  hero: ReactNode;
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
  return (
    <View>
      <Text style={type.caption}>{caption}</Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          columnGap: space.inline,
          rowGap: space.tight,
        }}>
        {hero}
        {delta}
      </View>
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
