import { useFonts } from 'expo-font';
import { Platform } from 'react-native';

/**
 * The device faces (PLAN §4.6). On iOS the `expo-font` config plugin embeds them in the build,
 * so they're ready at launch; the web build loads them at runtime. Family = PostScript name.
 */
const DEVICE_FONTS = {
  'Doto-Black': require('../../assets/fonts/Doto-Black.ttf'),
  'IBMPlexMono-Medium': require('../../assets/fonts/IBMPlexMono-Medium.ttf'),
  'IBMPlexMono-Bold': require('../../assets/fonts/IBMPlexMono-Bold.ttf'),
};

function useWebFonts(): boolean {
  const [loaded, error] = useFonts(DEVICE_FONTS);
  // A failed load falls back to system faces rather than blocking the app.
  return loaded || error != null;
}

function useEmbeddedFonts(): boolean {
  return true;
}

/** True once the device faces can render. */
export const useAppFonts: () => boolean = Platform.OS === 'web' ? useWebFonts : useEmbeddedFonts;
