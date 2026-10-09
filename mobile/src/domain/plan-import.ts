/**
 * Import plan: turns pasted text (a ChatGPT answer, an Apple Note) or OCR'd screenshots of
 * another workout app (Hevy, Strong, Alpha Progression) into days of lifts. Pure and offline:
 * no catalog, no network. Matching lifts to the catalog lives in `catalog/plan-import-match.ts`.
 *
 * Conservative by design: a line only becomes a lift when it reads like one (a sets/reps spec,
 * or a short name with no prose around it). Intro, notes and outro prose are dropped, and the
 * Fix screen catches the rest.
 */

export type ImportedLift = {
  /** The line as written, trimmed (shown on the Fix screen in quotes). */
  raw: string;
  /** The exercise name cleaned for matching and display: no bullets, numbering, markdown, sets/reps, trailing punctuation. Keep parenthetical text separately. */
  name: string;
  /** Text inside parentheses, if any ("Barbell" from "Bench Press (Barbell)"). */
  qualifier: string | null;
  sets: number | null;
  /** Top of a range: "6-8" → 8; null when none or AMRAP/failure. */
  reps: number | null;
  /** Holds: "3 x 30s", "60 sec plank". */
  seconds: number | null;
};

export type ImportedDay = { title: string | null; lifts: ImportedLift[] };

export type ParsedPlan = { name: string | null; days: ImportedDay[] };

/** Joins several OCR'd screenshots (each a string[] of lines) into one text, in order. */
export function joinScreenshotLines(pages: readonly (readonly string[])[]): string {
  return pages.map((lines) => lines.join('\n')).join('\n\n');
}

/* ----------------------------------------------------------------------------------------- *
 * Lines
 * ----------------------------------------------------------------------------------------- */

type Line = {
  raw: string;
  /** Bullets, numbering and markdown gone; dashes are `-`, `×` is `x`. */
  text: string;
  /** `#` count for a markdown heading, 0 otherwise. A bold-only line counts as level 4. */
  heading: number;
};

const BOLD_LINE_LEVEL = 4;
const PLAIN_LEVEL = 99;

function normalizedLine(value: string): string {
  return value
    .replace(/[–—‒−]/g, '-')
    .replace(/[×✕✖]/g, 'x')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/(^|\s)[*_]+(?=\S)/g, '$1')
    .replace(/(\S)[*_]+(?=[\s:;,.]|$)/g, '$1')
    .trim();
}

function readLine(raw: string): Line {
  let text = normalizedLine(raw);
  let heading = 0;
  const hashes = /^(#{1,6})\s+/.exec(text);
  if (hashes) {
    heading = hashes[1].length;
    text = text.slice(hashes[0].length);
  }
  // Bullets, checkboxes and numbering: `-`, `*`, `•`, `1.`, `1)`, `(1)`, `A1.`, `[ ]`.
  text = text
    .replace(/^(?:[-*+•·▪◦‣>]\s*)+(?=\S)/, '')
    .replace(/^\[[ xX]?\]\s*/, '')
    .replace(/^(?:\(?\d{1,2}[.)]|[A-Z]\d{1,2}[.):]?)\s+/, '');
  if (heading === 0 && /^\*\*[^*]+\*\*:?$/.test(text)) {
    heading = BOLD_LINE_LEVEL;
  }
  text = stripMarkdown(text);
  return { raw: raw.trim(), text, heading };
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
}

function hasLetters(value: string): boolean {
  return /[a-z]/i.test(value);
}

/* ----------------------------------------------------------------------------------------- *
 * Sets and reps
 * ----------------------------------------------------------------------------------------- */

