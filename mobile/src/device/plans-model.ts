/**
 * Plans on the gadget (PLAN Phase 6): the rack's shelves and cartridge labels, the editor's
 * counts, names and edits, and the gate decisions for `+` and Use plan. Pure TS, no
 * `react-native`, so `scripts/check-plans-logic.ts` can assert it with `tsx`.
 *
 * The behaviour is the old plan editor's (v3 / 3.1, `screens/plan-editor.tsx`, `edit-sheet.tsx`,
 * `plans-tab.tsx`): auto-naming per decision 71 (`suggestedPlanName`), an untouched new plan
 * discarded on the way out, Pro gates `second_plan` and `switch_plan`.
 */
import { clonePrescription, durationIsMinutes, emptyDay, setCount, suggestedPlanName, usesDuration, usesReps } from '@/domain/helpers';
import { newId } from '@/domain/id';
import { dayIdForPlanWorkout, startOfLocalWeek } from '@/domain/plan-loop';
import type { ExercisePrescription, LoggedWorkout, WorkoutDay, WorkoutPlan } from '@/domain/types';

/** A cartridge's label window holds this many Doto 9 characters (prototype `cartLabel`). */
export const CART_LABEL_MAX = 6;

/**
 * A cartridge's label (trim-ui §13 Plans rack): the day title uppercase when it fits the window,
 * otherwise its initials (`Push 1` → `PUSH 1`, `Upper A` → `UA`, `Full Body B` → `FBB`). Shared
 * with onboarding's plan packs, which pass their own narrower window.
 */
