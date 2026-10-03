/**
 * Upgrade check (PLAN §11): a snapshot persisted by the last `main` before the redesign (tag
 * `archive/pre-gadget`) loads in the gadget with every plan, workout, goal, check-in and the open
 * session intact. Plain TS, run with `tsx`; each `check` throws on a mismatch.
 *
 * `fixtures/pre-gadget-snapshot.json` was written by that tag's own code (its `defaultSnapshot`,
 * Home and Progress demo builders, goal / body-goal / log-session helpers), exactly as its
 * `saveSnapshot` stores it under `scratchWorkout.appState.v1`. The only normalisation allowed is
 * the one the old loader already did: media fields (`thumbnailURL`, `imageURL`, `videoURL`,
 * `imageURLs`) are cleared on plan, history and session exercises.
 */
import { DARK_FINISH, DEFAULT_FINISH } from '@/domain/finish';
import { normalizeLogSession, openLogSession, sessionStillValid, type LogSession } from '@/domain/log-session';
import type { LoggedWorkout, WorkoutPlan } from '@/domain/types';
import { normalizeSnapshot, withAppearanceMigratedToFinish, type WorkoutSnapshot } from '@/store/snapshot';

import fixture from './fixtures/pre-gadget-snapshot.json';

// Node, under tsx; the app's tsconfig has no Node types.
declare function require(id: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string };
declare const __dirname: string;
const { readFileSync } = require('node:fs');

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
      throw new Error(`expected ${show(expected).slice(0, 400)}\n got      ${show(actual).slice(0, 400)}`);
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

const raw = fixture as unknown as WorkoutSnapshot;
// Freeze "now" at the moment the old app was left with the session open (rest still running).
const nowMs = raw.activeSession?.updatedAt ? Date.parse(raw.activeSession.updatedAt) : Date.now();
const loaded = normalizeSnapshot(JSON.parse(JSON.stringify(raw)), new Date(nowMs));
if (!loaded) {
  throw new Error('normalizeSnapshot rejected the pre-gadget fixture');
}

// The documented normalisation, applied to the old JSON by hand.
type Media = { thumbnailURL?: unknown; imageURL?: unknown; videoURL?: unknown; imageURLs?: unknown };
const prescriptionMedia = <T extends Media>(row: T): T => ({
  ...row,
  thumbnailURL: null,
  imageURL: null,
  videoURL: null,
  imageURLs: {},
});
const planMedia = (plan: WorkoutPlan): WorkoutPlan => ({
  ...plan,
  days: plan.days.map((day) => ({ ...day, exercises: day.exercises.map(prescriptionMedia) })),
});
const workoutMedia = (workout: LoggedWorkout): LoggedWorkout => ({
  ...workout,
  exercises: workout.exercises.map((exercise) => ({
    ...exercise,
    thumbnailURL: null,
    imageURL: null,
    imageURLs: {},
  })),
});
const sessionMedia = (session: LogSession): LogSession => ({
  ...session,
  drafts: session.drafts.map((draft) => ({ ...draft, prescription: prescriptionMedia(draft.prescription) })),
});

check('fixture is a real upgrade case', () => {
  assert.equal(raw.hasCompletedOnboarding, true);
  assert.equal(raw.plans.length >= 2, true);
  assert.equal(raw.archivedPlans.length >= 1, true);
  assert.equal(raw.workoutHistory.length >= 20, true);
  assert.equal(raw.goals.some((goal) => goal.pinned) && raw.goals.some((goal) => goal.reachedAt), true);
  assert.equal(raw.bodyGoals.length > 0 && raw.bodyCheckIns.length > 0, true);
  assert.equal(Object.keys(raw.milestonesShown).length > 0, true);
  assert.equal(raw.activeSession?.drafts.some((draft) => draft.sets.some((set) => set.done)), true);
  assert.equal(raw.activeSession?.rest != null, true);
  // Old snapshots have none of the gadget fields.
  for (const key of ['finish', 'soundsOn', 'appearanceMigratedToFinish', 'weekMomentsShown']) {
    assert.equal(key in raw, false);
  }
});

check('plans: every plan, day and exercise (media cleared)', () => {
  assert.deepEqual(loaded.plans, raw.plans.map(planMedia));
  assert.equal(loaded.activePlanId, raw.activePlanId);
  assert.equal(loaded.nextDayIndex, raw.nextDayIndex);
});

check('archived plans', () => {
  assert.deepEqual(loaded.archivedPlans, raw.archivedPlans.map(planMedia));
});

check('custom exercises', () => {
  assert.deepEqual(loaded.customExercises, raw.customExercises);
});

check('history: every workout and set, in order', () => {
  assert.deepEqual(loaded.workoutHistory, raw.workoutHistory.map(workoutMedia));
  const sets = (history: LoggedWorkout[]) =>
    history.flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets));
  assert.deepEqual(sets(loaded.workoutHistory), sets(raw.workoutHistory));
});

