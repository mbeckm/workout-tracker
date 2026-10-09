/**
 * Plain TS checks for Progress's pure logic (Phase 7), run with `tsx`. Like
 * `check-device-logic.ts`: no test runner, a failed check exits 1.
 *
 * Covers the check-in and goal number fields: one decimal separator (`.` or `,`), a length
 * cap, and no save for a malformed value (`81.181.1` was accepted as text before); and the
 * estimated max shown whole everywhere, goals included (D93).
 */
import { formatChange, liftDetailModel, parseDecimalInput, progressModel, sanitizeDecimalInput } from '@/device/progress-model';
import { currentOneRM, goalsReachedBy, type Goal } from '@/domain/goals';
import { roundOneRM } from '@/domain/helpers';
import type { LoggedWorkout } from '@/domain/types';

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

function benchDay(id: string, daysAgo: number, weight: number, reps: number, now: Date): LoggedWorkout {
  const completedAt = new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  return {
    id,
    title: 'Push 1',
    completedAt,
    durationMinutes: 45,
    exerciseCount: 1,
    setCount: 1,
    exercises: [{ id: `${id}-bench`, exerciseName: 'Bench Press', sets: [{ id: `${id}-set`, index: 0, weight, reps }] }],
    planId: null,
    dayId: null,
  };
}

check('estimated max: the nearest whole number, and its change from whole numbers (D93)', () => {
  equal(roundOneRM(95.5), 96);
  equal(roundOneRM(96.25), 96);
  equal(roundOneRM(98.67), 99);
  const now = new Date(2026, 9, 9, 12);
  // 75 × 8 = 95 (10 days ago), 82.5 × 5 = 96.25, 80 × 7 = 98.67 (today).
  const history = [benchDay('w3', 0, 80, 7, now), benchDay('w2', 5, 82.5, 5, now), benchDay('w1', 10, 75, 8, now)];
  const model = progressModel({ history, plan: null, goals: [], bodyCheckIns: [], units: 'kg', nextDayIndex: 0, now });
  const row = model.lifts[0];
  equal(row.value, '99');
  equal(row.spark.join(','), '95,96,99');
  equal(row.change, '★ +4');
  const detail = liftDetailModel('Bench Press', history, '1M', 'kg', now);
  equal(detail.latest, 99);
  equal(detail.sessions.map((session) => session.value).join(','), '99,96,95');
});

check('goals: measured against the shown whole estimate (D93)', () => {
  const now = new Date(2026, 9, 9, 12);
  // 85 × 5 = 99.17: shown as 99, so a 99 goal is reached and `Now 99` reads as reached.
  const session = benchDay('w9', 0, 85, 5, now);
  equal(currentOneRM('Bench Press', [session]), 99);
  const goal: Goal = { id: 'g', exerciseName: 'Bench Press', target: 99, pinned: true, createdAt: now.toISOString(), reachedAt: null };
  equal(goalsReachedBy(session, [goal]).length, 1);
  equal(goalsReachedBy(session, [{ ...goal, target: 100 }]).length, 0);
  const card = progressModel({ history: [session], plan: null, goals: [{ ...goal, target: 100 }], bodyCheckIns: [], units: 'kg', nextDayIndex: 0, now }).goals[0];
  equal(card.sub, 'at 99');
  equal(card.percent, '99%');
});

if (failures > 0) {
  throw new Error(`check-progress-logic: ${failures} failed, ${passed} passed`);
}
console.log(`check-progress-logic: ${passed} passed`);
