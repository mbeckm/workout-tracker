/**
 * Title-case catalog names for display ("barbell bench press" → "Barbell Bench Press"). A word
 * the owner already cased stays as written ("JM press" → "JM Press", "EZ-bar curl" → "EZ-bar
 * Curl"); only all-lowercase words get a capital. History matches names case-insensitively.
 */
export function exerciseCatalogDisplayText(value: string | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === word.toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export function normalizedExerciseCatalogKey(value: string | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizedExerciseCatalogWords(value: string): string[] {
  return normalizedExerciseCatalogKey(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
