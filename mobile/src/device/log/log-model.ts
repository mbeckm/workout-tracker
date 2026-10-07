/**
 * What the device's display says while logging (SPEC §5, PLAN §6.6): the set label, the drum
 * and key values per tracking mode, their steps, the footer, the lift lamps, the finish
 * summary and the display's VoiceOver line. Pure: no React, no `react-native`.
 *
 * Values are stored and shown in the user's unit exactly as the old log did: nothing is
 * converted here (PLAN §6.6, §8).
 */
import { durationIsMinutes, type WeightUnit } from '@/domain/helpers';
import { exerciseIsComplete, lastTimeSetFor, type DraftExercise } from '@/domain/log-session';
import { nextLoadDown, nextLoadUp } from '@/domain/targets';
import type { ExercisePrescription, LoggedSet } from '@/domain/types';

import type { SetValues, Stage } from './log-state';

type Values = Pick<LoggedSet, 'weight' | 'reps' | 'counterweight' | 'durationSeconds'>;

export const REPS_MIN = 1;
export const REPS_MAX = 50;
/** Holds and timers: one wheel notch or key press. */
export const SECONDS_STEP = 5;
/** `durationIsMinutes` lifts (cardio): one notch is a minute. */
export const MINUTES_STEP_SECONDS = 60;
/** Rocker lamps compress past this many lifts, and give way to `n/m` text past `LAMP_TEXT_OVER` (PLAN §7). */
export const LAMP_COMPACT_OVER = 12;
export const LAMP_TEXT_OVER = 16;
export const SET_LAMP_REGULAR_UP_TO = 6;
export const SET_LAMP_COMPACT_UP_TO = 12;

/** What the wheel turns (the drum, big). */
export type DrumKind = 'weight' | 'assist' | 'reps' | 'seconds' | 'minutes';
/** What the left keys step (`+` top, `−` bottom); null when they have nothing to do. */
export type KeysKind = 'reps' | 'seconds' | 'minutes' | null;

export type Controls = { drum: DrumKind; keys: KeysKind };

/**
 * The §6.6 table. Distance isn't recorded in the log yet (AGENTS.md), so the two distance
 * modes keep what the old log let you enter: minutes for `distanceAndDuration`, weight for
 * `weightAndDistance`.
 */
export function controlsFor(prescription: Pick<ExercisePrescription, 'trackingMode' | 'itemType'>): Controls {
  const minutes = durationIsMinutes(prescription as ExercisePrescription);
  const time: DrumKind = minutes ? 'minutes' : 'seconds';
  switch (prescription.trackingMode) {
    case 'weightAndReps':
      return { drum: 'weight', keys: 'reps' };
    case 'counterweightAndReps':
      return { drum: 'assist', keys: 'reps' };
    case 'reps':
      // Bodyweight: reps on the wheel, and the keys step reps as well (both work).
      return { drum: 'reps', keys: 'reps' };
    case 'duration':
      return { drum: time, keys: time };
    case 'repsAndDuration':
      return { drum: time, keys: 'reps' };
    case 'distanceAndDuration':
      return { drum: 'minutes', keys: 'minutes' };
    case 'weightAndDistance':
      return { drum: 'weight', keys: null };
    default:
      return { drum: 'weight', keys: 'reps' };
  }
}

// ---------------------------------------------------------------------------
// Steps

function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampReps(value: number): number {
  return Math.max(REPS_MIN, Math.min(REPS_MAX, Math.round(value)));
}

/** Reps ±1, clamped 1–50 everywhere (also plan edit). An empty value starts at 1. */
export function stepReps(reps: number | null | undefined, direction: 1 | -1): number {
  return clampReps((reps ?? 0) + direction);
}

/**
 * A load notch on the `increment` grid (D19): up is `nextLoadUp`, down is `nextLoadDown`,
 * never below 0. An empty load starts at `nextLoadUp(0, increment)`; down from empty stays empty.
 */
