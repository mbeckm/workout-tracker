import type { ImportedDay, ImportedLift, ParsedPlan } from '@/domain/plan-import';

/**
 * Import plan's reader in the cloud (decision 88): Trim's own endpoint (`server/`, Vercel
 * `trim-api`) asks Claude to read pasted text or screenshots and returns the plan's structure,
 * which then goes through the same catalog matching as the on-device parser. Any failure
 * (offline, slow, refused) throws, and the caller reads on the phone instead.
 */
const ENDPOINT = `${process.env.EXPO_PUBLIC_IMPORT_API_URL?.trim() || 'https://trim-api.vercel.app'}/api/import-plan`;

/** A screenshot import takes a few seconds; past this the phone reads it itself. */
const TIMEOUT_MS = 45_000;

type RemoteLift = {
  name: string;
  qualifier: string | null;
  sets: number | null;
  reps: number | null;
  seconds: number | null;
};
type RemotePlan = { name: string | null; days: { title: string | null; lifts: RemoteLift[] }[] };

function clampInt(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null;
}

function toLift(lift: RemoteLift): ImportedLift | null {
  const name = typeof lift.name === 'string' ? lift.name.trim() : '';
  if (!name) return null;
  return {
    raw: name,
    name,
    qualifier: typeof lift.qualifier === 'string' && lift.qualifier.trim() ? lift.qualifier.trim() : null,
    sets: clampInt(lift.sets, 1, 10),
    reps: clampInt(lift.reps, 1, 100),
    seconds: clampInt(lift.seconds, 5, 600),
  };
}

/** The endpoint's answer in the parser's shape, defensively: nothing it sends is trusted as-is. */
function toParsedPlan(plan: RemotePlan): ParsedPlan {
  const days: ImportedDay[] = (Array.isArray(plan.days) ? plan.days : [])
    .map((day) => ({
      title: typeof day.title === 'string' && day.title.trim() ? day.title.trim() : null,
      lifts: (Array.isArray(day.lifts) ? day.lifts : []).map(toLift).filter((lift): lift is ImportedLift => lift != null),
    }))
    .filter((day) => day.lifts.length > 0);
  return { name: typeof plan.name === 'string' && plan.name.trim() ? plan.name.trim() : null, days };
}

export async function readPlanRemotely(input: { text?: string; images?: string[] }): Promise<ParsedPlan> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`import-plan ${response.status}`);
    }
    return toParsedPlan((await response.json()) as RemotePlan);
  } finally {
    clearTimeout(timer);
  }
}