check('goals, body goals, check-ins, milestones', () => {
  assert.deepEqual(loaded.goals, raw.goals);
  assert.deepEqual(loaded.bodyGoals, raw.bodyGoals);
  assert.deepEqual(loaded.bodyCheckIns, raw.bodyCheckIns);
  assert.deepEqual(loaded.milestonesShown, raw.milestonesShown);
});

check('settings: units, name, Pro cache, paywall, appearance kept', () => {
  assert.equal(loaded.units, raw.units);
  assert.equal(loaded.userName, raw.userName);
  assert.equal(loaded.isPro, raw.isPro);
  assert.equal(loaded.postWorkoutPaywallShownAt, raw.postWorkoutPaywallShownAt);
  assert.equal(loaded.hasCompletedOnboarding, true);
  assert.equal(loaded.appearance, raw.appearance);
  assert.equal(loaded.systemScheme, raw.systemScheme);
});

check('open session survives and reopens on its day', () => {
  const session = raw.activeSession;
  if (!session) throw new Error('fixture has no session');
  assert.deepEqual(loaded.activeSession, sessionMedia(session));
  assert.deepEqual(loaded.activeSession, normalizeLogSession(session, loaded.plans));
  const live = sessionStillValid(loaded.activeSession, loaded.plans);
  if (!live) throw new Error('session dropped by sessionStillValid');
  const plan = loaded.plans.find((item) => item.id === live.planId);
  const day = plan?.days.find((item) => item.id === live.dayId);
  const opened = openLogSession({
    planId: plan?.id,
    day,
    session: live,
    previousSetsForExercise: () => [],
    nowMs,
  });
  assert.equal(opened.restored, true);
  assert.equal(opened.startedAt, session.startedAt);
  assert.deepEqual(
    opened.drafts.map((draft) => draft.sets),
    session.drafts.map((draft) => draft.sets),
  );
  assert.equal(opened.exerciseIndex, session.exerciseIndex);
  assert.deepEqual(opened.rest, session.rest);
});

check('new fields default', () => {
  assert.equal(loaded.finish, DEFAULT_FINISH);
  assert.equal(loaded.finish, '212');
  assert.equal(loaded.soundsOn, true);
  assert.equal(loaded.appearanceMigratedToFinish, false);
  assert.deepEqual(loaded.weekMomentsShown, []);
});

check('D2: dark appearance → 101 Graphite, once, nothing else touched', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const migrated = withAppearanceMigratedToFinish(loaded, scheme);
    assert.equal(migrated.finish, DARK_FINISH);
    assert.equal(migrated.appearanceMigratedToFinish, true);
    assert.deepEqual({ ...migrated, finish: loaded.finish, appearanceMigratedToFinish: false }, loaded);
    // Runs once: a later pick survives the next launch.
    const picked = withAppearanceMigratedToFinish({ ...migrated, finish: '305' }, 'dark');
    assert.equal(picked.finish, '305');
  }
});

check('D2: light, and system on a light phone, keep 212; system on a dark phone → 101', () => {
  const light = withAppearanceMigratedToFinish({ ...loaded, appearance: 'light' }, 'dark');
  assert.equal(light.finish, '212');
  assert.equal(light.appearanceMigratedToFinish, true);
  const systemLight = withAppearanceMigratedToFinish({ ...loaded, appearance: 'system' }, 'light');
  assert.equal(systemLight.finish, '212');
  const systemDark = withAppearanceMigratedToFinish({ ...loaded, appearance: 'system' }, 'dark');
  assert.equal(systemDark.finish, DARK_FINISH);
  // Not before onboarding: new installs pick a finish there.
  const fresh = withAppearanceMigratedToFinish({ ...loaded, hasCompletedOnboarding: false }, 'dark');
  assert.equal(fresh.finish, '212');
  assert.equal(fresh.appearanceMigratedToFinish, false);
});

check('storage keys match archive/pre-gadget', () => {
  // The keys at tag archive/pre-gadget; renaming any of them loses user data (AGENTS.md).
  const keys: [string, string][] = [
    ['src/store/persistence.native.ts', "'scratchWorkout.appState.v1'"],
    ['src/store/persistence.ts', "'scratchWorkout.appState.v1'"],
    ['src/catalog/cache.ts', "'scratchWorkout.exerciseCatalog.v1'"],
    ['src/live-activity/controller.ios.ts', "'scratchWorkout.liveActivityFocus.v1'"],
  ];
  for (const [file, key] of keys) {
    const source = readFileSync(`${__dirname}/../${file}`, 'utf8');
    if (!source.includes(key)) {
      throw new Error(`${file} no longer uses ${key}`);
    }
  }
});

if (failures > 0) {
  console.error(`\n${failures} upgrade check(s) failed`);
  process.exit(1);
}
console.log('Upgrade from pre-gadget snapshot: OK');
