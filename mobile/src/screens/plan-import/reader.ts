import { useEffect, useState } from 'react';

import { matchParsedPlan, type PlanMatch } from '@/catalog/plan-import-match';
import { readPlanRemotely } from '@/catalog/plan-import-remote';
import { joinScreenshotLines, parsePlanText, type ParsedPlan } from '@/domain/plan-import';
import type { CustomExerciseDefinition } from '@/domain/types';
import { IMPORT } from '@/motion';

import { prepareImageForUpload, recognizeTextInImage } from '../../../modules/trim-device';
import type { ImportInput } from './session';

/** Share of the bar that reading the screenshots fills; finding the lifts fills the rest. */
const OCR_SHARE = 0.6;
/** Pasted text needs no reading, so its bar starts here. */
const TEXT_SHARE = 0.2;
/** Reading in the cloud: preparing the screenshots fills this much, waiting on Claude up to CLOUD_SHARE. */
const PREPARE_SHARE = 0.1;
const CLOUD_SHARE = 0.8;
/** While waiting, the bar closes this share of the gap every tick. */
const CREEP_RATE = 0.06;
const CREEP_TICK = 250;

export type ReadPhase = 'reading' | 'done' | 'empty';

export type ReadState = {
  phase: ReadPhase;
  /** The line under the title: what Trim is doing, then what it found. */
  status: string;
  /** 0–1. */
  progress: number;
  /** Set once the text is read; rows reveal up to `shown`. */
  match: PlanMatch | null;
  /** Lifts revealed so far (the rest land on a stagger). */
  shown: number;
  /** Revealed lifts Trim couldn't recognize. */
  unknown: number;
};

const INITIAL: ReadState = { phase: 'reading', status: '', progress: 0, match: null, shown: 0, unknown: 0 };

function liftCount(match: PlanMatch): number {
  return match.days.reduce((sum, day) => sum + day.lifts.length, 0);
}

function unknownWithin(match: PlanMatch, shown: number): number {
  let seen = 0;
  let unknown = 0;
  for (const day of match.days) {
    for (const lift of day.lifts) {
      if (seen >= shown) return unknown;
      seen += 1;
      if (!lift.exercise) unknown += 1;
    }
  }
  return unknown;
}

const lifts = (count: number) => `${count} ${count === 1 ? 'lift' : 'lifts'}`;
const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

/**
 * Reads an import (decision 88): Claude reads the text or screenshots through Trim's endpoint; when
 * that fails (offline, slow, refused) the phone reads it (text recognition, then the local parser).
 * Either way the days and lifts are matched to the catalog on the phone. Found lifts then land one after another, so
 * the work shows, while the bar fills. Calls `onRead` once with the
 * match (null when nothing was found).
 */
export function useImportReader(
  input: ImportInput | null,
  customExercises: readonly CustomExerciseDefinition[],
  onRead: (match: PlanMatch | null) => void,
  /** Bumps to read the same input again. */
  attempt = 0,
): ReadState {
  const [state, setState] = useState<ReadState>(INITIAL);

  useEffect(() => {
    if (!input) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    let creep: ReturnType<typeof setInterval> | null = null;
    const stopCreep = () => {
      if (creep) clearInterval(creep);
      creep = null;
    };

    /** Claude reads it (decision 88); null when that fails, so the phone reads it instead. */
    const readInCloud = async (): Promise<ParsedPlan | null> => {
      try {
        let images: string[] | undefined;
        if (input.kind === 'images') {
          setState({ ...INITIAL, status: 'Preparing your screenshots', progress: PREPARE_SHARE / 2 });
          images = await Promise.all(input.uris.map((uri) => prepareImageForUpload(uri)));
          if (cancelled) return null;
        }
        const total = input.kind === 'images' ? input.uris.length : 0;
        let progress = PREPARE_SHARE;
        setState({
          ...INITIAL,
          status: total > 1 ? `Reading ${total} screenshots` : total === 1 ? 'Reading your screenshot' : 'Reading your plan',
          progress,
        });
        // The answer takes a few seconds and has no steps to report: the bar eases towards
        // CLOUD_SHARE so it keeps moving without ever claiming to be done.
        creep = setInterval(() => {
          progress += (CLOUD_SHARE - progress) * CREEP_RATE;
          setState((current) => ({ ...current, progress }));
        }, CREEP_TICK);
        const parsed = await readPlanRemotely(input.kind === 'images' ? { images } : { text: input.text });
        stopCreep();
        return parsed.days.length > 0 ? parsed : null;
      } catch {
        stopCreep();
        return null;
      }
    };

    const readOnPhone = async (): Promise<ParsedPlan> => {
      if (input.kind === 'text') {
        return parsePlanText(input.text);
      }
      const pages: string[][] = [];
      const total = input.uris.length;
      for (let index = 0; index < total; index += 1) {
        if (cancelled) break;
        setState({
          ...INITIAL,
          status: total > 1 ? `Reading screenshot ${index + 1} of ${total}` : 'Reading your screenshot',
          progress: (index / total) * OCR_SHARE,
        });
        const uri = input.uris[index] ?? '';
        // An image that can't be read adds nothing; the others still count.
        pages.push(await recognizeTextInImage(uri).catch(() => []));
      }
      return parsePlanText(joinScreenshotLines(pages));
    };

    const run = async () => {
      const cloud = await readInCloud();
      if (cancelled) return;
      const parsed = cloud ?? (await readOnPhone());
      if (cancelled) return;

      const match = matchParsedPlan(parsed, [...customExercises]);
      const total = liftCount(match);
      if (total === 0) {
        setState({ ...INITIAL, phase: 'empty', progress: 1 });
        onRead(null);
        return;
      }

      const start = cloud ? CLOUD_SHARE : input.kind === 'images' ? OCR_SHARE : TEXT_SHARE;
      const reveal = (shown: number) => {
        if (cancelled) return;
        const done = shown >= total;
        setState({
          phase: done ? 'done' : 'reading',
          status: done ? `${lifts(total)} in ${days(match.days.length)}` : `${lifts(shown)} found`,
          progress: start + (1 - start) * (shown / total),
          match,
          shown,
          unknown: unknownWithin(match, shown),
        });
        if (done) {
          onRead(match);
          return;
        }
        timer = setTimeout(() => reveal(shown + 1), IMPORT.ROW_STAGGER);
      };
      reveal(0);
    };

    // Off the effect's own tick: the first state lands from the work itself.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setState({ ...INITIAL, status: input.kind === 'images' ? 'Reading your screenshots' : 'Reading your text' });
      return run();
    });
    return () => {
      cancelled = true;
      stopCreep();
      if (timer) clearTimeout(timer);
    };
    // A new input (or a retry) reads again; the catalog and the callback don't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, attempt]);

  return state;
}
