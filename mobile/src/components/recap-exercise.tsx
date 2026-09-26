import { Text, View } from 'react-native';

import { PrCrown } from '@/components/pr-crown';
import { formatLoggedSetLine, type WeightUnit } from '@/domain/helpers';
import type { LoggedExercise } from '@/domain/types';
import { useTheme } from '@/theme/theme-context';

const SPOKEN_UNIT: Record<WeightUnit, string> = { kg: 'kilograms', lbs: 'pounds' };

/** `60 kg × 8` → `60 kilograms for 8 reps`. */
export function spokenSetLine(line: string, unit: WeightUnit | null): string {
  let spoken = line;
  if (unit) {
    spoken = spoken.replace(` ${unit} `, ` ${SPOKEN_UNIT[unit]} `);
  }
  return spoken.includes('×') ? `${spoken.replace('×', 'for')} reps` : spoken;
}

/**
 * One exercise in a finished-workout recap (Done, History detail): the name, then every
 * set on its own row with the set number in a narrow tabular lane, so a scan down the
 * column reads set by set. The set that beat a prior session carries the yellow crown.
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
  const rows = exercise.sets.map((set, index) => ({
    id: set.id,
    number: index + 1,
    text: formatLoggedSetLine(set, { minutes, unit }),
    pr: prSetIds?.has(set.id) ?? false,
  }));
  const spoken = [
    exercise.exerciseName,
    ...rows.map(
      (row) => `set ${row.number}, ${spokenSetLine(row.text, unit)}${row.pr ? ', personal best' : ''}`,
    ),
  ].join('; ');

  return (
    <View accessible accessibilityLabel={spoken} testID={testID} style={{ paddingVertical: 10 }}>
      <Text style={[type.row, { paddingBottom: 4 }]}>{exercise.exerciseName}</Text>
      {rows.map((row) => (
        <View key={row.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 24 }}>
          <Text
            style={[
              type.kicker,
              { width: 24, color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] },
            ]}>
            {row.number}
          </Text>
          <Text style={[type.kicker, { flexShrink: 1, fontVariant: ['tabular-nums'] }]}>{row.text}</Text>
          {row.pr ? (
            <View style={{ paddingLeft: 6 }}>
              <PrCrown size={12} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
