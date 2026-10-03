/**
 * Plain TS checks for the catalog's D5 side map (PLAN §3 D5): `bundledExerciseInfo` (figures by
 * name and by target muscle, how-to steps, kit and muscles) and the exercise figures' paths.
 * Run with `tsx`. No test runner: each `check` throws on a mismatch and the script exits 1.
 */
import {
  BUNDLED_EXERCISES,
  bundledExerciseById,
  bundledExerciseId,
  bundledExerciseInfo,
  bundledSearchAliases,
  type ExerciseFigure,
} from '@/catalog/bundled';
import { FIGURES } from '@/device/figures/patterns';
import { clonePrescription } from '@/domain/helpers';

function show(value: unknown): string {
  return JSON.stringify(value);
}
const assert = {
  equal(actual: unknown, expected: unknown) {
    if (!Object.is(actual, expected)) {
      throw new Error(`expected ${show(expected)}, got ${show(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown) {
    if (show(actual) !== show(expected)) {
      throw new Error(`expected ${show(expected)}\n got      ${show(actual)}`);
    }
  },
  ok(value: unknown, message = '') {
    if (!value) throw new Error(`expected a truthy value, got ${show(value)} ${message}`);
  },
};

let failures = 0;
let passed = 0;

function check(name: string, run: () => void) {
  try {
    run();
    passed += 1;
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message.split('\n').join('\n  ') : String(error)}`);
  }
}

const infos = BUNDLED_EXERCISES.map((row) => ({ row, info: bundledExerciseInfo(row.name) }));
const withFigure = infos.filter(({ info }) => info?.figure);
const withHowTo = infos.filter(({ info }) => info?.howTo);

check('every bundled row has info, keyed by its own id', () => {
  for (const { row, info } of infos) {
    assert.ok(info, row.name);
    assert.equal(bundledExerciseId(row.name), row.id);
  }
});

check('how-to: 40 lifts, three short sentences each, no slop markers', () => {
  // The duplicate catalog row "Incline Bench Press (Dumbbells)" has its own id, so no double count.
  assert.equal(withHowTo.length, 40);
  for (const { row, info } of withHowTo) {
    const steps = info!.howTo!;
    assert.equal(steps.length, 3);
    for (const step of steps) {
      assert.ok(/^[A-Z].*\.$/.test(step), `${row.name}: "${step}"`);
      assert.ok(!/[·—!]/.test(step), `${row.name}: "${step}"`);
      assert.ok(step.length <= 90, `${row.name}: "${step}" is long`);
    }
  }
});

check('bench press: press figure, chest first, barbell', () => {
  const info = bundledExerciseInfo('Flat Barbell Bench Press');
  assert.equal(info?.figure, 'press');
  assert.equal(info?.kit, 'Barbell');
  assert.deepEqual(info?.muscles, ['Chest', 'Front delts', 'Triceps']);
});

check('figure fallback by target muscle', () => {
  assert.equal(bundledExerciseInfo('Machine Chest Press')?.figure, 'press');
  assert.equal(bundledExerciseInfo('Incline Cable Fly')?.figure, 'fly'); // by name, not Pectorals
  assert.equal(bundledExerciseInfo('Band Pull-Apart')?.figure, 'fly');
  assert.equal(bundledExerciseInfo('Pendlay Row')?.figure, 'row');
  assert.equal(bundledExerciseInfo('Neutral-Grip Lat Pulldown')?.figure, 'pull');
  assert.equal(bundledExerciseInfo('Good Morning')?.figure, 'hinge');
  assert.equal(bundledExerciseInfo('Zottman Curl')?.figure, 'curl');
  assert.equal(bundledExerciseInfo('Rope Tricep Pushdown')?.figure, 'extension');
  assert.equal(bundledExerciseInfo('Cable Lateral Raise')?.figure, 'raise');
  assert.equal(bundledExerciseInfo('Dumbbell Shrug')?.figure, 'carry');
  assert.equal(bundledExerciseInfo('Reverse Pec Deck')?.figure, 'fly');
});

check('figure by name beats the target, and can mean none', () => {
  assert.equal(bundledExerciseInfo('Face Pulls')?.figure, 'row');
  assert.equal(bundledExerciseInfo('Front Raise')?.figure, 'raise');
  assert.equal(bundledExerciseInfo('Close-Grip Bench Press')?.figure, 'press');
  assert.equal(bundledExerciseInfo('Leg Curl')?.figure, undefined);
  assert.ok(bundledExerciseInfo('Leg Curl')?.howTo);
  assert.equal(bundledExerciseInfo('Leg Extension')?.figure, undefined);
  assert.equal(bundledExerciseInfo('Dead Hang')?.figure, 'pull');
});

check('no figure and no how-to: core, holds, cardio, mobility, stretches, timers', () => {
  for (const name of ['Plank', 'Crunch', 'Run', 'Cat-Cow', 'Hamstring Stretch', 'EMOM Timer', 'Seated Calf Raise']) {
    const info = bundledExerciseInfo(name);
    assert.ok(info, name);
    assert.equal(info?.figure, undefined);
    assert.equal(info?.howTo, undefined);
  }
  assert.deepEqual(bundledExerciseInfo('Plank')?.muscles, ['Abs']);
  assert.deepEqual(bundledExerciseInfo('Run')?.muscles, []);
  assert.equal(bundledExerciseInfo('Run')?.kit, '');
  assert.equal(bundledExerciseInfo('Push-Up')?.kit, 'Body weight');
  assert.equal(bundledExerciseInfo('Skull Crusher')?.kit, 'EZ bar');
});

check('names that are not bundled rows get nothing (custom exercises, typos)', () => {
  assert.equal(bundledExerciseInfo('My Cable Thing'), null);
  assert.equal(bundledExerciseInfo('Bench Press'), null);
  assert.equal(bundledExerciseInfo(''), null);
});

check('the side map never lands on a prescription (nothing persists into plans)', () => {
  for (const row of BUNDLED_EXERCISES) {
    const json = JSON.stringify(clonePrescription(row));
    assert.ok(!/"figure"|"howTo"|"aliases"/.test(json), row.name);
  }
  const bench = bundledExerciseById('bundled-flat-barbell-bench-press');
  assert.ok(bench && !('figure' in bench) && !('howTo' in bench));
});

check('search aliases stay catalog-only and unchanged', () => {
  assert.deepEqual(bundledSearchAliases('bundled-romanian-deadlift'), ['RDL']);
  assert.deepEqual(bundledSearchAliases('bundled-flat-barbell-bench-press'), []);
});

check('every figure is used and draws valid paths through its loop', () => {
  const used = new Set(withFigure.map(({ info }) => info!.figure));
  for (const figure of Object.keys(FIGURES) as ExerciseFigure[]) {
    assert.ok(used.has(figure), `${figure} is unused`);
    for (const part of FIGURES[figure]) {
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const d = part.d(p);
        assert.ok(d.startsWith('M') && !/NaN|Infinity|undefined/.test(d), `${figure} at ${p}: ${d}`);
      }
    }
  }
});

if (failures > 0) {
  throw new Error(`check-catalog-info: ${failures} failed, ${passed} passed`);
}
console.log(
  `check-catalog-info: ${passed} passed (${withFigure.length} of ${BUNDLED_EXERCISES.length} rows with a figure, ${withHowTo.length} with how-to)`,
);
