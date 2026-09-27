import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatDoneWhen } from '@/domain/day-facts';
import { formatWeeklyAverage } from '@/domain/weeks';
import { useTheme } from '@/theme/theme-context';

/**
 * One glanceable fact: an SF Symbol that names the kind of fact, then the value in ink with
 * its noun in grey (`[clock] 45 min`). The number is what the eye picks up; the icon says what it
 * is, so the noun can stay quiet. Words (a day, a plan) stay grey: only numbers carry ink.
 */
export type MetaItem = {
  /** Names the kind of fact. Omit only for a plain name (Done leads with the day title). */
  symbol?: SFSymbol;
  /** The glanceable part (a count, a time, a day): ink, semibold, tabular. */
  value: string;
  /** Quiet text before the value, spacing included: `Started `, `Done `, `~`. */
  lead?: string;
  /** Quiet text after the value, spacing included: ` exercises`, ` min`. */
  unit?: string;
  /** Read by VoiceOver instead of the visible text: `About 45 minutes`. */
  spoken?: string;
  /** The PR crown is the one tinted icon (yellow); every other icon stays grey. */
  tint?: 'yellow';
  /**
   * Words, not numbers (a day, a plan name): the whole item stays grey so only counts and
   * times carry ink. Keeps a list row's title the loudest thing in the row.
   */
  plain?: boolean;
};

const FONT_SIZE = 15;
const LINE_HEIGHT = 20;
/** Symbol height; wide glyphs (dumbbell) use the extra slot width instead of shrinking. */
const ICON = 14;
const ICON_SLOT = 18;
/** Meta grows with Dynamic Type but stops before it outweighs the title it describes. */
const MAX_SCALE = 1.8;

export function spokenMeta(item: MetaItem): string {
  return item.spoken ?? `${item.lead ?? ''}${item.value}${item.unit ?? ''}`.replace(/^~/, 'About ');
}

/**
 * The house meta row: facts under a title (Home day, day preview, History, session detail,
 * Done). Items wrap as whole units at large text sizes; they never truncate mid-fact.
 */
export function MetaRow({
  items,
  tone = 'default',
  maxScale = MAX_SCALE,
  accessibilityLabel,
  style,
  testID,
}: {
  items: (MetaItem | null | false | undefined)[];
  /**
   * `quiet` keeps numbers grey (still semibold) for a lower tier, e.g. Home's Other days:
   * ink numbers there would compete with the next workout's own meta row.
   */
  tone?: 'default' | 'quiet';
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
          columnGap: 14,
          rowGap: 2,
        },
        style,
      ]}>
      {kept.map((item, index) => (
        <View
          key={`${item.symbol ?? 'text'}-${index}`}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, maxWidth: '100%' }}>
          {item.symbol ? (
            // Centered on the first line so a wrapped value keeps its icon at the top.
            <View style={{ height: line, justifyContent: 'center' }}>
              <SymbolView
                name={item.symbol}
                size={Math.round(ICON * scale)}
                weight="semibold"
                tintColor={item.tint === 'yellow' ? colors.systemYellow : colors.tertiaryLabel}
                style={{ width: Math.round(ICON_SLOT * scale), height: Math.round(ICON * scale) }}
              />
            </View>
          ) : null}
          <Text
            maxFontSizeMultiplier={maxScale}
            style={{
              flexShrink: 1,
              fontSize: FONT_SIZE,
              lineHeight: LINE_HEIGHT,
              fontWeight: '500',
              color: colors.tertiaryLabel,
              fontVariant: ['tabular-nums'],
            }}>
            {item.lead}
            {item.plain ? (
              item.value
            ) : (
              <Text
                style={{
                  color: tone === 'quiet' ? colors.tertiaryLabel : colors.label,
                  fontWeight: '600',
                }}>
                {item.value}
              </Text>
            )}
            {item.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The fact vocabulary: one symbol per kind of fact, everywhere in the app. */
export const meta = {
  exercises(count: number): MetaItem {
    return { symbol: 'dumbbell', value: String(count), unit: count === 1 ? ' exercise' : ' exercises' };
  },
  /** A plan's estimate reads `~45 min`; a logged duration reads `45 min`. */
  minutes(minutes: number, { estimate = false }: { estimate?: boolean } = {}): MetaItem {
    const value = Math.max(1, Math.round(minutes));
    const words = value === 1 ? '1 minute' : `${value} minutes`;
    return {
      symbol: 'clock',
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
      symbol: 'checklist',
      value: total != null ? `${count} of ${total}` : String(count),
      unit: (total ?? count) === 1 ? ' set' : ' sets',
    };
  },
  /** A day label from the caller's formatter: `Today`, `Wed 13`, `Aug 27`. */
  when(label: string): MetaItem {
    return { symbol: 'calendar', value: label, plain: true };
  },
  /** `Done today`, `Done Thu 17`: the last time this day was finished. */
  lastDone(iso: string): MetaItem {
    const when = formatDoneWhen(iso);
    const value = when === 'Today' || when === 'Yesterday' ? when.toLowerCase() : when;
    return { symbol: 'calendar', lead: 'Done ', value, plain: true };
  },
  /** An open workout: `Started 18:02`. */
  started(clock: string): MetaItem {
    return { symbol: 'timer', lead: 'Started ', value: clock };
  },
  /** Which plan, when there is more than one to tell apart. */
  plan(name: string): MetaItem {
    return { symbol: 'list.bullet', value: name, plain: true };
  },
  prs(count: number): MetaItem {
    return {
      symbol: 'crown.fill',
      tint: 'yellow',
      value: String(count),
      unit: count === 1 ? ' PR' : ' PRs',
      spoken: count === 1 ? '1 personal best' : `${count} personal bests`,
    };
  },
  /** The weekly goal: the active plan's trainable days (`Goal 5 a week`). */
  goal(days: number): MetaItem {
    return { symbol: 'target', lead: 'Goal ', value: String(days), unit: ' a week' };
  },
  /** Mean workouts per finished week (`Average 3.4`). */
  average(perWeek: number): MetaItem {
    const value = formatWeeklyAverage(perWeek);
    return {
      symbol: 'chart.bar',
      lead: 'Average ',
      value,
      spoken: `Average ${value} a week`,
    };
  },
  /** A plain leading name with no symbol (Done: the day title). */
  name(value: string): MetaItem {
    return { value, plain: true };
  },
};