export function cartLabel(name: string, max: number = CART_LABEL_MAX): string {
  const upper = name.trim().toUpperCase();
  if (upper.length <= max) {
    return upper;
  }
  const initials = upper
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('');
  return initials.slice(0, max);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function planLiftCount(plan: WorkoutPlan): number {
  return plan.days.reduce((sum, day) => sum + day.exercises.length, 0);
}

/** `4 days, 12 lifts` (the shelf's sub line). */
export function planSummary(plan: WorkoutPlan): string {
  return `${plural(plan.days.length, 'day', 'days')}, ${plural(planLiftCount(plan), 'lift', 'lifts')}`;
}

/** `3 lifts` (a day header's trailing fact). */
export function liftCountLabel(count: number): string {
  return plural(count, 'lift', 'lifts');
}

export function planHasLifts(plan: WorkoutPlan): boolean {
  return plan.days.some((day) => day.exercises.length > 0);
}

/** The name a plan shows: its own, else one from its days (decision 71), else `New plan`. */
export function planDisplayName(plan: WorkoutPlan): string {
  return plan.name.trim() || suggestedPlanName(plan) || 'New plan';
}

/** A day's title, or `Day n` while it has none. */
export function dayDisplayName(day: WorkoutDay, index: number): string {
  return day.title.trim() || `Day ${index + 1}`;
}

function clock(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

/**
 * The editor chip (Doto 15): `3 × 8`, holds `3 × 0:45`, minute cardio `20 MIN`. Chips take
 * spaces around × (trim-ui §9 On the device).
 */
export function chipPrescription(exercise: ExercisePrescription): string {
  if (durationIsMinutes(exercise)) {
    const minutes = Math.max(1, Math.round((exercise.durationSeconds ?? 0) / 60) || 20);
    return `${minutes} MIN`;
  }
  if (usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode)) {
    return `${setCount(exercise)} × ${clock(exercise.durationSeconds ?? 30)}`;
  }
  return `${setCount(exercise)} × ${exercise.reps || 8}`;
}

/** The chip for VoiceOver: `3 sets of 8`, `3 sets of 45 seconds`, `20 minutes`. */
export function spokenPrescription(exercise: ExercisePrescription): string {
  if (durationIsMinutes(exercise)) {
    const minutes = Math.max(1, Math.round((exercise.durationSeconds ?? 0) / 60) || 20);
    return plural(minutes, 'minute', 'minutes');
  }
  const sets = plural(setCount(exercise), 'set', 'sets');
  if (usesDuration(exercise.trackingMode) && !usesReps(exercise.trackingMode)) {
    return `${sets} of ${plural(exercise.durationSeconds ?? 30, 'second', 'seconds')}`;
  }
  return `${sets} of ${exercise.reps || 8}`;
}

/* ----------------------------------------------------------------------------------------- *
 * The rack (PB3, screen 20)
 * ----------------------------------------------------------------------------------------- */

export type RackCartridge = { dayId: string; label: string; done: boolean };

export type RackShelf = {
  planId: string;
  name: string;
  active: boolean;
  summary: string;
  carts: RackCartridge[];
  accessibilityLabel: string;
};

/** Days of this plan with a workout since Monday (Home's stamped rows, PLAN Phase 3). */
export function doneDayIdsThisWeek(plan: WorkoutPlan, history: readonly LoggedWorkout[], now: Date): Set<string> {
  const weekStartMs = startOfLocalWeek(now).getTime();
  const done = new Set<string>();
  for (const workout of history) {
    if (new Date(workout.completedAt).getTime() < weekStartMs) {
      continue;
    }
    const dayId = dayIdForPlanWorkout(workout, plan);
    if (dayId) {
      done.add(dayId);
    }
  }
  return done;
}

/**
 * The shelves, the active plan first, then the others in the store's order. Archived plans
 * aren't in `plans`, so they stay hidden. Cartridges go green for days done this week, on the
 * active plan only.
 */
export function rackModel(input: {
  plans: readonly WorkoutPlan[];
  activePlanId: string | null;
  history: readonly LoggedWorkout[];
  now: Date;
}): RackShelf[] {
  const active = input.plans.find((plan) => plan.id === input.activePlanId);
  const ordered = active ? [active, ...input.plans.filter((plan) => plan !== active)] : [...input.plans];
  return ordered.map((plan) => {
    const isActive = plan === active;
    const done = isActive ? doneDayIdsThisWeek(plan, input.history, input.now) : new Set<string>();
    const name = planDisplayName(plan);
    const summary = planSummary(plan);
    return {
      planId: plan.id,
      name,
      active: isActive,
      summary,
      carts: plan.days.map((day, index) => ({
        dayId: day.id,
        label: cartLabel(dayDisplayName(day, index)),
        done: done.has(day.id),
      })),
      accessibilityLabel: [name, isActive ? 'active' : null, summary].filter(Boolean).join(', '),
    };
  });
}

/* ----------------------------------------------------------------------------------------- *
 * Editor edits (each returns a new plan; the store saves it)
 * ----------------------------------------------------------------------------------------- */

function withDays(plan: WorkoutPlan, days: WorkoutDay[]): WorkoutPlan {
  return { ...plan, days, daysPerWeek: days.length };
}

function swapAt<T>(items: readonly T[], index: number, delta: -1 | 1): T[] | null {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= items.length) {
    return null;
  }
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function renamePlan(plan: WorkoutPlan, name: string): WorkoutPlan {
  const next = name.trim();
  return next && next !== plan.name.trim() ? { ...plan, name: next } : plan;
}

/** An empty or unchanged name keeps the old one (the old name sheet's rule). */
export function renameDay(plan: WorkoutPlan, dayId: string, title: string): WorkoutPlan {
  const next = title.trim();
  const day = plan.days.find((item) => item.id === dayId);
  if (!day || !next || next === day.title.trim()) {
    return plan;
  }
  return withDays(
    plan,
    plan.days.map((item) => (item.id === dayId ? { ...item, title: next } : item)),
  );
}

/** `Add day`: an empty `Day n` at the end. */
export function addDay(plan: WorkoutPlan): WorkoutPlan {
  return withDays(plan, [...plan.days, emptyDay(`Day ${plan.days.length + 1}`)]);
}

/** A copy right after the day, `Push 1 copy`, with fresh exercise ids. */
export function duplicateDay(plan: WorkoutPlan, dayId: string): WorkoutPlan {
  const index = plan.days.findIndex((item) => item.id === dayId);
  const source = plan.days[index];
  if (!source) {
    return plan;
  }
  const copy: WorkoutDay = {
    id: newId(),
    title: `${source.title.trim() || 'Day'} copy`,
    exercises: source.exercises.map(clonePrescription),
  };
  return withDays(plan, [...plan.days.slice(0, index + 1), copy, ...plan.days.slice(index + 1)]);
}

export function moveDay(plan: WorkoutPlan, dayId: string, delta: -1 | 1): WorkoutPlan {
  const days = swapAt(plan.days, plan.days.findIndex((item) => item.id === dayId), delta);
  return days ? withDays(plan, days) : plan;
}

function withDayExercises(
  plan: WorkoutPlan,
  dayId: string,
  update: (exercises: ExercisePrescription[]) => ExercisePrescription[] | null,
): WorkoutPlan {
  const day = plan.days.find((item) => item.id === dayId);
  const exercises = day ? update(day.exercises) : null;
  if (!day || !exercises) {
    return plan;
  }
  return withDays(
    plan,
    plan.days.map((item) => (item.id === dayId ? { ...item, exercises } : item)),
  );
}

/** Move up / Move down (the rows' accessibility actions). */
export function moveExercise(plan: WorkoutPlan, dayId: string, exerciseId: string, delta: -1 | 1): WorkoutPlan {
  return withDayExercises(plan, dayId, (exercises) =>
    swapAt(exercises, exercises.findIndex((item) => item.id === exerciseId), delta),
  );
}

/** A drag: the lift at `from` lands at `to`. */
export function moveExerciseTo(plan: WorkoutPlan, dayId: string, from: number, to: number): WorkoutPlan {
  return withDayExercises(plan, dayId, (exercises) => {
    if (from === to || from < 0 || from >= exercises.length || to < 0 || to >= exercises.length) {
      return null;
    }
    const next = [...exercises];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });
}

/** Sets and reps from the catalog row, or 3 × 10 where it has none. */
export function withPrescriptionDefaults(exercise: ExercisePrescription): ExercisePrescription {
  const sets = exercise.sets > 0 ? exercise.sets : 3;
  const reps = usesReps(exercise.trackingMode) && exercise.reps <= 0 ? 10 : exercise.reps;
  return sets === exercise.sets && reps === exercise.reps ? exercise : { ...exercise, sets, reps };
}

/** `Add N lifts`: the picked rows at the end of the day, each a fresh copy. */
export function addExercises(plan: WorkoutPlan, dayId: string, picked: readonly ExercisePrescription[]): WorkoutPlan {
  if (picked.length === 0) {
    return plan;
  }
  return withDayExercises(plan, dayId, (exercises) => [
    ...exercises,
    ...picked.map((item) => withPrescriptionDefaults(clonePrescription(item))),
  ]);
}

/** `Add N lifts`, `Add 1 lift`; with nothing picked, `Pick lifts` (prototype). */
export function addLiftsTitle(count: number): string {
  return count <= 0 ? 'Pick lifts' : `Add ${plural(count, 'lift', 'lifts')}`;
}

/* ----------------------------------------------------------------------------------------- *
 * Leaving the editor, and the gates
 * ----------------------------------------------------------------------------------------- */

export type LeaveDecision = {
  /** An unnamed plan with no lifts that was opened unnamed: removed, never archived, never filed. */
  discard: boolean;
  /** An unnamed plan whose days all have names leaves named after them (decision 71). */
  rename: string | null;
  /** Its cartridges file onto the shelf when the rack comes back. */
  file: boolean;
};

export function leaveDecision(input: { plan: WorkoutPlan; openedUnnamed: boolean; isNew: boolean; changed: boolean }): LeaveDecision {
  const { plan } = input;
  const named = plan.name.trim().length > 0;
  if (input.openedUnnamed && !named && !planHasLifts(plan)) {
    return { discard: true, rename: null, file: false };
  }
  return {
    discard: false,
    rename: named ? null : suggestedPlanName(plan),
    file: input.changed || input.isNew,
  };
}

/** `+` on the rack: the first plan is free; any other asks for Pro (`second_plan`, as today). */
export function createPlanGate(planCount: number): 'second_plan' | null {
  return planCount > 0 ? 'second_plan' : null;
}

export type PlanUseGate =
  | { kind: 'active' }
  | { kind: 'blocked'; toast: 'Finish your workout first' | 'Add a lift first' }
  | { kind: 'pro'; reason: 'switch_plan' };

/**
 * Use plan: never during an open workout, only with at least one lift (onboarding's Build my
 * own activates without the editor, so it never meets this rule), and behind `switch_plan`.
 */
export function planUseGate(input: { plan: WorkoutPlan; activePlanId: string | null; sessionOpen: boolean }): PlanUseGate {
  if (input.plan.id === input.activePlanId) {
    return { kind: 'active' };
  }
  if (input.sessionOpen) {
    return { kind: 'blocked', toast: 'Finish your workout first' };
  }
  if (!planHasLifts(input.plan)) {
    return { kind: 'blocked', toast: 'Add a lift first' };
  }
  return { kind: 'pro', reason: 'switch_plan' };
}

/** The toast after activation: `Push Pull Legs is your plan`. */
export function activatedToast(plan: WorkoutPlan): string {
  return `${planDisplayName(plan)} is your plan`;
}
