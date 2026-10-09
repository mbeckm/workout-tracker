/**
 * Plain TS checks for Import plan, run with `tsx`. No test runner: each `check` throws on a
 * mismatch.
 *
 * Covers the parser (`domain/plan-import.ts`) on a ChatGPT answer, an Apple Note, a markdown
 * table, Hevy / Strong set tables and an Alpha Progression page, the sets/reps shapes, and the
 * catalog match (`catalog/plan-import-match.ts`): gym spellings, unknown lifts with alternatives,
 * and the plan `planFromMatch` saves.
 */
import { liftKey, matchParsedPlan, planFromMatch } from '@/catalog/plan-import-match';
import { joinScreenshotLines, parsePlanText, type ImportedLift, type ParsedPlan } from '@/domain/plan-import';
import type { ExercisePrescription } from '@/domain/types';

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
};

let failures = 0;
function check(name: string, run: () => void) {
  try {
    run();
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}\n  ${(error as Error).message}`);
  }
}

/** `[name, sets, reps, seconds]` per lift, for compact fixtures. */
function shape(plan: ParsedPlan) {
  return plan.days.map((day) => ({
    title: day.title,
    lifts: day.lifts.map((lift) => [lift.name, lift.sets, lift.reps, lift.seconds]),
  }));
}

function single(line: string): ImportedLift {
  const lifts = parsePlanText(line).days.flatMap((day) => day.lifts);
  if (lifts.length !== 1) {
    throw new Error(`"${line}" gave ${lifts.length} lifts: ${show(lifts)}`);
  }
  return lifts[0];
}

/* ----------------------------------------------------------------------------------------- *
 * Parser
 * ----------------------------------------------------------------------------------------- */

const CHATGPT = `Here's a 4-day upper/lower split for hypertrophy:

## Day 1: Upper Body (Strength)
1. **Bench Press**: 4 × 6–8
2. **Barbell Row**: 4 × 6–8
3. Overhead press – 3 sets of 8-10 reps
4. Lat pulldown — 3 x 10-12
5. *Tricep pushdown*: 3x12

Rest 2–3 minutes between sets.

**Day 2 – Lower**
- Squat: 4x5
- Romanian deadlift: 3 sets x 8 reps
- Leg press 3 x 10-12
- Calf raise 4 x 15

### Day 3: Rest

### Day 4 — Upper (Hypertrophy)
* Incline DB press 3 × 10
* Pull-ups 3 x AMRAP
* Lateral raises: 4 sets, 12–15 reps
* Face pulls 3 × 15
• Plank 3 x 45s

### Notes
- Warm-up: 5 min bike before each session
- Progression: add 2.5 kg when you hit the top of the range.
- Tip: Keep 1–2 reps in reserve.

Let me know if you want a version with dumbbells only!`;

check('ChatGPT: days, titles and lifts; intro, notes, rest day and outro dropped', () => {
  const plan = parsePlanText(CHATGPT);
  assert.equal(plan.name, null);
  assert.deepEqual(shape(plan), [
    {
      title: 'Upper Body',
      lifts: [
        ['Bench Press', 4, 8, null],
        ['Barbell Row', 4, 8, null],
        ['Overhead press', 3, 10, null],
        ['Lat pulldown', 3, 12, null],
        ['Tricep pushdown', 3, 12, null],
      ],
    },
    {
      title: 'Lower',
      lifts: [
        ['Squat', 4, 5, null],
        ['Romanian deadlift', 3, 8, null],
        ['Leg press', 3, 12, null],
        ['Calf raise', 4, 15, null],
      ],
    },
    {
      title: 'Upper',
      lifts: [
        ['Incline DB press', 3, 10, null],
        ['Pull-ups', 3, null, null],
        ['Lateral raises', 4, 15, null],
        ['Face pulls', 3, 15, null],
        ['Plank', 3, null, 45],
      ],
    },
  ]);
  assert.equal(plan.days[0].lifts[0].raw, '1. **Bench Press**: 4 × 6–8');
});

check('ChatGPT: a leading H1 names the plan; weekday headers keep the part after the dash', () => {
  const plan = parsePlanText(`# Upper Lower Hypertrophy

### Monday — Push
- Bench press 4x8
### Thursday
- Squat 5x5`);
  assert.equal(plan.name, 'Upper Lower Hypertrophy');
  assert.deepEqual(plan.days.map((day) => day.title), ['Push', 'Thursday']);
});

check('ChatGPT: a markdown table under a day', () => {
  const plan = parsePlanText(`**Day 1 – Push**

| Exercise | Sets | Reps | Rest |
|---|---|---|---|
| **Bench Press** | 4 | 6-8 | 2 min |
| Plank | 3 | 45 sec | 60s |`);
  assert.deepEqual(shape(plan), [
    { title: 'Push', lifts: [['Bench Press', 4, 8, null], ['Plank', 3, null, 45]] },
  ]);
});

const NOTES = `PPL

Push
Bench 4x8
OHP 3x10
Dips

Pull
Pull-ups 4x6
Barbell row 3x8-10

Leg day
Squat 5x5
RDL 3x10`;

check('Apple Notes: a title line, header words and plain lists', () => {
  const plan = parsePlanText(NOTES);
  assert.equal(plan.name, 'PPL');
  assert.deepEqual(shape(plan), [
    { title: 'Push', lifts: [['Bench', 4, 8, null], ['OHP', 3, 10, null], ['Dips', null, null, null]] },
    { title: 'Pull', lifts: [['Pull-ups', 4, 6, null], ['Barbell row', 3, 10, null]] },
    { title: 'Leg day', lifts: [['Squat', 5, 5, null], ['RDL', 3, 10, null]] },
  ]);
});

check('Apple Notes: lifts before any header go into an untitled first day', () => {
  const plan = parsePlanText('Bench\nSquat 5x5\n\nUpper B\nRow 3x8');
  assert.equal(plan.name, null);
  assert.deepEqual(shape(plan), [
    { title: null, lifts: [['Bench', null, null, null], ['Squat', 5, 5, null]] },
    { title: 'Upper B', lifts: [['Row', 3, 8, null]] },
  ]);
});

check('Day headers: shapes and title cleanup', () => {
  const titles = (text: string) => parsePlanText(`${text}\nSquat 3x5`).days[0]?.title;
  assert.equal(titles('Day 1: Upper Body (Strength)'), 'Upper Body');
  assert.equal(titles('Monday – Push'), 'Push');
  assert.equal(titles('Day 1'), 'Day 1');
  assert.equal(titles('Push Day'), 'Push Day');
  assert.equal(titles('Day 3 - Legs'), 'Legs');
  assert.equal(titles('Upper A'), 'Upper A');
  assert.equal(titles('Lower B'), 'Lower B');
  assert.equal(titles('Leg day'), 'Leg day');
  assert.equal(titles('Full Body A'), 'Full Body A');
  assert.equal(titles('Workout A'), 'Workout A');
  assert.equal(titles('Friday'), 'Friday');
  assert.equal(titles('Day 2 (Pull)'), 'Pull');
});

const HEVY = [
  '9:41',
  'Push A',
  'Start Routine',
  'Bench Press (Barbell)',
  'Rest Timer: 2min 0s',
  'SET  PREVIOUS  KG  REPS',
  'W  40kg x 10  40  10',
  '1  60kg x 8  60  8',
  '2  60kg x 8  60  8',
  '3  60kg x 7  60  7',
  'Add Set',
  'Shoulder Press (Dumbbell)',
  'SET  KG  REPS',
  '1  20  10',
  '2  20  10',
  'Add Exercise',
];
const STRONG = [
  'Lateral Raise (Cable)',
  'Set  Previous  lbs  Reps',
  '1  15 lb x 12  15  12',
  '2  15 lb x 12  15  12',
  '3  15 lb x 10  15  12',
  'Edit',
];

check('Hevy / Strong OCR: set tables count working rows, warm-ups skipped, chrome ignored', () => {
  const plan = parsePlanText(joinScreenshotLines([HEVY, STRONG]));
  assert.deepEqual(shape(plan), [
    {
      title: 'Push A',
      lifts: [
        ['Bench Press', 3, 8, null],
        ['Shoulder Press', 2, 10, null],
        ['Lateral Raise', 3, 12, null],
      ],
    },
  ]);
  assert.equal(plan.days[0].lifts[0].qualifier, 'Barbell');
  assert.equal(plan.days[0].lifts[2].qualifier, 'Cable');
});

const ALPHA = [
  'Chest & Triceps',
  'Barbell Bench Press',
  '4 sets • 8-10 reps',
  'Incline Dumbbell Press',
  '3 sets x 12 reps',
  'Cable Fly',
  '3 × 15 · RIR 2',
  'Overhead Triceps Extension',
  '4 × 8',
];

check('Alpha Progression OCR: a name line, then its sets/reps line', () => {
  assert.deepEqual(shape(parsePlanText(joinScreenshotLines([ALPHA]))), [
    {
      title: 'Chest & Triceps',
      lifts: [
        ['Barbell Bench Press', 4, 10, null],
        ['Incline Dumbbell Press', 3, 12, null],
        ['Cable Fly', 3, 15, null],
        ['Overhead Triceps Extension', 4, 8, null],
      ],
    },
  ]);
});

check('Sets/reps shapes', () => {
  const spec = (line: string) => {
    const lift = single(line);
    return [lift.name, lift.sets, lift.reps, lift.seconds];
  };
  assert.deepEqual(spec('Squat 4x8'), ['Squat', 4, 8, null]);
  assert.deepEqual(spec('Squat 4 x 8'), ['Squat', 4, 8, null]);
  assert.deepEqual(spec('Squat 4×8-10'), ['Squat', 4, 10, null]);
  assert.deepEqual(spec('Squat 4X8'), ['Squat', 4, 8, null]);
  assert.deepEqual(spec('Squat 4 sets of 8'), ['Squat', 4, 8, null]);
  assert.deepEqual(spec('Squat 4 sets x 8 reps'), ['Squat', 4, 8, null]);
  assert.deepEqual(spec('Squat 4 sets, 8–10 reps'), ['Squat', 4, 10, null]);
  assert.deepEqual(spec('Squat Sets: 4 Reps: 8'), ['Squat', 4, 8, null]);
  assert.deepEqual(spec('Lunges 3 x 10 each side'), ['Lunges', 3, 10, null]);
  assert.deepEqual(spec('Lunges 3x10/side'), ['Lunges', 3, 10, null]);
  assert.deepEqual(spec('Squat 8 reps'), ['Squat', null, 8, null]);
  assert.deepEqual(spec('Squat 5x5'), ['Squat', 5, 5, null]);
  assert.deepEqual(spec('60 sec plank'), ['plank', null, null, 60]);
  assert.deepEqual(spec('Plank 3 x 1 min'), ['Plank', 3, null, 60]);
  assert.deepEqual(spec('Squat 3 sets to failure'), ['Squat', 3, null, null]);
  assert.deepEqual(spec('Squat 100kg 5x5'), ['Squat', 5, 5, null]);
  assert.deepEqual(spec('Squat 20x200'), ['Squat', 10, 100, null]);
  assert.deepEqual(spec('Bench Press (Barbell) 3x8'), ['Bench Press', 3, 8, null]);
  assert.equal(single('Bench Press (Barbell) 3x8').qualifier, 'Barbell');
});

check('Prose, notes and chrome never become lifts', () => {
  for (const line of [
    "Here's a 4-day upper/lower split for hypertrophy:",
    'Rest 2–3 minutes between sets',
    'Warm-up: 5 min bike',
    'Progression:',
    'Tip: add weight every week',
    'Notes',
    'Edit',
    'Start Workout',
    'Add Exercise',
    'Rest Timer: 2min 0s',
    'kg',
    'lbs',
    '9:41',
    'Focus on slow eccentrics and full range of motion.',
    'Good luck!',
  ]) {
    assert.deepEqual([line, parsePlanText(line).days.length], [line, 0]);
  }
});

check('A notes section ends at the next day header', () => {
  const plan = parsePlanText('Warm-up:\n- Bike\n- Arm circles\n\nDay 1\n- Squat 3x5');
  assert.deepEqual(shape(plan), [{ title: 'Day 1', lifts: [['Squat', 3, 5, null]] }]);
});

/* ----------------------------------------------------------------------------------------- *
 * Matching
 * ----------------------------------------------------------------------------------------- */

function matchOne(name: string, qualifier: string | null = null) {
  const lift: ImportedLift = { raw: name, name, qualifier, sets: null, reps: null, seconds: null };
  return matchParsedPlan({ name: null, days: [{ title: null, lifts: [lift] }] }, []).days[0].lifts[0];
}

check('Matching: common gym spellings find the catalog row', () => {
  const cases: [string, string][] = [
    ['Bench press', 'Flat Barbell Bench Press'],
    ['Bench', 'Flat Barbell Bench Press'],
    ['RDL', 'Romanian Deadlift'],
    ['OHP', 'Overhead Press'],
    ['Lat pulldown', 'Lat Pulldown'],
    ['Barbell row', 'Barbell Row'],
    ['Back squat', 'Barbell Back Squat'],
    ['Leg press', 'Leg Press'],
    ['Incline DB press', 'Incline Dumbbell Press'],
    ['Tricep pushdown', 'Tricep Pushdowns'],
    ['Pull-ups', 'Pull-Ups'],
    ['Chin-ups', 'Chin-Up'],
    ['Hip thrust', 'Hip Thrust'],
    ['Face pulls', 'Face Pulls'],
    ['Leg curl', 'Leg Curl'],
    ['Leg extension', 'Leg Extension'],
    ['Lateral raises', 'Lateral Raises'],
    ['Dumbbell flyes', 'Dumbbell Fly'],
    ['Pushups', 'Push-Up'],
    ['Plank', 'Plank'],
    ['Hammer curls', 'Hammer Curl'],
    ['Squat', 'Barbell Back Squat'],
    ['Barbell bench press', 'Flat Barbell Bench Press'],
    ['Dumbbell lateral raise', 'Lateral Raises'],
  ];
  for (const [name, expected] of cases) {
    assert.deepEqual([name, matchOne(name).exercise?.name ?? null], [name, expected]);
  }
});

check('Matching: an equipment qualifier picks the variant, or the row that already uses it', () => {
  assert.equal(matchOne('Bench Press', 'Barbell').exercise?.name, 'Flat Barbell Bench Press');
  assert.equal(matchOne('Incline Bench Press', 'Dumbbell').exercise?.name, 'Incline Bench Press (Dumbbells)');
  assert.equal(matchOne('Bicep Curl', 'Barbell').exercise?.name, 'Barbell Curl');
  assert.equal(matchOne('Lat Pulldown', 'Cable').exercise?.name, 'Lat Pulldown');
  assert.equal(matchOne('Pull Up', 'Bodyweight').exercise?.name, 'Pull-Ups');
});

/** Flagged: asked about in Fix like an unknown lift, with the guess as its first choice. */
function guessOf(name: string, qualifier: string | null = null): string | null {
  const match = matchOne(name, qualifier);
  if (match.exercise) {
    throw new Error(`"${name}" was recognized as ${match.exercise.name}, expected a guess`);
  }
  return match.alternatives[0]?.name ?? null;
}

check('Matching: a guess is flagged, the guess first (decision 91)', () => {
  // Equipment or a variant the source didn't state.
  assert.equal(guessOf('Chest-supported row'), 'Chest-Supported Dumbbell Row');
  assert.equal(guessOf('Calf raise'), 'Standing Calf Raise');
  assert.equal(guessOf('Shoulder Press', 'Dumbbell'), 'Seated Dumbbell Shoulder Press');
  // A qualifier the match drops.
  assert.equal(guessOf('Weighted chin-ups'), 'Chin-Up');
  assert.equal(guessOf('Deficit deadlift'), 'Deadlift');
  assert.equal(guessOf('Paused squat'), 'Barbell Back Squat');
  assert.equal(guessOf('Single-arm row'), 'Single-Arm Cable Row');
  assert.equal(matchOne('Chest-supported row').alternatives.length <= 3, true);
});

check('Matching: what the source never names stays unknown', () => {
  const jm = matchOne('JM press');
  assert.equal(jm.exercise, null);
  assert.equal(jm.alternatives.some((exercise) => /JM/i.test(exercise.name)), false);
});

check("Matching: Claude's pick is a guess unless the owner's words say it", () => {
  const remote = (name: string, suggestion: string) => {
    const lift: ImportedLift = { raw: name, name, qualifier: null, sets: null, reps: null, seconds: null, suggestion };
    return matchParsedPlan({ name: null, days: [{ title: null, lifts: [lift] }] }, []).days[0].lifts[0];
  };
  const row = remote('Chest-supported row', 'Chest-Supported Dumbbell Row');
  assert.deepEqual([row.exercise, row.alternatives[0]?.name], [null, 'Chest-Supported Dumbbell Row']);
  assert.equal(remote('Weighted chin-ups', 'Chin-Up').exercise, null);
  assert.equal(remote('Military press', 'Overhead Press').exercise?.name, 'Overhead Press');
  assert.equal(remote('Kroc row', 'One-Arm Dumbbell Row').alternatives[0]?.name, 'One-Arm Dumbbell Row');
});

check('Matching: unknown lifts stay null with up to 3 alternatives', () => {
  const airplane = matchOne('Hip airplane');
  assert.equal(airplane.exercise, null);
  assert.equal(airplane.alternatives.length >= 1 && airplane.alternatives.length <= 3, true);
  assert.equal(airplane.alternatives.some((exercise) => exercise.name === 'Hip Thrust'), true);
  const press = matchOne('Press');
  assert.equal(press.exercise, null);
  assert.equal(press.alternatives.length, 3);
  assert.equal(matchOne('Overhead Press').alternatives.length, 0);
});

check('Matching: custom exercises match by name', () => {
  const custom = {
    id: 'custom-1',
    name: 'Hip Airplane',
    equipment: 'Body Weight',
    muscle: 'Glutes',
    exerciseType: 'strength' as const,
    trackingMode: 'reps' as const,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
  const lift: ImportedLift = { raw: 'Hip airplane', name: 'Hip airplane', qualifier: null, sets: 3, reps: 5, seconds: null };
  const match = matchParsedPlan({ name: null, days: [{ title: null, lifts: [lift] }] }, [custom]);
  assert.equal(match.days[0].lifts[0].exercise?.customExerciseID, 'custom-1');
});

check('Matching: day titles fall back to Day n; the name to empty', () => {
  const match = matchParsedPlan(parsePlanText('Squat 3x5\n\nUpper\nRow 3x8'), []);
  assert.equal(match.name, '');
  assert.deepEqual(match.days.map((day) => day.title), ['Day 1', 'Upper']);
});

check('planFromMatch: imported numbers, row defaults, holds, removals and empty days', () => {
  const match = matchParsedPlan(
    parsePlanText(`Day 1\nBench press 5x5\nPull-ups\nPlank 3 x 30s\nHip airplane 3x5\n\nDay 2\nFace pulls 3x15`),
    [],
  );
  const pullUps = match.days[0].lifts[1].exercise as ExercisePrescription;
  const resolved = new Map<string, ExercisePrescription | null>([
    [liftKey(0, 3), match.days[0].lifts[3].alternatives[0] ?? null],
    [liftKey(1, 0), null],
  ]);
  const plan = planFromMatch(match, resolved, '  Imported  ');
  assert.equal(plan.name, 'Imported');
  assert.equal(plan.daysPerWeek, 1);
  assert.equal(plan.days.length, 1);
  assert.equal(plan.days[0].title, 'Day 1');
  const [bench, pull, plank, alternative] = plan.days[0].exercises;
  assert.deepEqual([bench.name, bench.sets, bench.reps], ['Flat Barbell Bench Press', 5, 5]);
  assert.deepEqual([pull.name, pull.sets, pull.reps], ['Pull-Ups', pullUps.sets, pullUps.reps]);
  assert.deepEqual([plank.name, plank.sets, plank.durationSeconds], ['Plank', 3, 30]);
  assert.deepEqual([alternative.sets, alternative.reps], [3, 5]);
  assert.equal(bench.id === match.days[0].lifts[0].exercise?.id, false);
  assert.equal(plan.days[0].exercises.every((exercise) => exercise.repScheme == null), true);
});

if (failures > 0) {
  console.error(`\n${failures} import check(s) failed`);
  process.exit(1);
}
console.log('Plan import logic: OK');
