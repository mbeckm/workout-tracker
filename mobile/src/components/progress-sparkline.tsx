import { View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

function normalize(values: number[], height: number): { x: number; y: number }[] {
  if (values.length === 0) {
    return [];
  }
  if (values.length === 1) {
    return [{ x: 1, y: height / 2 }];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const last = values.length - 1;

  return values.map((value, index) => ({
    x: index / last,
    y: height - ((value - min) / range) * (height - 4) - 2,
  }));
}

export function ProgressSparkline({
  values,
  width = 52,
  height = 18,
  emphasizeEnd = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  emphasizeEnd?: boolean;
}) {
  const { colors } = useTheme();

  if (values.length < 2) {
    return <View style={{ width, height }} />;
  }

  const points = normalize(values, height);

  return (
    <View style={{ width, height, position: 'relative' }}>
      {points.slice(1).map((point, index) => {
        const prev = points[index];
        const dx = (point.x - prev.x) * width;
        const dy = point.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`seg-${index}`}
            style={{
              position: 'absolute',
              left: prev.x * width,
              top: prev.y,
              width: length,
              height: 1.5,
              backgroundColor: colors.tertiaryLabel,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            }}
          />
        );
      })}
      {emphasizeEnd ? (
        <View
          style={{
            position: 'absolute',
            left: points[points.length - 1].x * width - 2.2,
            top: points[points.length - 1].y - 2.2,
            width: 4.4,
            height: 4.4,
            borderRadius: 999,
            backgroundColor: colors.label,
          }}
        />
      ) : null}
    </View>
  );
}
