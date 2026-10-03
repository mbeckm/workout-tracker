/**
 * Plain TS checks for Progress's pure logic (Phase 7), run with `tsx`. Like
 * `check-device-logic.ts`: no test runner, a failed check exits 1.
 *
 * Covers the check-in and goal number fields: one decimal separator (`.` or `,`), a length
 * cap, and no save for a malformed value (`81.181.1` was accepted as text before).
 */
import { formatChange, parseDecimalInput, sanitizeDecimalInput } from '@/device/progress-model';

function show(value: unknown): string {
  return JSON.stringify(value);
}
function equal(actual: unknown, expected: unknown) {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${show(expected)}, got ${show(actual)}`);
  }
}

let failures = 0;
let passed = 0;
function check(name: string, run: () => void) {
  try {
    run();
    passed += 1;
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message : String(error)}`);
  }
}

check('sanitize: keeps one separator, as typed', () => {
  equal(sanitizeDecimalInput('81.181.1'), '81.18');
  equal(sanitizeDecimalInput('81,5'), '81,5');
  equal(sanitizeDecimalInput('1,5,'), '1,5');
  equal(sanitizeDecimalInput('1.,5'), '1.5');
});

check('sanitize: caps whole digits and decimals, drops junk', () => {
  equal(sanitizeDecimalInput('123456'), '1234');
  equal(sanitizeDecimalInput('82.125'), '82.12');
  equal(sanitizeDecimalInput('abc'), '');
  equal(sanitizeDecimalInput(' 8a2 kg'), '82');
  equal(sanitizeDecimalInput('.5'), '0.5');
});

check('parse: accepts a positive number with . or ,', () => {
  equal(parseDecimalInput('81.4'), 81.4);
  equal(parseDecimalInput('81,4'), 81.4);
  equal(parseDecimalInput('81.'), 81);
  equal(parseDecimalInput(' 100 '), 100);
});

check('parse: rejects malformed, empty and zero', () => {
  equal(parseDecimalInput('81.181.1'), null);
  equal(parseDecimalInput('1,5,'), null);
  equal(parseDecimalInput('12345'), null);
  equal(parseDecimalInput('.'), null);
  equal(parseDecimalInput(''), null);
  equal(parseDecimalInput('0'), null);
  equal(parseDecimalInput('-5'), null);
});

check('change: arrows, ±0 and the record star', () => {
  equal(formatChange(5.8, 0), '↑ 6');
  equal(formatChange(-0.84, 1), '↓ 0.8');
  equal(formatChange(0.3, 0), '±0');
  equal(formatChange(9.5, 0, true), '★ +10');
});

if (failures > 0) {
  throw new Error(`check-progress-logic: ${failures} failed, ${passed} passed`);
}
console.log(`check-progress-logic: ${passed} passed`);
