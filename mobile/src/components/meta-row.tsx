import { SymbolView } from 'expo-symbols';
import { Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatDoneWhen } from '@/domain/day-facts';
import { formatWeeklyAverage } from '@/domain/weeks';
import { useTheme } from '@/theme/theme-context';

/**
 * One glanceable fact: `6 exercises`, `~45 min`, `Done Fri 25`. The whole fact is one grey;
 * its number is semibold so the eye still picks it up without ink or an icon. Words (a day, a
 * plan name) have no number, so they stay regular.
 */
export type MetaItem = {
  /** The glanceable part (a count, a time, a day): semibold unless `plain`, tabular. */
  value: string;
  /** Quiet text before the value, spacing included: `Started `, `Done `, `~`. */
  lead?: string;
  /** Quiet text after the value, spacing included: ` exercises`, ` min`. */
  unit?: string;
  /** Read by VoiceOver instead of the visible text: `About 45 minutes`. */
  spoken?: string;
  /**
   * The yellow PR crown: the one symbol a meta row keeps, because it marks a result (a personal
   * best), not the kind of fact. Every other fact is named by its own noun.
   */
  crown?: boolean;
  /** Words, not numbers (a day, a plan name): no semibold value. */
  plain?: boolean;
};

const FONT_SIZE = 15;
const LINE_HEIGHT = 20;
const CROWN = 13;
/** Meta grows with Dynamic Type but stops before it outweighs the title it describes. */
const MAX_SCALE = 1.8;

export function spokenMeta(item: MetaItem): string {
  return item.spoken ?? `${item.lead ?? ''}${item.value}${item.unit ?? ''}`.replace(/^~/, 'About ');
}

/**
 * The house meta row: facts under a title (Home day, Other days, day preview, History,
 * session detail, Done, Weeks). One grey line, `6 exercises · ~45 min · Push Pull Legs`, the
 * same everywhere: no ink numbers, no icons (they repeated the tab bar's own glyphs), only the
 * PR crown. Items wrap whole at large text sizes; a line ends on its `·`, never starts with one.
 */
export function MetaRow({
  items,
  maxScale = MAX_SCALE,
  accessibilityLabel,
  style,
  testID,
}: {
  items: (MetaItem | null | false | undefined)[];
  /** Dynamic Type cap; a lower tier passes a smaller one so it stays under its own title. */
  maxScale?: number;
  /** Overrides the label built from the items (a parent that already reads them passes ''). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const kept = items.filter((item): item is MetaItem => Boolean(item));
  if (kept.length === 0) {
    return null;
  }
  const scale = Math.min(fontScale, maxScale);
  const line = Math.round(LINE_HEIGHT * scale);
  const text = {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    fontWeight: '400' as const,
    color: colors.tertiaryLabel,
    fontVariant: ['tabular-nums' as const],
  };

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? kept.map(spokenMeta).join(', ')}
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          // About one space: the dot hangs on the fact before it, this is the space after it.
          columnGap: 5,
          rowGap: 2,
        },
        style,
      ]}>
      {kept.map((item, index) => (
        <View
          key={`${item.value}-${index}`}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 3, maxWidth: '100%' }}>
          {item.crown ? (
            // Centered on the first line so a wrapped fact keeps its crown at the top.
            <View style={{ height: line, justifyContent: 'center' }}>
              <SymbolView
                name="crown.fill"
                size={Math.round(CROWN * scale)}
                tintColor={colors.systemYellow}
                style={{ width: Math.round(CROWN * scale), height: Math.round(CROWN * scale) }}
              />
            </View>
          ) : null}
          <Text maxFontSizeMultiplier={maxScale} style={[text, { flexShrink: 1 }]}>
            {item.lead}
            {item.plain ? item.value : <Text style={{ fontWeight: '600' }}>{item.value}</Text>}
            {item.unit}
            {index < kept.length - 1 ? ' ·' : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The fact vocabulary: one wording per kind of fact, everywhere in the app. */
export const meta = {
  exercises(count: number): MetaItem {
    return { value: String(count), unit: count === 1 ? ' exercise' : ' exercises' };
  },
  /** A plan's estimate reads `~45 min`; a logged duration reads `45 min`. */
  minutes(minutes: number, { estimate = false }: { estimate?: boolean } = {}): MetaItem {
    const value = Math.max(1, Math.round(minutes));
    const words = value === 1 ? '1 minute' : `${value} minutes`;
    return {
      lead: estimate ? '~' : undefined,
      value: String(value),
      unit: ' min',
      spoken: estimate ? `About ${words}` : words,
    };
  },
  /** `12 sets`, or `4 of 18 sets` while a workout is open. */
  sets(count: number, of?: number): MetaItem {
    const total = of != null ? Math.max(of, count) : null;
    return {
      value: total != null ? `${count} of ${total}` : String(count),
      unit: (total ?? count) === 1 ? ' set' : ' sets',
    };
  },
  /** A day label from the caller's formatter: `Today`, `Wed 13`, `Aug 27`. */
  when(label: string): MetaItem {
    return { value: label, plain: true };
  },
  /** `Done today`, `Done Thu 17`: the last time this day was finished. */
  lastDone(iso: string): MetaItem {
    const when = formatDoneWhen(iso);
    const value = when === 'Today' || when === 'Yesterday' ? when.toLowerCase() : when;
    return { lead: 'Done ', value, plain: true };
  },
  /** An open workout: `Started 18:02`. */
  started(clock: string): MetaItem {
    return { lead: 'Started ', value: clock };
  },
  /** Which plan the day comes from (Home's next workout). */
  plan(name: string): MetaItem {
    return { value: name, plain: true, spoken: `Plan ${name}` };
  },
  prs(count: number): MetaItem {
    return {
      crown: true,
      value: String(count),
      unit: count === 1 ? ' PR' : ' PRs',
      spoken: count === 1 ? '1 personal best' : `${count} personal bests`,
    };
  },
  /** The weekly goal: the active plan's trainable days (`Goal 5 a week`). */
  goal(days: number): MetaItem {
    return { lead: 'Goal ', value: String(days), unit: ' a week' };
  },
  /** Mean workouts per finished week (`Average 3.4`). */
  average(perWeek: number): MetaItem {
    const value = formatWeeklyAverage(perWeek);
    return {
      lead: 'Average ',
      value,
      spoken: `Average ${value} a week`,
    };
  },
  /** A plain leading name (Done: the day title). */
  name(value: string): MetaItem {
    return { value, plain: true };
  },
};
