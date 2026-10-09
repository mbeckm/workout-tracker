import { useSyncExternalStore } from 'react';

import type { PlanMatch } from '@/catalog/plan-import-match';
import type { ExercisePrescription } from '@/domain/types';

/** What the owner handed Trim: pasted text, or screenshots (file or data URIs). */
export type ImportInput = { kind: 'text'; text: string } | { kind: 'images'; uris: string[] };

/**
 * One import in progress (decision 88), shared by its screens: onboarding's routes and the Plans
 * sheet's steps. In memory only: an import that's abandoned leaves nothing behind.
 */
export type ImportSession = {
  input: ImportInput | null;
  /** What reading found, once it's done. */
  match: PlanMatch | null;
  /** The plan's name as the owner left it on the reading screen. */
  name: string;
  /** The Fix screen's answers, by `liftKey`: a lift to use, or null to leave it out. */
  fixes: ReadonlyMap<string, ExercisePrescription | null>;
};

const EMPTY: ImportSession = { input: null, match: null, name: '', fixes: new Map() };

let session: ImportSession = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getImportSession(): ImportSession {
  return session;
}

export function updateImportSession(patch: Partial<ImportSession>) {
  session = { ...session, ...patch };
  emit();
}

/** A new input starts a new import: what was read and fixed before is dropped. */
export function startImport(input: ImportInput) {
  session = { ...EMPTY, input };
  emit();
}

export function clearImport() {
  session = EMPTY;
  emit();
}

export function useImportSession(): ImportSession {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => session,
    () => session,
  );
}
