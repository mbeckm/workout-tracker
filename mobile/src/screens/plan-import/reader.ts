import { useEffect, useState } from 'react';

import { matchParsedPlan, type PlanMatch } from '@/catalog/plan-import-match';
import { joinScreenshotLines, parsePlanText } from '@/domain/plan-import';
import type { CustomExerciseDefinition } from '@/domain/types';
import { IMPORT } from '@/motion';

import { recognizeTextInImage } from '../../../modules/trim-device';
import type { ImportInput } from './session';

/** Share of the bar that reading the screenshots fills; finding the lifts fills the rest. */
const OCR_SHARE = 0.6;
/** Pasted text needs no reading, so its bar starts here. */
const TEXT_SHARE = 0.2;

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
 * Reads an import (decision 88): screenshots through on-device text recognition, one by one, then
 * the text into days and lifts matched to the catalog. Found lifts then land one after another, so
 * the work shows, while the bar fills. Nothing leaves the iPhone. Calls `onRead` once with the
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

    const run = async () => {
      let text: string;
      if (input.kind === 'images') {
        const pages: string[][] = [];
        const total = input.uris.length;
        for (let index = 0; index < total; index += 1) {
          if (cancelled) return;
          setState({
            ...INITIAL,
            status: total > 1 ? `Reading screenshot ${index + 1} of ${total}` : 'Reading your screenshot',
            progress: (index / total) * OCR_SHARE,
          });
          const uri = input.uris[index] ?? '';
          // An image that can't be read adds nothing; the others still count.
          pages.push(await recognizeTextInImage(uri).catch(() => []));
        }
        text = joinScreenshotLines(pages);
      } else {
        text = input.text;
      }
      if (cancelled) return;

      const match = matchParsedPlan(parsePlanText(text), [...customExercises]);
      const total = liftCount(match);
      if (total === 0) {
        setState({ ...INITIAL, phase: 'empty', progress: 1 });
        onRead(null);
        return;
      }

      const start = input.kind === 'images' ? OCR_SHARE : TEXT_SHARE;
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
      if (timer) clearTimeout(timer);
    };
    // A new input (or a retry) reads again; the catalog and the callback don't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, attempt]);

  return state;
}
