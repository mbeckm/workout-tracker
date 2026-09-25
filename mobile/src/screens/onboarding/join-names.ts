const NBSP = ' ';

/**
 * `A · B · C` for wrapping text. Lines break only between names: each name keeps its
 * words together, and each dot stays with the name before it, so a wrapped line never
 * splits "Lat Pulldown" or starts with a stray `·`.
 */
export function joinNames(names: readonly string[]): string {
  return names.map((name) => name.replace(/ /g, NBSP)).join(`${NBSP}· `);
}
