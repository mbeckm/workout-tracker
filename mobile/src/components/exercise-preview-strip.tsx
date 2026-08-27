import { Text, View } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-thumb';
import { radius } from '@/constants/theme';
import { useTheme } from '@/theme/theme-context';

const PREVIEW_COUNT = 3;
const PREVIEW_WIDTH = 44;
const PREVIEW_HEIGHT = 30;

export function ExercisePreviewStrip({
  items,
  maxItems = PREVIEW_COUNT,
  width = PREVIEW_WIDTH,
  height = PREVIEW_HEIGHT,
}: {
  items: { id: string; name: string; uri: string | null }[];
  maxItems?: number;
  width?: number;
  height?: number;
}) {
  const { colors, type } = useTheme();
  if (items.length === 0) {
    return null;
  }

  const preview = items.slice(0, maxItems);
  const extra = items.length - preview.length;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        alignSelf: 'flex-start',
        backgroundColor: colors.secondarySystemBackground,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        paddingHorizontal: 10,
        paddingVertical: 8,
      }}>
      {preview.map((item, index) => (
        <ExerciseThumb
          key={`${item.id}-${index}`}
          uri={item.uri}
          name={item.name}
          width={width}
          height={height}
          animated={false}
        />
      ))}
      {extra > 0 ? (
        <Text style={[type.caption, { fontWeight: '600', paddingHorizontal: 2 }]}>+{extra}</Text>
      ) : null}
    </View>
  );
}