type Spec = {
  sets: number | null;
  reps: number | null;
  seconds: number | null;
  start: number;
  end: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

const RANGE = String.raw`(\d{1,3})(?:\s*(?:-|to)\s*(\d{1,3}))?`;
const UNIT = String.raw`(reps?|repetitions|s|secs?|seconds|min|mins|minutes)`;
const OPEN = String.raw`(amrap|max(?:\s*reps)?|(?:to\s+)?failure)`;

/** `Sets: 4 Reps: 8` */
const LABELLED = new RegExp(
  String.raw`\bsets?\s*[:=]\s*(\d{1,2})\b(?:[\s,;|/]*\breps?\s*[:=]\s*(?:${RANGE}|${OPEN}))?`,
  'i',
);
/** `4 sets of 8-10 reps`, `4 sets x 8`, `4 sets, 8–10 reps`, `4 sets • 8-10 reps`, `3 sets to failure` */
const SETS_OF = new RegExp(
  String.raw`\b(\d{1,2})\s*sets?\b\s*(?:of|x|,|•|·|-|:|/|@)?\s*(?:${RANGE}\s*${UNIT}?(?![a-z])|${OPEN})?`,
  'i',
);
/** `4x8`, `4 x 8-10`, `3 x 45s`, `3 x AMRAP`, `5x5` */
const BY = new RegExp(String.raw`(^|[^\w.])(\d{1,2})\s*x\s*(?:${RANGE}\s*${UNIT}?(?![a-z])|${OPEN})`, 'i');
/** `8 reps`, `8-12 reps` */
const REPS_ONLY = new RegExp(String.raw`\b${RANGE}\s*(?:reps?|repetitions)\b`, 'i');
/** `60 sec plank`, `Plank 45s` */
const SECONDS_ONLY = new RegExp(String.raw`\b${RANGE}\s*(s|secs?|seconds|min|mins|minutes)\b`, 'i');

function top(low: string | undefined, high: string | undefined): number | null {
  const value = Number(high ?? low);
  return Number.isFinite(value) && (low != null || high != null) ? value : null;
}

/** Reps or seconds from a range plus its unit; seconds when the unit is time. */
function amount(low: string | undefined, high: string | undefined, unit: string | undefined) {
  const value = top(low, high);
  if (value == null) {
    return { reps: null, seconds: null };
  }
  const lower = unit?.toLowerCase() ?? '';
  if (lower.startsWith('min')) {
    return { reps: null, seconds: value * 60 };
  }
  if (lower === 's' || lower.startsWith('sec')) {
    return { reps: null, seconds: value };
  }
  return { reps: value, seconds: null };
}

function finished(spec: Spec): Spec {
  return {
    ...spec,
    sets: spec.sets == null ? null : clamp(spec.sets, 1, 10),
    reps: spec.reps == null ? null : clamp(spec.reps, 1, 100),
    seconds: spec.seconds == null ? null : clamp(spec.seconds, 5, 600),
  };
}

function parseSpec(text: string): Spec | null {
  let match = LABELLED.exec(text);
  if (match) {
    return finished({
      sets: Number(match[1]),
      reps: top(match[2], match[3]),
      seconds: null,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  match = SETS_OF.exec(text);
  if (match) {
    return finished({
      sets: Number(match[1]),
      ...amount(match[2], match[3], match[4]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  match = BY.exec(text);
  if (match) {
    const start = match.index + match[1].length;
    return finished({
      sets: Number(match[2]),
      ...amount(match[3], match[4], match[5]),
      start,
      end: match.index + match[0].length,
    });
  }
  match = REPS_ONLY.exec(text);
  if (match) {
    return finished({
      sets: null,
      reps: top(match[1], match[2]),
      seconds: null,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  match = SECONDS_ONLY.exec(text);
  if (match) {
    return finished({
      sets: null,
      ...amount(match[1], match[2], match[3]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return null;
}

/* ----------------------------------------------------------------------------------------- *
 * Names
 * ----------------------------------------------------------------------------------------- */

const EDGE_JUNK = /^[\s:;,.\-|•·@=]+|[\s:;,.\-|•·@=]+$/g;
const SIDE_WORDS = /\b(?:each|per|\/)\s*(?:side|leg|arm)s?\b|\/\s*(?:side|leg|arm)s?\b/gi;
const LOAD_WORDS = /\b\d+(?:[.,]\d+)?\s*(?:kg|kgs|lbs?|%)(?![a-z])|@\s*rpe\s*\d+(?:\.\d)?|\brpe\s*\d+(?:\.\d)?/gi;

function cleanName(value: string): { name: string; qualifier: string | null } {
  let name = value.replace(SIDE_WORDS, ' ').replace(LOAD_WORDS, ' ');
  let qualifier: string | null = null;
  name = name.replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (_, round: string | undefined, square: string | undefined) => {
    const inside = (round ?? square ?? '').trim();
    if (qualifier == null && inside) {
      qualifier = inside;
    }
    return ' ';
  });
  name = name.replace(/\([^)]*$/, ' ').replace(/\s+/g, ' ').replace(EDGE_JUNK, '').trim();
  return { name, qualifier };
}

/** Words that, alone, say nothing about the lift: a spec-only line like `4 sets • 8-10 reps`. */
const FILLER = new Set([
  'sets', 'set', 'reps', 'rep', 'x', 'of', 'and', 'each', 'side', 'per', 'rir', 'rpe', 'rest',
  'working', 'target', 'kg', 'lbs', 'lb', 'min', 'mins', 'minutes', 'sec', 'secs', 'seconds', 's',
]);

function isFiller(value: string): boolean {
  return words(value).every((word) => FILLER.has(word) || /^\d+$/.test(word));
}

/* ----------------------------------------------------------------------------------------- *
 * Day headers, notes, prose and app chrome
 * ----------------------------------------------------------------------------------------- */

const WEEKDAY = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b(?=\s*(?:[-:|,.]|$|\s))/i;
const DAY_N = /^(?:day|tag)\s*(\d{1,2}|one|two|three|four|five|six|seven)\b/i;
const WORKOUT_N = /^(?:workout|session|routine|training|day)\s+([a-e]|\d{1,2})$/i;

/** Every word of a vocabulary header (`Upper A`, `Push Day`, `Chest & Triceps`). */
const HEADER_WORDS = new Set([
  'upper', 'lower', 'body', 'push', 'pull', 'leg', 'legs', 'full', 'total', 'day', 'arms', 'arm',
  'chest', 'back', 'shoulders', 'shoulder', 'delts', 'glutes', 'glute', 'core', 'abs',
  'posterior', 'anterior', 'chain', 'triceps', 'tricep', 'biceps', 'bicep', 'hamstrings',
  'hamstring', 'quads', 'quad', 'calves', 'strength', 'hypertrophy', 'power', 'heavy', 'light',
  'volume', 'focus', 'focused', 'and', 'a', 'b', 'c', 'd', 'e', 'i', 'ii', 'workout', 'session',
  'training', 'rest', 'recovery', 'active', 'off', 'cardio', 'conditioning', 'mobility',
  '1', '2', '3', '4', '5', '6', '7',
]);
/** A vocabulary header needs one of these, so `A` or `Heavy` alone stays out. */
const HEADER_ANCHORS = new Set([
  'upper', 'lower', 'push', 'pull', 'leg', 'legs', 'full', 'arms', 'chest', 'back', 'shoulders',
  'glutes', 'core', 'rest', 'posterior', 'cardio',
]);

/** Section labels whose lines are advice, not lifts. */
const NOTE_START = /^(?:rest|warm[\s-]?ups?|cool[\s-]?downs?|progression|progressive overload|tips?|notes?|focus|goals?|frequency|duration|deload|weeks?|phase|nutrition|sleep|diet|important|remember|optional|guidelines?|schedule|overview|summary|key|why|how|general|final|recovery)\b/i;

/** First words that start a sentence, not an exercise name. */
const PROSE_START = new Set([
  'here', "here's", 'heres', 'this', 'these', 'that', 'those', 'it', "it's", 'you', 'your', "you'll",
  'i', "i'd", "i've", 'we', 'if', 'when', 'for', 'aim', 'keep', 'make', 'try', 'use', 'add',
  'increase', 'decrease', 'perform', 'start', 'finish', 'alternate', 'repeat', 'complete',
  'choose', 'pick', 'stay', 'consider', 'remember', 'ensure', 'adjust', 'track', 'feel', 'let',
  "let's", 'enjoy', 'good', 'great', 'sure', 'hope', 'would', 'want', 'need', 'can', 'should',
  'then', 'also', 'after', 'before', 'between', 'every', 'in', 'with', 'at', 'as', 'by', 'to',
  'all', 'most', 'some', 'the', 'an', 'do', 'don\'t', 'avoid', 'rotate', 'swap', 'follow', 'go',
  'take', 'listen', 'drink', 'eat', 'get', 'sleep', 'once', 'over', 'on', 'or', 'and', 'note',
  'created', 'last', 'updated', 'happy', 'feel', 'quick', 'optionally',
]);

/** OCR chrome from workout apps: buttons, tabs, units. Compared lowercased, whole line. */
const CHROME = new Set([
  'edit', 'start workout', 'start routine', 'start empty workout', 'add exercise', 'add exercises',
  'add set', '+ add set', 'add notes here...', 'add notes here', 'add routine notes here',
  'notes', 'kg', 'lbs', 'lb', 'finish', 'cancel', 'save', 'done', 'share', 'copy', 'routine',
  'routines', 'workout', 'workouts', 'profile', 'home', 'history', 'exercises', 'exercise',
  'reorder', 'replace exercise', 'duration', 'volume', 'sets', 'reps', 'set', 'more', 'menu',
  'settings', 'log', 'measure', 'start', 'next', 'skip', '< back', '‹ back', 'back to routines',
  'superset', 'warm up', 'warm-up', 'new routine', 'explore', 'copy routine', 'edit routine',
  'ex', 'previous', 'weight', 'rpe', 'timer', 'rest timer',
]);
const CHROME_PREFIX =
  /^(?:rest timer|add notes|duration\b|volume\b|last performed|last time|created by|estimated|est\.|exercises?\s+\d+$|\d+\s+(?:exercises?|sets?)$)/i;

type Header = { title: string; explicit: boolean };

function headerTitle(text: string): Header | null {
  const plain = text.replace(/:$/, '').trim();
  if (!plain || parseSpecLoose(plain)) {
    return null;
  }
  const dayN = DAY_N.exec(plain);
  const weekday = dayN ? null : WEEKDAY.exec(plain);
  const prefix = dayN ?? weekday;
  if (prefix) {
    const remainder = plain.slice(prefix[0].length).replace(/^[\s:|,.-]+/, '');
    const { name: rest, qualifier } = cleanName(remainder.split(':')[0] ?? '');
    const restTitle = rest.replace(EDGE_JUNK, '').trim();
    if (restTitle && words(restTitle).length > 6) {
      return null;
    }
    const lead = cleanName(prefix[0]).name;
    return { title: restTitle || qualifier || titleCase(lead), explicit: true };
  }
  if (WORKOUT_N.test(plain)) {
    return { title: plain, explicit: true };
  }
  const { name } = cleanName(plain);
  const list = name.toLowerCase().split(/[\s/&+,-]+/).filter(Boolean);
  if (
    list.length > 0 &&
    list.length <= 6 &&
    list.every((word) => HEADER_WORDS.has(word)) &&
    list.some((word) => HEADER_ANCHORS.has(word))
  ) {
    return { title: name, explicit: false };
  }
  return null;
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** A spec somewhere in the line that has a number of sets or reps (not a stray "5 min"). */
function parseSpecLoose(text: string): boolean {
  const spec = parseSpec(text);
  return spec != null && (spec.sets != null || spec.reps != null);
}

function isProse(text: string): boolean {
  const list = words(text);
  if (list.length === 0) {
    return false;
  }
  if (text.includes('?') || PROSE_START.has(list[0])) {
    return true;
  }
  if (/[.!]$/.test(text) && list.length >= 4) {
    return true;
  }
  return list.length > 8;
}

/* ----------------------------------------------------------------------------------------- *
 * Set tables (Hevy, Strong) and markdown tables (ChatGPT)
 * ----------------------------------------------------------------------------------------- */

const TABLE_WORDS = new Set(['set', 'sets', 'previous', 'kg', 'lbs', 'lb', 'reps', 'rep', 'rpe', 'weight', '+kg', 'km', 'time', '✓', '✔', 'rir']);

/** `SET  KG  REPS`, `SET  PREVIOUS  LBS  REPS`: the columns, or null. */
function tableHeader(text: string): string[] | null {
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.includes('set') && !tokens.includes('sets')) {
    return null;
  }
  if (!tokens.includes('reps') && !tokens.includes('rep')) {
    return null;
  }
  if (tokens.filter((token) => !TABLE_WORDS.has(token)).length > 1) {
    return null;
  }
  return text.toLowerCase().split(/\s{2,}|\t/).map((cell) => cell.trim()).filter(Boolean);
}

const ROW_TOKEN = /^(?:\d+(?:[.,]\d+)?(?:kg|lbs?)?|kg|lbs?|x|-|@|✓|✔|[wdf])$/i;

type SetRow = { working: boolean; reps: number | null };

/** `1  60  8`, `W  40  10`, `2  60kg x 8  60  8`: a set row, or null. */
function setRow(raw: string, columns: readonly string[] | null): SetRow | null {
  const text = normalizedLine(raw);
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || !/^(?:\d{1,2}|[wdf])$/i.test(tokens[0]) || !tokens.every((token) => ROW_TOKEN.test(token))) {
    return null;
  }
  const cells = text.split(/\s{2,}|\t/).filter(Boolean);
  const repsColumn = columns ? columns.findIndex((cell) => cell === 'reps' || cell === 'rep') : -1;
  let reps: number | null = null;
  if (repsColumn >= 0 && cells.length === columns?.length) {
    const value = Number.parseInt(cells[repsColumn] ?? '', 10);
    reps = Number.isFinite(value) ? value : null;
  }
  if (reps == null) {
    const numbers = tokens.slice(1).filter((token) => /^\d+$/.test(token));
    reps = numbers.length > 0 ? Number(numbers[numbers.length - 1]) : null;
  }
  return { working: !/^w$/i.test(tokens[0]), reps: reps == null || reps <= 0 ? null : clamp(reps, 1, 100) };
}

/** The most common reps value; ties go to the later one. */
function commonReps(values: readonly number[]): number | null {
  let best: number | null = null;
  let bestCount = 0;
  const counts = new Map<number, number>();
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count >= bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

type MarkdownColumns = { name: number; sets: number; reps: number };

function markdownCells(text: string): string[] {
  return text.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => stripMarkdown(cell.trim()));
}

function markdownColumns(cells: readonly string[]): MarkdownColumns | null {
  const lower = cells.map((cell) => cell.toLowerCase());
  const name = lower.findIndex((cell) => /exercise|lift|movement|name/.test(cell));
  const sets = lower.findIndex((cell) => /^sets?\b/.test(cell));
  const reps = lower.findIndex((cell) => /reps?|time|duration/.test(cell));
  return name >= 0 && (sets >= 0 || reps >= 0) ? { name, sets, reps } : null;
}

/* ----------------------------------------------------------------------------------------- *
 * The parser
 * ----------------------------------------------------------------------------------------- */

type Item =
  | { kind: 'skip' }
  | { kind: 'blank' }
  | { kind: 'header'; header: Header; heading: number }
  | { kind: 'heading'; title: string; heading: number }
  | { kind: 'label'; notes: boolean }
  | { kind: 'tableHeader'; columns: string[] }
  | { kind: 'markdownRow'; cells: string[] }
  | { kind: 'detail'; spec: Spec }
  | { kind: 'lift'; lift: ImportedLift; specified: boolean };

function liftFrom(raw: string, text: string, spec: Spec | null): ImportedLift | null {
  let source = text;
  if (spec) {
    const before = cleanName(text.slice(0, spec.start));
    source = before.name ? text.slice(0, spec.start) : text.slice(spec.end).split(/[,(]/)[0] ?? '';
  }
  const { name, qualifier } = cleanName(source);
  if (!name || !hasLetters(name) || isFiller(name)) {
    return null;
  }
  return {
    raw,
    name,
    qualifier,
    sets: spec?.sets ?? null,
    reps: spec?.reps ?? null,
    seconds: spec?.seconds ?? null,
  };
}

function classify(line: Line): Item {
  const { raw, text, heading } = line;
  if (!text) {
    return { kind: 'blank' };
  }
  if (/^\|.*\|$/.test(text)) {
    return { kind: 'markdownRow', cells: markdownCells(text) };
  }
  const columns = tableHeader(text);
  if (columns) {
    return { kind: 'tableHeader', columns };
  }
  const lower = text.toLowerCase().replace(/:$/, '');
  const plainLine = heading === 0 && !text.endsWith(':');
  if (!hasLetters(text) || (plainLine && CHROME.has(lower)) || CHROME_PREFIX.test(text)) {
    return { kind: 'skip' };
  }
  const header = headerTitle(text);
  if (header) {
    return { kind: 'header', header, heading: heading || PLAIN_LEVEL };
  }
  const label = heading > 0 || text.endsWith(':') || words(text).length <= 2;
  if (NOTE_START.test(text)) {
    return label && !/:\s*\S/.test(text) ? { kind: 'label', notes: true } : { kind: 'skip' };
  }
  const spec = parseSpec(text);
  if (spec && (spec.sets != null || spec.reps != null || spec.seconds != null)) {
    const nameText = cleanName(text.slice(0, spec.start)).name;
    if (!nameText || isFiller(nameText)) {
      // `60 sec plank` names the lift after the spec; `4 sets • 8-10 reps • 2 min rest` doesn't.
      const after = liftFrom(raw, text, spec);
      return after && !/\d/.test(after.name) && !isProse(after.name)
        ? { kind: 'lift', lift: after, specified: true }
        : { kind: 'detail', spec };
    }
    if (isProse(nameText) || words(nameText).length > 6) {
      return { kind: 'skip' };
    }
    const lift = liftFrom(raw, text, spec);
    return lift ? { kind: 'lift', lift, specified: true } : { kind: 'skip' };
  }
  if (heading > 0) {
    return { kind: 'heading', title: cleanName(text.replace(/:$/, '')).name, heading };
  }
  if (text.endsWith(':')) {
    return { kind: 'label', notes: false };
  }
  if (isProse(text) || words(text).length > 6 || /[.!]$/.test(text)) {
    return { kind: 'skip' };
  }
  const lift = liftFrom(raw, text, null);
  return lift ? { kind: 'lift', lift, specified: false } : { kind: 'skip' };
}

/** The plan name a leading title gives: short, and not a sentence. */
function titleCandidate(lift: ImportedLift): string | null {
  return words(lift.name).length <= 5 && lift.qualifier == null ? lift.name : null;
}

export function parsePlanText(text: string): ParsedPlan {
  const items = text.split(/\r?\n/).map((raw) => {
    const line = readLine(raw);
    return { line, item: classify(line) };
  });

  const days: ImportedDay[] = [];
  let day: ImportedDay | null = null;
  let name: string | null = null;
  let started = false; // a day header or a lift has been seen
  let notes = false;
  /** A short plain first line: the plan name if a day header follows, else a lift. */
  let pendingTitle: ImportedLift | null = null;
  let lastLift: { lift: ImportedLift; specified: boolean } | null = null;
  let table: { columns: string[]; reps: number[]; count: number } | null = null;
  let markdown: MarkdownColumns | null = null;

  const currentDay = (): ImportedDay => {
    if (!day) {
      day = { title: null, lifts: [] };
      days.push(day);
    }
    return day;
  };
  const closeTable = () => {
    if (table && lastLift && !lastLift.specified && table.count > 0) {
      lastLift.lift.sets = clamp(table.count, 1, 10);
      lastLift.lift.reps = commonReps(table.reps);
      lastLift.specified = true;
    }
    table = null;
  };
  const addLift = (lift: ImportedLift, specified: boolean) => {
    closeTable();
    currentDay().lifts.push(lift);
    lastLift = { lift, specified };
    started = true;
  };
  const flushPending = () => {
    if (pendingTitle) {
      const lift = pendingTitle;
      pendingTitle = null;
      addLift(lift, false);
    }
  };
  const nextHeaderLevel = (from: number): number | null => {
    for (let index = from + 1; index < items.length; index += 1) {
      const next = items[index].item;
      if (next.kind === 'header') {
        return next.heading;
      }
      if (next.kind === 'lift') {
        return null;
      }
    }
    return null;
  };

  items.forEach(({ line, item }, index) => {
    if (table && item.kind !== 'tableHeader') {
      const row = setRow(line.raw, table.columns);
      if (row) {
        if (row.working) {
          table.count += 1;
          if (row.reps != null) {
            table.reps.push(row.reps);
          }
        }
        return;
      }
      if (item.kind !== 'skip' && item.kind !== 'blank') {
        closeTable();
      }
    }
    if (item.kind !== 'markdownRow') {
      markdown = null;
    }

    switch (item.kind) {
      case 'blank':
      case 'skip':
        return;
      case 'tableHeader':
        closeTable();
        if (pendingTitle) {
          flushPending();
        }
        table = { columns: item.columns, reps: [], count: 0 };
        return;
      case 'markdownRow': {
        if (/^[\s|:-]+$/.test(line.text)) {
          return;
        }
        if (!markdown) {
          markdown = markdownColumns(item.cells);
          return;
        }
        const cells = item.cells;
        const cell = (column: number) => (column >= 0 ? cells[column] ?? '' : '');
        const spec = parseSpec(`${cell(markdown.sets) || '1'} x ${cell(markdown.reps)}`);
        const lift = liftFrom(line.raw, cell(markdown.name), null);
        if (lift && !notes) {
          flushPending();
          if (spec) {
            lift.sets = markdown.sets >= 0 ? spec.sets : null;
            lift.reps = spec.reps;
            lift.seconds = spec.seconds;
          }
          addLift(lift, spec != null);
        }
        return;
      }
      case 'header': {
        const { header, heading } = item;
        if (!started && name == null && !header.explicit && heading < PLAIN_LEVEL) {
          const next = nextHeaderLevel(index);
          if (next != null && next > heading) {
            name = header.title;
            return;
          }
        }
        if (pendingTitle && !started) {
          name = titleCandidate(pendingTitle);
          pendingTitle = null;
        }
        closeTable();
        notes = false;
        started = true;
        lastLift = null;
        if (day && day.lifts.length === 0) {
          days.pop();
        }
        day = { title: header.title, lifts: [] };
        days.push(day);
        return;
      }
      case 'heading':
        flushPending();
        if (!started && name == null && !notes && item.title && words(item.title).length <= 8) {
          name = item.title;
        } else if (started) {
          notes = true;
        }
        return;
      case 'label':
        flushPending();
        notes = item.notes;
        return;
      case 'detail':
        flushPending();
        if (lastLift && !lastLift.specified && !table) {
          lastLift.lift.sets = item.spec.sets;
          lastLift.lift.reps = item.spec.reps;
          lastLift.lift.seconds = item.spec.seconds;
          lastLift.specified = true;
        }
        return;
      case 'lift':
        if (notes && !(item.specified && item.lift.sets != null)) {
          return;
        }
        if (!started && !pendingTitle && name == null && !item.specified && titleCandidate(item.lift)) {
          pendingTitle = item.lift;
          return;
        }
        flushPending();
        addLift(item.lift, item.specified);
        return;
    }
  });
  closeTable();
  flushPending();

  return { name, days: days.filter((entry) => entry.lifts.length > 0) };
}
