/**
 * One switch for everything the exercise catalog could load from outside the app.
 *
 * Trim 1.0 ships local-only: the bundled first-party catalog plus the user's custom
 * exercises, with no remote media and no remote search. Licensed media or search can
 * come back in an update by setting these flags; the provider code stays behind them.
 *
 * Expo inlines `EXPO_PUBLIC_*` only for static `process.env.EXPO_PUBLIC_X` access, so
 * every read below is spelled out (no `process.env[key]`).
 */

type RemoteCatalogSearch = 'off' | 'oss' | 'rapidapi';

function flag(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function remoteSearchMode(): RemoteCatalogSearch {
  const value = flag(process.env.EXPO_PUBLIC_EXERCISE_REMOTE_SEARCH);
  // OSS ExerciseDB is non-commercial: development builds only, never a release.
  if (value === 'oss' && __DEV__) {
    return 'oss';
  }
  // Commercial ExerciseDB needs a key (and, for production, a proxy that holds it).
  if (value === 'rapidapi' && flag(process.env.EXPO_PUBLIC_EXERCISEDB_RAPIDAPI_KEY)) {
    return 'rapidapi';
  }
  return 'off';
}

export const CATALOG = {
  /** Remote media (thumbnails, GIFs) on any surface. Off unless a licensed source exists. */
  media: flag(process.env.EXPO_PUBLIC_EXERCISE_MEDIA) === 'on',
  /** `off` (default) | `oss` (dev-only) | `rapidapi` (key + proxy required). */
  remote: remoteSearchMode(),
} as const;
