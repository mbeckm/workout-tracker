/**
 * Writes the bundled catalog's names (and their search aliases) to `server/catalog-names.json`,
 * so the import endpoint can steer Claude to Trim's own names (decision 88). Run after adding
 * catalog rows: `npx tsx scripts/export-catalog-names.ts`.
 */
import { BUNDLED_EXERCISES, bundledSearchAliases } from '@/catalog/bundled';

const rows = BUNDLED_EXERCISES.map((exercise) => {
  const aliases = bundledSearchAliases(exercise.id);
  return aliases.length ? `${exercise.name}; also: ${aliases.join(', ')}` : exercise.name;
});
declare function require(id: 'node:fs'): { writeFileSync(path: string, data: string): void };
// Run from `mobile/`, like the check scripts.
const target = '../server/catalog-names.json';
require('node:fs').writeFileSync(target, `${JSON.stringify(rows, null, 1)}\n`);
console.log(`Wrote ${rows.length} names to ${target}`);
