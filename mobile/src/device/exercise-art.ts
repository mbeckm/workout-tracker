import type { ImageSourcePropType } from 'react-native';

/**
 * Exercise art for the exercise sheet's panel, keyed by catalog name (lower case). A lift
 * without art keeps its SVG movement figure (D5). Device test: Barbell Back Squat only.
 */
const ART: Record<string, ImageSourcePropType> = {
  'barbell back squat': require('../../assets/images/exercise-art/barbell-back-squat.jpg'),
};

export function exerciseArt(name: string | undefined): ImageSourcePropType | undefined {
  return name ? ART[name.trim().toLowerCase()] : undefined;
}
