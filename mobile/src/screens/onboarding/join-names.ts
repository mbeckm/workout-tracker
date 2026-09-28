const NBSP = ' ';

/**
 * `Push, Pull and Legs` for wrapping text, every name shown (trim-ui → Copy → Separating
 * facts). Each name keeps its words together, so a wrapped line never splits "Lat Pulldown".
 */
export function joinNames(names: readonly string[]): string {
  const kept = names.map((name) => name.replace(/ /g, NBSP));
  if (kept.length <= 1) {
    return kept[0] ?? '';
  }
  return `${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`;
}
