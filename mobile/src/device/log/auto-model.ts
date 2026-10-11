/**
 * Auto mode (decision 99): who set the weight on the display, and why. The set card's clip on
 * its top edge says `AUTO` (Trim set it), `MAN` (you moved it), `AUTO` dim (Pro, switched off)
 * or a locked `AUTO` (Trim Free, where a target exists); its bottom edge says why
 * (`▲ FROM 85×8`) or last time (`LAST 85×8`). The lamp's sheet says it in words.
 * Pure: no React, no `react-native`.
 */
import { lastTimeSetFor } from '@/domain/log-session';
import type { SetTarget } from '@/domain/targets';
import type { LoggedSet } from '@/domain/types';

import { compactSet } from './log-model';

type Values = Pick<LoggedSet, 'weight' | 'reps' | 'counterweight' | 'durationSeconds'>;

/**
 * `auto`: the drum holds Trim's target. `man`: the lifter moved it off. `off`: Trim Pro with
 * Auto mode switched off. `locked`: Trim Free, and Trim has a target for this set.
 */
export type AutoLamp = 'auto' | 'man' | 'off' | 'locked';

export type AutoView = {
  /** Null when there's no target for this set (no history, or a move without targets). */
  lamp: AutoLamp | null;
  /** The card's bottom edge: `▲ FROM 85×8` on AUTO, else `LAST 85×8`; null with no history. */
  edge: string | null;
  /** On MAN, AUTO's set (`87.5×8`) rides the top edge with its spark. */
  autoText: string | null;
};

const FIELDS = ['weight', 'counterweight', 'reps', 'durationSeconds'] as const;

function same(left: number | null | undefined, right: number | null | undefined): boolean {
  if (left == null || right == null) return left == null && right == null;
  return Math.abs(left - right) < 0.001;
}

/** Whether the set's values are the target's (every value the target sets). */
export function onTarget(values: Values, target: Values): boolean {
  return FIELDS.every((field) => target[field] == null || same(values[field], target[field]));
}

/** `▲` when the target moves forward (more load, less assistance, more reps or time), `=` when the load holds. */
export function targetGlyph(target: Pick<SetTarget, 'step' | 'weight' | 'counterweight'>): '▲' | '=' {
  if (target.step === 'load') return '▲';
  if (target.step === 'reps') return target.weight != null || target.counterweight != null ? '=' : '▲';
  return '=';
}

export function autoView(input: {
  target: SetTarget | null;
  values: Values;
  previousSets: readonly LoggedSet[] | null | undefined;
  setIndex: number;
  /** Trim Pro (or unlocked this workout). */
  pro: boolean;
  /** The Auto mode switch (Pro only). */
  autoMode: boolean;
  /** Only a set to log shows the lamp: never an extra set or an edit. */
  active: boolean;
  minutes?: boolean;
}): AutoView {
  const lastSet = lastTimeSetFor(input.previousSets, input.setIndex);
  const lastText = lastSet ? compactSet(lastSet, input.minutes) : null;
  const last = lastText ? `LAST ${lastText}` : null;
  const { target } = input;
  if (!target || !input.active) {
    return { lamp: null, edge: last, autoText: null };
  }
  if (!input.pro) {
    return { lamp: 'locked', edge: last, autoText: null };
  }
  if (!input.autoMode) {
    return { lamp: 'off', edge: last, autoText: null };
  }
  if (onTarget(input.values, target)) {
    return { lamp: 'auto', edge: lastText ? `${targetGlyph(target)} FROM ${lastText}` : last, autoText: null };
  }
  return { lamp: 'man', edge: last, autoText: compactSet(target, input.minutes) };
}

// ---------------------------------------------------------------------------
// The sheet's words

function short(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function seconds(value: number): string {
  return `${short(value)} seconds`;
}

/**
 * Why AUTO picked this set, in one sentence from the lifter's own last session:
 * "Last time you made all 8 reps on every set, so Trim adds 2.5 kg."
 */
export function autoReason(input: {
  target: SetTarget;
  /** Last session's set at this index. */
  lastSet: Values | null;
  /** The plan's reps for this set, when it has them. */
  goal: number | null;
  units: 'kg' | 'lbs';
}): string {
  const { target, lastSet, goal, units } = input;
  const unit = units === 'kg' ? 'kg' : 'lb';
  const lastLoad = lastSet?.weight ?? null;
  const lastAssist = lastSet?.counterweight ?? null;
  const lastReps = lastSet?.reps ?? null;
  const lastSeconds = lastSet?.durationSeconds ?? null;

  if (target.durationSeconds != null) {
    return target.step === 'hold' || lastSeconds == null || target.durationSeconds <= lastSeconds
      ? `Same as last time: hold for ${seconds(target.durationSeconds)}.`
      : `Last time you held ${seconds(lastSeconds)}, so Trim adds ${seconds(target.durationSeconds - lastSeconds)}.`;
  }
  if (target.step === 'load' && target.weight != null && lastLoad != null) {
    const reps = goal != null ? `all ${goal} reps` : 'every rep';
    return `Last time you made ${reps} on every set, so Trim adds ${short(target.weight - lastLoad)} ${unit}.`;
  }
  if (target.step === 'load' && target.counterweight != null && lastAssist != null) {
    const reps = goal != null ? `all ${goal} reps` : 'every rep';
    return `Last time you made ${reps} on every set, so Trim takes ${short(lastAssist - target.counterweight)} ${unit} of assistance off.`;
  }
  if (target.step === 'reps' && target.reps != null && lastReps != null) {
    const more = target.reps - lastReps;
    const reps = more === 1 ? 'one more rep' : `${more} more reps`;
    const load = target.weight != null || target.counterweight != null ? 'Same weight, ' : '';
    const of = goal != null ? ` of ${goal}` : '';
    return `Last time this set was ${lastReps}${of}. ${load}${load ? reps : reps.charAt(0).toUpperCase() + reps.slice(1)}.`;
  }
  return goal != null
    ? `Same as last time. Trim adds weight once every set makes ${goal} reps.`
    : 'Same as last time.';
}

/** What happens when the lifter moves off AUTO (the sheet's second card). */
export const AUTO_CHANGE_TEXT =
  'Turn the wheel or press the keys, and your numbers count for the rest of this lift. Next time Trim starts from what you log.';
