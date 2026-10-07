import { View, type StyleProp, type ViewStyle } from 'react-native';

import { device } from '@/constants/theme';
import { useFinish } from '@/device/finish';

import { WellRing } from './finish-marks';

/** The 170pt recessed well the big key sits in (`.well`); Bunker rings it in brass. */
export function Well({ style }: { style?: StyleProp<ViewStyle> }) {
  const { palette } = useFinish();
  const size = device.wellSize;
  return (
    <View
      pointerEvents="none"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.well,
          boxShadow: `inset 0 4px 10px ${palette.wellShade}, 0 1px 0 ${palette.recessRimStrong}`,
        },
        style,
      ]}>
      <WellRing size={size} />
    </View>
  );
}
