import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { fontScaleCap, iconSize, space } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

/**
 * The fact glyphs (trim-ui §7 → Fact glyphs). One symbol per kind of fact, the same on every
 * screen, so the eye learns the shape once and finds the fact by it: a glyph stands in for the
 * fact's name (`Last time`, `Target`) or marks a kind that comes back across screens (how
 * long). `word` is what the glyph replaces: VoiceOver reads it, and it's the fallback where SF
 * Symbols don't render (web QA).
 */
export const FACT_GLYPH = {
  /** How long a workout took or will take: `~55 min`, `52 min`. */
  duration: { symbol: 'timer', word: '' },
  /** The previous session's numbers for this set or exercise. */
  lastTime: { symbol: 'clock.arrow.circlepath', word: 'Last time' },
  /** Trim Pro's suggested next set. */
  target: { symbol: 'target', word: 'Target' },
  /** Personal bests in a workout: the PR crown, in its one color (trim-ui §5 Signals). */
  record: { symbol: 'crown.fill', word: '' },
} as const satisfies Record<string, { symbol: SFSymbol; word: string }>;

export type FactKind = keyof typeof FACT_GLYPH;

/**
 * A fact glyph grows with Dynamic Type like the `caption` beside it (trim-ui §7: a symbol takes
 * its text's size), capped where the fact's text is capped.
 */
export function useFactGlyph() {
  const { fontScale } = useWindowDimensions();
  return Math.round(iconSize.caption * Math.min(Math.max(fontScale, 1), fontScaleCap.text));
}

/**
 * One glyph-led fact: `[timer] 52 min`, `[clock.arrow.circlepath] 60 kg × 8`. Caption type,
 * tabular figures. `ink` is the text's tier: tertiary for a fact about the subject, `label` for
 * one you act on (the Pro target). The glyph sits one tier darker than tertiary text
 * (`secondaryLabel`), because a 13pt symbol reads lighter than 15pt type in the same grey; in
 * `label` ink both are `label`.
 */
export function Fact({
  kind,
  children,
  ink = 'tertiary',
  numberOfLines = 1,
  spoken,
  centered = false,
  testID,
}: {
  kind: FactKind;
  children: string;
  ink?: 'tertiary' | 'label';
  numberOfLines?: number;
  /** VoiceOver, when the glyph's word + the text don't say it (`2 personal bests`). */
  spoken?: string;
  /** Centered under a full-width CTA (Home's note under Start). */
  centered?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const size = useFactGlyph();
  const { symbol, word } = FACT_GLYPH[kind];
  const color = ink === 'label' ? colors.label : colors.tertiaryLabel;
  const text = [type.caption, { color, fontVariant: ['tabular-nums' as const] }];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={spoken ?? (word ? `${word} ${children}` : children)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.tight,
        flexShrink: 1,
        alignSelf: centered ? 'center' : undefined,
      }}>
      <SymbolView
        name={symbol}
        tintColor={
          kind === 'record'
            ? colors.systemYellow
            : ink === 'label'
              ? colors.label
              : colors.secondaryLabel
        }
        size={size}
        weight="medium"
        style={{ flexShrink: 0 }}
        fallback={word ? <Text style={text}>{word}</Text> : null}
      />
      <Text
        style={[text, { flexShrink: 1 }]}
        numberOfLines={numberOfLines}
        maxFontSizeMultiplier={fontScaleCap.text}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Several facts on one line, parted by air instead of a separator (trim-ui §9 Separating facts):
 * each fact's glyph already starts a new one. Wraps at large text, facts stay whole.
 */
export function FactRow({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: space.inline,
        rowGap: space.pair,
      }}>
      {children}
    </View>
  );
}
