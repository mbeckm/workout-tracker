/** Title-case like Swift `exerciseCatalogDisplayText`. */
export function exerciseCatalogDisplayText(value: string | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word[0] ? word[0].toUpperCase() + word.slice(1) : ''))
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
