import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { momentColors, receiptGeometry } from '@/constants/theme';

/**
 * The moments' dark grid ground (SPEC §1 Moments; QC2 `.grid`): #0E0E0D with 1 pt lines of
 * white at .04 every 28. Fills its parent.
 */
export function GridGround() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const cell = receiptGeometry.gridCell;
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current?.width === width && current.height === height ? current : { width, height }));
  };
  return (
    <View style={[StyleSheet.absoluteFill, styles.ground]} onLayout={onLayout} pointerEvents="none">
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <Pattern id="momentGrid" width={cell} height={cell} patternUnits="userSpaceOnUse">
              <Path
                d={`M0,0.5 H${cell} M0.5,0 V${cell}`}
                stroke={momentColors.gridLine}
                strokeOpacity={momentColors.gridLineOpacity}
                strokeWidth={1}
              />
            </Pattern>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#momentGrid)" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { backgroundColor: momentColors.ground },
});
