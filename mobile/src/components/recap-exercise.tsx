import { Text, useWindowDimensions, View } from 'react-native';

import { PrCrown } from '@/components/pr-crown';
import { iconSize, space } from '@/constants/theme';
import { formatLoggedSetLine, type WeightUnit } from '@/domain/helpers';
import type { LoggedExercise } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

const SPOKEN_UNIT: Record<WeightUnit, string> = { kg: 'kilograms', lbs: 'pounds' };

/** A tabular digit is at most this share of the font size wide in SF Pro. */
const TABULAR_DIGIT_EM = 0.62;

/** `60 kg × 8` → `60 kilograms for 8 reps`. */
export function spokenSetLine(line: string, unit: WeightUnit | null): string {
  let spoken = line;
  if (unit) {
    spoken = spoken.replace(` ${unit} `, ` ${SPOKEN_UNIT[unit]} `);
  }
  return spoken.includes('×') ? `${spoken.replace('×', 'for')} reps` : spoken;
}

/**
 * One exercise in a finished workout's record (History session detail): the `row` name, then one
 * `caption` line per set with the set number in a narrow tertiary lane, so a scan down the
 * column reads set by set. The set that beat a prior session carries the yellow crown.
 *
 * The lane is sized from the current text size and the widest set number, plus a fixed gap,
 * so at large Dynamic Type the number never runs into the value. Lines wrap; they never clip.
 */
export function RecapExercise({
  exercise,
  unit,
  prSetIds,
  minutes,
  testID,
}: {
  exercise: Pick<LoggedExercise, 'id' | 'exerciseName' | 'sets'>;
  unit: WeightUnit | null;
  prSetIds?: ReadonlySet<string>;
  minutes?: boolean;
  testID?: string;
}) {
  const { colors, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  const rows = exercise.sets.map((set, index) => ({
    id: set.id,
    number: index + 1,
    text: formatLoggedSetLine(set, { minutes, unit }),
    pr: prSetIds?.has(set.id) ?? false,
  }));
  const digits = String(rows.length).length;
  const laneWidth = Math.ceil(type.caption.fontSize * fontScale * TABULAR_DIGIT_EM * digits);
  const spoken = [
    exercise.exerciseName,
    ...rows.map(
      (row) => `set ${row.number}, ${spokenSetLine(row.text, unit)}${row.pr ? ', personal best' : ''}`,
    ),
  ].join('; ');

  return (
    <View accessible accessibilityLabel={spoken} testID={testID} style={{ gap: space.pair }}>
      <Text style={type.row} numberOfLines={2}>
        {exercise.exerciseName}
      </Text>
      {rows.map((row) => (
        <View key={row.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.related }}>
          <Text
            style={[type.caption, { minWidth: laneWidth, fontVariant: ['tabular-nums'] }]}>
            {row.number}
          </Text>
          <View
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
            <Text
              style={[
                type.caption,
                { flexShrink: 1, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] },
              ]}>
              {row.text}
            </Text>
            {row.pr ? <PrCrown size={iconSize.caption} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
