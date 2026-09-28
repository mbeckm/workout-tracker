#!/usr/bin/env node
/**
 * Design-token ratchet (trim-ui → Enforcement).
 *
 * Counts raw design values in mobile/src per file and rule, and compares them with
 * design-tokens-baseline.json. A file may never gain violations; the baseline only shrinks.
 *
 *   node scripts/check-design-tokens.mjs            check (CI, before a push)
 *   node scripts/check-design-tokens.mjs --update   rewrite the baseline after cleaning up
 *   node scripts/check-design-tokens.mjs --list     print every current violation
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'design-tokens-baseline.json');

/** Token sources define the raw values; everything else consumes them. */
const EXEMPT = new Set(['constants/theme.ts', 'motion.ts']);

const SPACING_SCALE = new Set([0, 2, 4, 8, 12, 16, 24, 32, 48, 64]);

/** Each rule: a name, what to use instead, and a line test. */
const RULES = [
  {
    id: 'raw-font-size',
    fix: 'use a `type` role',
    test: (line) => /\bfontSize:\s*\d/.test(line),
  },
  {
    id: 'raw-font-weight',
    fix: 'use a `type` role (700 / 500 / 400 only)',
    test: (line) => /\bfontWeight:\s*['"]\d00['"]/.test(line),
  },
  {
    id: 'raw-color',
    fix: 'use `colors.*`',
    test: (line) => /['"]#[0-9a-fA-F]{3,8}['"]|\brgba?\(/.test(line),
  },
  {
    id: 'off-scale-spacing',
    fix: 'use `space.*` (2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64)',
    test: (line) => {
      const re = /\b(?:padding|margin|gap|rowGap|columnGap)(?:Top|Bottom|Left|Right|Horizontal|Vertical)?:\s*(-?\d+(?:\.\d+)?)\b/g;
      let match;
      while ((match = re.exec(line))) {
        if (!SPACING_SCALE.has(Math.abs(Number(match[1])))) return true;
      }
      return false;
    },
  },
  {
    id: 'raw-spacing',
    fix: 'use `space.*` instead of a number',
    test: (line) =>
      /\b(?:padding|margin|gap|rowGap|columnGap)(?:Top|Bottom|Left|Right|Horizontal|Vertical)?:\s*[1-9]/.test(line),
  },
  {
    id: 'raw-radius',
    fix: 'use `radius.*`',
    test: (line) => /\bborderRadius:\s*\d/.test(line),
  },
  {
    id: 'raw-duration',
    fix: 'use `DURATION.*` or `SPRING.*`',
    test: (line) => /\bduration:\s*\d|\.duration\(\d|\.delay\(\d|transitionDuration:\s*['"`]\d/.test(line),
  },
  {
    id: 'raw-pressed-opacity',
    fix: 'use `PRESSED_OPACITY`',
    test: (line) => /\bpressed\b[^?\n]*\?\s*0?\.\d/.test(line),
  },
  {
    id: 'raw-icon-size',
    fix: 'use `iconSize.*`',
    test: (line) => /<SymbolView\b[^>]*\bsize=\{\d/.test(line) || /^\s*size=\{\d+\}/.test(line),
  },
  {
    id: 'gesture-hint-copy',
    fix: 'no instructions in the UI (trim-ui → Copy); VoiceOver hints are fine',
    test: (line) =>
      !/accessibilityHint|accessibilityLabel/.test(line) &&
      /(?:>|['"`])\s*(?:Tap|Drag|Swipe|Hold|Long-press|Press) (?:to|and)\b/.test(line),
  },
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

function scan() {
  const counts = {};
  const hits = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).split('\\').join('/');
    if (EXEMPT.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const rule of RULES) {
        if (rule.test(line)) {
          counts[rel] ??= {};
          counts[rel][rule.id] = (counts[rel][rule.id] ?? 0) + 1;
          hits.push({ file: rel, line: index + 1, rule, text: line.trim() });
        }
      }
    });
  }
  return { counts, hits };
}

function sorted(counts) {
  return Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map((file) => [file, Object.fromEntries(Object.keys(counts[file]).sort().map((id) => [id, counts[file][id]]))]),
  );
}

const { counts, hits } = scan();
const args = new Set(process.argv.slice(2));

if (args.has('--list')) {
  for (const hit of hits) console.log(`${hit.file}:${hit.line}  ${hit.rule.id}  ${hit.text}`);
  process.exit(0);
}

if (args.has('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(sorted(counts), null, 2)}\n`);
  const total = hits.length;
  console.log(`Baseline written: ${total} known violations in ${Object.keys(counts).length} files.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const failures = [];
let improved = 0;
for (const [file, rules] of Object.entries(counts)) {
  for (const [id, count] of Object.entries(rules)) {
    const allowed = baseline[file]?.[id] ?? 0;
    if (count > allowed) failures.push({ file, id, count, allowed });
  }
}
for (const [file, rules] of Object.entries(baseline)) {
  for (const [id, allowed] of Object.entries(rules)) {
    if ((counts[file]?.[id] ?? 0) < allowed) improved += 1;
  }
}

if (failures.length > 0) {
  console.error('Design tokens: new raw values (trim-ui → Enforcement).\n');
  for (const failure of failures) {
    const rule = RULES.find((item) => item.id === failure.id);
    console.error(`  ${failure.file}  ${failure.id}: ${failure.count} (allowed ${failure.allowed}) → ${rule.fix}`);
    for (const hit of hits.filter((item) => item.file === failure.file && item.rule.id === failure.id)) {
      console.error(`      ${hit.line}: ${hit.text}`);
    }
  }
  console.error('\nFix them with tokens from constants/theme.ts and motion.ts.');
  process.exit(1);
}

console.log(`Design tokens: OK (${hits.length} known violations left).`);
if (improved > 0) {
  console.log(`${improved} baseline entries went down. Run with --update to lock in the progress.`);
}
