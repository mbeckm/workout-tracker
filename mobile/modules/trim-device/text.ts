import { requireOptionalNativeModule } from 'expo';

type TrimTextNative = {
  recognizeText(uri: string): Promise<string[]>;
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
