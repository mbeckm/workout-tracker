import { useState } from 'react';
import { Text, View } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-thumb';
import { useTheme } from '@/theme/theme-context';

const STILL_SIZE = 44;
const STILL_GAP = 6;
const PLUS_WIDTH = 40;

function stillsThatFit(rowWidth: number, count: number) {
  if (count <= 0) {
    return 0;
  }
  if (rowWidth <= 0) {
    return count;
  }
  for (let n = count; n >= 1; n -= 1) {
    const stillsWidth = n * STILL_SIZE + (n - 1) * STILL_GAP;
    const overflowLabel = n < count ? PLUS_WIDTH : 0;
    if (stillsWidth + overflowLabel <= rowWidth) {
      return n;
    }
  }
  return 1;
}

export function HomeStills({ items }: { items: { id: string; name: string; uri: string | null }[] }) {
  const { colors, type } = useTheme();
  const [rowWidth, setRowWidth] = useState(0);

  if (items.length === 0) {
    return null;
  }

  const visible = stillsThatFit(rowWidth, items.length);
  const preview = items.slice(0, visible);
  const extra = items.length - preview.length;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width !== rowWidth) {
          setRowWidth(width);
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: STILL_GAP,
        width: '100%',
        height: STILL_SIZE,
        overflow: 'hidden',
      }}>
      {preview.map((item, index) => (
        <ExerciseThumb
          key={`${item.id}-${index}`}
          uri={item.uri}
          name={item.name}
          size={STILL_SIZE}
          animated={false}
          contentFit="contain"
          backgroundColor={colors.systemGray5}
        />
      ))}
      {extra > 0 ? (
        <Text
          style={{
            ...type.kicker,
            fontWeight: '500',
            paddingLeft: 8,
          }}>
          +{extra}
        </Text>
      ) : null}
    </View>
  );
}
