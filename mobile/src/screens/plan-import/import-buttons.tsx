import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { fontScaleCap, gadgetType, importGeometry, importType, sheetColors, space } from '@/constants/theme';
import { PRESS_SCALE } from '@/motion';

import { usePulseStyle } from './import-art';
import type { ImportInput } from './session';

/** Screenshots: a routine rarely spans more than a few. */
const MAX_SCREENSHOTS = 10;

/** How far below the art each button's centre sits, for the illustration's flights. */
export function importButtonReach(pillHeight: number, gapAbove: number) {
  return {
    paste: gapAbove + pillHeight / 2,
    screenshots: gapAbove + pillHeight + space.related + pillHeight / 2,
  };
}

/**
 * Import plan's two ways in (decision 88), as two matching Trim pills. Paste reads the clipboard
 * (text, else an image); iOS asks the owner to allow it, which a paste they just tapped expects.
 * Apple's own paste control skips that prompt but draws in the system font and breaks at large
 * text sizes, so it was dropped in visual QA. Screenshots opens the photo picker (no library
 * access needed) for up to ten, in the order picked.
 */
export function ImportButtons({
  t,
  pillHeight,
  onInput,
}: {
  t: SharedValue<number>;
  pillHeight: number;
  onInput: (input: ImportInput) => void;
}) {
  const pastePulse = usePulseStyle(t, 'paste');
  const shotsPulse = usePulseStyle(t, 'screenshots');

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text.trim()) {
      onInput({ kind: 'text', text });
      return;
    }
    if (await Clipboard.hasImageAsync()) {
      const image = await Clipboard.getImageAsync({ format: 'jpeg', jpegQuality: 0.9 });
      if (image) onInput({ kind: 'images', uris: [image.data] });
    }
  };

  const pickScreenshots = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_SCREENSHOTS,
      orderedSelection: true,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      onInput({ kind: 'images', uris: result.assets.map((asset) => asset.uri) });
    }
  };

  const pill = { height: pillHeight, borderRadius: pillHeight / 2 };

  return (
    <View style={styles.stack}>
      <Animated.View style={pastePulse}>
        <Pill
          title="Paste"
          light
          style={pill}
          onPress={() => void paste()}
          testID="import-paste"
          icon={
            <>
              <Rect x={8} y={3} width={8} height={4} rx={1} />
              <Path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            </>
          }
        />
      </Animated.View>
      <Animated.View style={shotsPulse}>
        <Pill
          title="Screenshots"
          style={pill}
          onPress={() => void pickScreenshots()}
          testID="import-screenshots"
          icon={
            <>
              <Rect x={3} y={4} width={18} height={16} rx={3} />
              <Circle cx={9} cy={10} r={2} />
              <Path d="M21 16l-5-5-9 9" />
            </>
          }
        />
      </Animated.View>
      <Text maxFontSizeMultiplier={fontScaleCap.text} style={[importType.choiceMeta, styles.note]}>
        {IMPORT_NOTE}
      </Text>
    </View>
  );
}

/** Where an import goes (decision 88): said once, where it's sent, in plain words. */
export const IMPORT_NOTE = 'Trim sends what you import to Claude by Anthropic to read it. Trim doesn’t keep it.';

function Pill({
  title,
  icon,
  light = false,
  style,
  onPress,
  testID,
}: {
  title: string;
  icon: React.ReactNode;
  light?: boolean;
  style: { height: number; borderRadius: number };
  onPress: () => void;
  testID: string;
}) {
  const ink = light ? sheetColors.pillLightInk : sheetColors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.pill,
        style,
        { backgroundColor: light ? sheetColors.pillLight : sheetColors.pillDark },
        pressed && styles.pressed,
      ]}>
      <Svg
        width={importGeometry.rowIcon - 2}
        height={importGeometry.rowIcon - 2}
        viewBox="0 0 24 24"
        fill="none"
        stroke={ink}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        accessible={false}>
        {icon}
      </Svg>
      <Text maxFontSizeMultiplier={fontScaleCap.title} style={[gadgetType.pill, { color: ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.related },
  note: { textAlign: 'center', paddingHorizontal: space.gutter },
  pill: {
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.inline,
  },
  pressed: { transform: [{ scale: PRESS_SCALE }] },
});