export function stepLoad(load: number | null | undefined, direction: 1 | -1, increment: number): number | null {
  if (load == null) {
    return direction > 0 ? nextLoadUp(0, increment) : null;
  }
  return direction > 0 ? nextLoadUp(load, increment) : Math.max(0, nextLoadDown(load, increment));
}

/** Seconds ±5 (holds), never under one step. Empty starts at one step. */
export function stepSeconds(seconds: number | null | undefined, direction: 1 | -1): number | null {
  if (seconds == null) {
    return direction > 0 ? SECONDS_STEP : null;
  }
  return Math.max(SECONDS_STEP, Math.round(seconds) + direction * SECONDS_STEP);
}

/** Minutes ±1 (stored as seconds, on whole minutes), never under a minute. */
export function stepMinutes(seconds: number | null | undefined, direction: 1 | -1): number | null {
  if (seconds == null) {
    return direction > 0 ? MINUTES_STEP_SECONDS : null;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return Math.max(1, minutes + direction) * MINUTES_STEP_SECONDS;
}

/** One wheel notch (`direction` +1 = up). Returns the patch for `patchStage`; empty when nothing moves. */
export function drumStep(kind: DrumKind, values: Values, direction: 1 | -1, increment: number): Partial<SetValues> {
  switch (kind) {
    case 'weight': {
      const weight = stepLoad(values.weight, direction, increment);
      return weight === (values.weight ?? null) ? {} : { weight };
    }
    case 'assist': {
      const counterweight = stepLoad(values.counterweight, direction, increment);
      return counterweight === (values.counterweight ?? null) ? {} : { counterweight };
    }
    case 'reps': {
      const reps = stepReps(values.reps, direction);
      return reps === values.reps ? {} : { reps };
    }
    case 'seconds': {
      const durationSeconds = stepSeconds(values.durationSeconds, direction);
      return durationSeconds === (values.durationSeconds ?? null) ? {} : { durationSeconds };
    }
    case 'minutes': {
      const durationSeconds = stepMinutes(values.durationSeconds, direction);
      return durationSeconds === (values.durationSeconds ?? null) ? {} : { durationSeconds };
    }
  }
}

/** One key press (`+` is 1). Empty when the keys have nothing to do or nothing moves. */
export function keyStep(kind: KeysKind, values: Values, direction: 1 | -1): Partial<SetValues> {
  if (kind == null) {
    return {};
  }
  // Keys share the drum's steps for reps and time; increment is unused for those.
  return drumStep(kind, values, direction, 1);
}

// ---------------------------------------------------------------------------
// Display text

/** `85.0`, `81.25`, `--.-` for no load (D19). */
export function formatDrumLoad(load: number | null | undefined): string {
  if (load == null) {
    return '--.-';
  }
  const value = tidy(load);
  return Number.isInteger(value * 10) ? value.toFixed(1) : String(value);
}

/** `0:45`. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function minutesOf(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/** The drum's main text for one value of `kind`. */
export function formatDrumValue(kind: DrumKind, values: Values): string {
  switch (kind) {
    case 'weight':
      return formatDrumLoad(values.weight);
    case 'assist':
      return values.counterweight != null && values.counterweight > 0
        ? `−${formatDrumLoad(values.counterweight)}`
        : formatDrumLoad(values.counterweight);
    case 'reps':
      return values.reps == null ? '×--' : `×${values.reps}`;
    case 'seconds':
      return values.durationSeconds == null ? '-:--' : formatClock(values.durationSeconds);
    case 'minutes':
      return values.durationSeconds == null ? '-- MIN' : `${minutesOf(values.durationSeconds)} MIN`;
  }
}

/** The small value beside the drum for the keys (`×8`, `0:45`), or null. */
export function formatKeysValue(kind: KeysKind, values: Values): string | null {
  return kind == null ? null : formatDrumValue(kind, values);
}

/** The log footer's keys value: `6` with the unit `REPS`, or a time (`0:45`, `20 MIN`) on its own. */
export type KeysFace = { value: string; unit: 'REPS' | null };

export function keysFace(kind: KeysKind, values: Values): KeysFace | null {
  if (kind == null) {
    return null;
  }
  if (kind === 'reps') {
    return { value: values.reps == null ? '--' : String(values.reps), unit: 'REPS' };
  }
  return { value: formatDrumValue(kind, values), unit: null };
}

export type DrumView = {
  kind: DrumKind;
  /** The big value (104). */
  text: string;
  /** The neighbouring notches (40, dim); null where the wheel can't go. */
  up: string | null;
  down: string | null;
  /** The engraved label by the wheel: `KG`, `LBS`, `REPS`, `TIME`. */
  label: string;
  /** Display header word for assisted lifts. */
  header: 'ASSIST' | null;
};

export function drumView(kind: DrumKind, values: Values, increment: number, units: WeightUnit): DrumView {
  const neighbour = (direction: 1 | -1): string | null => {
    const patch = drumStep(kind, values, direction, increment);
    return Object.keys(patch).length === 0 ? null : formatDrumValue(kind, { ...values, ...patch });
  };
  return {
    kind,
    text: formatDrumValue(kind, values),
    up: neighbour(1),
    down: neighbour(-1),
    label: kind === 'reps' ? 'REPS' : kind === 'seconds' || kind === 'minutes' ? 'TIME' : units.toUpperCase(),
    header: kind === 'assist' ? 'ASSIST' : null,
  };
}

/** `SET 2/3`, `EXTRA SET`, `EDIT SET 2`. `m` counts the prescribed sets only. */
export function setLabel(stage: Pick<Stage, 'kind' | 'setIndex' | 'set' | 'current'>): string {
  if (stage.kind === 'edit') {
    return `EDIT SET ${stage.setIndex + 1}`;
  }
  if (stage.kind === 'extra' || stage.set?.extra) {
    return 'EXTRA SET';
  }
  const planned = stage.current.sets.filter((set) => !set.extra).length;
  return `SET ${stage.setIndex + 1}/${planned}`;
}

/** The set label in words: `set 2 of 3`, `extra set`, `editing set 2`. */
export function spokenSetLabel(stage: Pick<Stage, 'kind' | 'setIndex' | 'set' | 'current'>): string {
  if (stage.kind === 'edit') {
    return `editing set ${stage.setIndex + 1}`;
  }
  if (stage.kind === 'extra' || stage.set?.extra) {
    return 'extra set';
  }
  const planned = stage.current.sets.filter((set) => !set.extra).length;
  return `set ${stage.setIndex + 1} of ${planned}`;
}

function short(value: number): string {
  return String(tidy(value));
}

/** A set in display shorthand: `80×8`, `−20×8`, `12`, `0:40`, `20 MIN`, `10×0:30`. Null when empty. */
export function compactSet(set: Values, minutes = false): string | null {
  const reps = set.reps ?? null;
  const time =
    set.durationSeconds == null
      ? null
      : minutes
        ? `${minutesOf(set.durationSeconds)} MIN`
        : formatClock(set.durationSeconds);
  const load =
    set.weight != null ? short(set.weight) : set.counterweight != null ? `−${short(set.counterweight)}` : null;
  if (load != null) {
    return reps != null ? `${load}×${reps}` : load;
  }
  if (reps != null) {
    return time != null ? `${reps}×${time}` : String(reps);
  }
  return time;
}

export type LogFooter = {
  /** `LAST 80×8`, or null without history. */
  last: string | null;
  /** `TARGET 87.5×8` when targets are shown (Pro or unlocked) and this set has one. */
  target: string | null;
  /** Free with a target here: the dim `TARGET ›` that opens the paywall (`targets`). */
  targetLocked: boolean;
  /** The one footer line: last time, else the locked offer. The target is already on the drum. */
  text: string | null;
};

export function logFooter(input: {
  previousSets: readonly LoggedSet[] | null | undefined;
  setIndex: number;
  target: Values | null;
  showTargets: boolean;
  /** The offer may show (not dismissed this workout, not resting, not editing). */
  offerTargets: boolean;
  minutes?: boolean;
}): LogFooter {
  const lastSet = lastTimeSetFor(input.previousSets, input.setIndex);
  const lastText = lastSet ? compactSet(lastSet, input.minutes) : null;
  const targetText = input.showTargets && input.target ? compactSet(input.target, input.minutes) : null;
  const last = lastText ? `LAST ${lastText}` : null;
  const target = targetText ? `TARGET ${targetText}` : null;
  const targetLocked = !input.showTargets && input.offerTargets && input.target != null;
  return { last, target, targetLocked: last == null && targetLocked, text: last ?? (targetLocked ? 'TARGET ›' : null) };
}

/** Rest header: `NEXT 85×8` for the set that's up next. */
export function restNextText(values: Values, minutes = false): string | null {
  const text = compactSet(values, minutes);
  return text ? `NEXT ${text}` : null;
}

// ---------------------------------------------------------------------------
// Lamps

export type SetLampState = 'off' | 'on' | 'done';

/**
 * One lamp per prescribed set of the lift on the display: done (logged), on (the set Log or Save
 * acts on), off. Extra sets add no lamp; while one is up every lamp reads done.
 */
export function setLamps(stage: Pick<Stage, 'kind' | 'setIndex' | 'current'>): SetLampState[] {
  return stage.current.sets
    .filter((set) => !set.extra)
    .map((set, index) => {
      if (index === stage.setIndex && stage.kind !== 'extra') {
        return 'on';
      }
      return set.done ? 'done' : 'off';
    });
}

export type SetLampLayout = 'regular' | 'compact' | 'none';

/** Up to 6 sets the lamps are 22 wide; up to 12 they compress to 12; past that only `SET n/m` shows. */
export function setLampLayout(count: number): SetLampLayout {
  if (count > SET_LAMP_COMPACT_UP_TO) {
    return 'none';
  }
  return count > SET_LAMP_REGULAR_UP_TO ? 'compact' : 'regular';
}

export type LiftLampState = 'off' | 'on' | 'done' | 'part';

/** One lamp per lift: done (every set), on (the display's lift), part (some sets), off. */
export function liftLamps(drafts: readonly DraftExercise[], currentIndex: number): LiftLampState[] {
  return drafts.map((draft, index) => {
    if (exerciseIsComplete(draft)) {
      return 'done';
    }
    if (index === currentIndex) {
      return 'on';
    }
    return draft.sets.some((set) => set.done) ? 'part' : 'off';
  });
}

export type LampLayout = 'regular' | 'compact' | 'text';

/** Over 12 lifts the lamps compress (gap 4, size 8); over 16 the strip shows `n/m` text. */
export function lampLayout(count: number): LampLayout {
  if (count > LAMP_TEXT_OVER) {
    return 'text';
  }
  return count > LAMP_COMPACT_OVER ? 'compact' : 'regular';
}

/** The strip's text past 16 lifts: the lit lamp's position, else the done count, of all. */
export function lampText(lamps: readonly LiftLampState[]): string {
  const current = lamps.findIndex((lamp) => lamp === 'on');
  const shown = current < 0 ? lamps.filter((lamp) => lamp === 'done').length : current + 1;
  return `${shown}/${lamps.length}`;
}

// ---------------------------------------------------------------------------
// Finish

export type FinishSummary = {
  /** `ALL DONE`, or `END EARLY?` with work left. */
  headline: 'ALL DONE' | 'END EARLY?';
  logged: number;
  /** Prescribed sets (extra sets don't add to it). */
  planned: number;
  /** `7 OF 9 SETS`, or `NOTHING LOGGED` (the big key reads Discard). */
  setsText: string;
  nothingLogged: boolean;
  /** Weight × reps over logged sets, in the user's unit. */
  volume: number;
  /** `4,320 KG`; null when nothing logged carries a load. */
  volumeText: string | null;
  /** The set grid: max(planned, logged) cells, the first `logged` lit. */
  grid: boolean[];
};

export function finishSummary(drafts: readonly DraftExercise[], units: WeightUnit): FinishSummary {
  let logged = 0;
  let planned = 0;
  let open = 0;
  let volume = 0;
  for (const draft of drafts) {
    for (const set of draft.sets) {
      if (!set.extra) {
        planned += 1;
      }
      if (set.done) {
        logged += 1;
        volume += (set.weight ?? 0) * (set.reps ?? 0);
      } else {
        open += 1;
      }
    }
  }
  const nothingLogged = logged === 0;
  return {
    headline: open === 0 && !nothingLogged ? 'ALL DONE' : 'END EARLY?',
    logged,
    planned,
    setsText: nothingLogged ? 'NOTHING LOGGED' : `${logged} OF ${planned} SETS`,
    nothingLogged,
    volume,
    volumeText: volume > 0 ? `${Math.round(volume).toLocaleString('en-US')} ${units.toUpperCase()}` : null,
    grid: Array.from({ length: Math.max(planned, logged) }, (_, index) => index < logged),
  };
}

// ---------------------------------------------------------------------------
// VoiceOver

function count(value: number, one: string, many: string): string {
  const shown = tidy(value);
  return `${short(shown)} ${shown === 1 ? one : many}`;
}

function unitWords(units: WeightUnit): [string, string] {
  return units === 'kg' ? ['kilogram', 'kilograms'] : ['pound', 'pounds'];
}

/** One value in words, as the wheel's accessibility value: `85 kilograms`, `8 reps`, `45 seconds`. */
export function spokenValue(kind: DrumKind, values: Values, units: WeightUnit): string {
  const [one, many] = unitWords(units);
  switch (kind) {
    case 'weight':
      return values.weight == null ? 'no weight' : count(values.weight, one, many);
    case 'assist':
      return values.counterweight == null ? 'no assistance' : `${count(values.counterweight, one, many)} of assistance`;
    case 'reps':
      return values.reps == null ? 'no reps' : count(values.reps, 'rep', 'reps');
    case 'seconds':
      return values.durationSeconds == null ? 'no time' : count(values.durationSeconds, 'second', 'seconds');
    case 'minutes':
      return values.durationSeconds == null ? 'no time' : count(minutesOf(values.durationSeconds), 'minute', 'minutes');
  }
}

/** A past set in words: `80 by 8`, `12 reps`, `40 seconds`, `20 minutes`. */
export function spokenShortSet(set: Values, minutes = false): string | null {
  const load = set.weight ?? set.counterweight ?? null;
  if (load != null && set.reps != null) {
    return `${short(load)} by ${set.reps}`;
  }
  if (set.reps != null) {
    return count(set.reps, 'rep', 'reps');
  }
  if (set.durationSeconds != null) {
    return minutes
      ? count(minutesOf(set.durationSeconds), 'minute', 'minutes')
      : count(set.durationSeconds, 'second', 'seconds');
  }
  return load != null ? short(load) : null;
}

/**
 * The display's one VoiceOver label in log mode (PLAN §7):
 * "Bench press, set 2 of 3, 85 kilograms, 8 reps, last time 80 by 8".
 */
export function displaySummary(input: {
  name: string;
  stage: Pick<Stage, 'kind' | 'setIndex' | 'set' | 'current' | 'values'>;
  controls: Controls;
  units: WeightUnit;
  previousSets: readonly LoggedSet[] | null | undefined;
  /** Shown target for this set (Pro), if any. */
  target?: Values | null;
  minutes?: boolean;
}): string {
  const { stage, controls, units } = input;
  const parts = [input.name, spokenSetLabel(stage), spokenValue(controls.drum, stage.values, units)];
  if (controls.keys && controls.keys !== controls.drum) {
    parts.push(spokenValue(controls.keys, stage.values, units));
  }
  const target = input.target ? spokenShortSet(input.target, input.minutes) : null;
  if (target) {
    parts.push(`target ${target}`);
  }
  const lastSet = lastTimeSetFor(input.previousSets, stage.setIndex);
  const last = lastSet ? spokenShortSet(lastSet, input.minutes) : null;
  if (last) {
    parts.push(`last time ${last}`);
  }
  return parts.join(', ');
}
