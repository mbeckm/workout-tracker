import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import {
  finishColors,
  fontScaleCap,
  gadgetRadius,
  gadgetType,
  sheetColors,
  sheetGeometry,
  space,
} from '@/constants/theme';
import { FINISHES, type Finish } from '@/domain/finish';
import { track } from '@/analytics/analytics';
import { useFinish } from '@/device/finish';
import { useHaptics } from '@/device/haptics';
import { useWorkoutStore } from '@/store/workout-store';

import { PillButton, SheetHeader, SheetScroll } from './primitives';
import { useSheetChrome } from './sheet-context';

/**
 * Finishes (SPEC §6 Finishes): a short sheet so the device stays in view and changes live.
 * TODO(Phase 8): D3 locks 305 and 408 for free users (preview, a "Get Trim Pro" pill, revert on
 * close). Until then every finish saves.
 */
export function FinishesSheet() {
  const { close } = useSheetChrome();
  const { finish } = useFinish();
  const { setFinish } = useWorkoutStore();
  const haptics = useHaptics();

  const pick = (id: Finish) => {
    if (id === finish) return;
    haptics.swatch();
    setFinish(id);
    track('finish_selected', { finish: id });
  };

  return (
    <SheetScroll header={<SheetHeader title={`Finish ${finish}, ${finishColors[finish].name}`} />}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.rowContent}>
        {FINISHES.map((id) => (
          <Swatch key={id} id={id} selected={id === finish} onPress={() => pick(id)} />
        ))}
      </ScrollView>
      <PillButton title="Done" variant="dark" onPress={close} style={styles.done} />
    </SheetScroll>
  );
}

function Swatch({ id, selected, onPress }: { id: Finish; selected: boolean; onPress: () => void }) {
  const colors = finishColors[id];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Finish ${id}, ${colors.name}`}
      testID={`finish-${id}`}
      style={[
        styles.swatch,
        {
          backgroundColor: colors.body2,
          experimental_backgroundImage: `linear-gradient(180deg, ${colors.body1}, ${colors.body2})`,
        },
        selected && styles.selected,
      ]}>
      <Text maxFontSizeMultiplier={fontScaleCap.display} style={[gadgetType.swatchNumber, { color: colors.swatchInk }]}>
        {id}
      </Text>
      <Text
        maxFontSizeMultiplier={fontScaleCap.display}
        style={[gadgetType.swatchName, styles.name, { color: colors.swatchSub }]}>
        {colors.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -sheetGeometry.sidePad },
  rowContent: {
    gap: sheetGeometry.swatchGap,
    paddingHorizontal: sheetGeometry.sectionX,
    paddingTop: space.related,
    paddingBottom: space.inset,
  },
  swatch: {
    width: sheetGeometry.swatchW,
    height: sheetGeometry.swatchH,
    borderRadius: gadgetRadius.swatch,
    borderCurve: 'continuous',
    paddingHorizontal: sheetGeometry.swatchPadX,
    paddingVertical: sheetGeometry.swatchPadY,
  },
  selected: {
    transform: [{ rotate: `${sheetGeometry.swatchTilt}deg` }, { translateY: -sheetGeometry.swatchLift }],
    boxShadow: `0 0 0 ${sheetGeometry.swatchRing}px ${sheetColors.ring}, 0 12px 20px ${sheetColors.swatchShadow}`,
  },
  name: { marginTop: space.pair },
  done: { marginTop: space.related },
});
