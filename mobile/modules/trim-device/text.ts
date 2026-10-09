import { requireOptionalNativeModule } from 'expo';

type TrimTextNative = {
  recognizeText(uri: string): Promise<string[]>;
  prepareImage(uri: string, maxSide: number, quality: number): Promise<string>;
};

// Null on web, Android and dev builds from before the module.
const native = requireOptionalNativeModule<TrimTextNative>('TrimText');

/** True when this build can read text from images (Apple Vision, on device). */
export const canRecognizeText = native != null;

/**
 * Reads the text in an image (`file://` URI, plain path, or base64 `data:image/…` URI) on device, as visual lines top to
 * bottom. Cells on one line are joined with two spaces, so a set table reads `1  60  8`.
 * Rejects with `ERR_IMAGE_LOAD` when the image can't be loaded.
 */
export async function recognizeTextInImage(uri: string): Promise<string[]> {
  if (!native) {
    throw new Error('Text recognition is not available in this build.');
  }
  return native.recognizeText(uri);
}

/**
 * An image as a base64 JPEG (no `data:` prefix) at most `maxSide` px on its longest side, for
 * Import plan's upload. Same inputs as `recognizeTextInImage`.
 */
export async function prepareImageForUpload(uri: string, maxSide = 1568, quality = 0.8): Promise<string> {
  if (!native) {
    throw new Error('Image preparation is not available in this build.');
  }
  return native.prepareImage(uri, maxSide, quality);
}
