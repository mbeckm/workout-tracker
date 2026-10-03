/**
 * The device's UI state (PLAN §4.2): which sheet is up, the UI-only modes (`edit`, `loading`)
 * and a pending request to open the log. Pure TS, no `react-native`, so it can be checked with
 * `tsx`. Logging data never lives here: `log`, `rest` and `finish` come from the open log
 * session (Phase 4), which reads `logIntent` to know what to open.
 */

export type DeviceMode = 'home' | 'log' | 'rest' | 'finish' | 'edit' | 'loading';

/** Modes the UI sets itself; the others follow the log session. */
export type UiMode = Extract<DeviceMode, 'edit' | 'loading'>;

/** Modes that follow the open log session (Phase 4). */
export type LogMode = Extract<DeviceMode, 'log' | 'rest' | 'finish'>;

export const SHEET_KINDS = [
  'menu',
  'finishes',
  'settings',
  'plans',
  'editor',
  'add',
  'progress',
  'lift',
  'body',
  'history',
  'receipt',
  'today',
  'exercise',
  'keypad',
  // Phase 7: a lift's or body measurement's goal, and the body check-in (D11).
  'goal',
  'checkin',
] as const;

export type SheetKind = (typeof SHEET_KINDS)[number];

export function isSheetKind(value: unknown): value is SheetKind {
  return typeof value === 'string' && (SHEET_KINDS as readonly string[]).includes(value);
}

/** Whatever a sheet needs to know (ids, `new`), as strings like route params. */
export type SheetParams = Readonly<Record<string, string | undefined>>;

/** Where a sheet's top edge sits (SPEC §6 Top edge); the host maps it to points. */
export type SheetTop = 'default' | 'tall' | 'today' | 'finishes';

const TOPS: Record<SheetKind, SheetTop> = {
  menu: 'default',
  finishes: 'finishes',
  settings: 'default',
  plans: 'default',
  editor: 'tall',
  add: 'tall',
  progress: 'tall',
  lift: 'tall',
  body: 'tall',
  history: 'default',
  receipt: 'tall',
  today: 'today',
  exercise: 'tall',
  // Short like finishes, so the drum stays in view above it (D19).
  keypad: 'finishes',
  goal: 'tall',
  checkin: 'tall',
};

export function sheetTop(kind: SheetKind): SheetTop {
  return TOPS[kind];
}

/** Sheets whose opening is counted (PLAN §9 `sheet_opened`). */
export const TRACKED_SHEETS: readonly SheetKind[] = [
  'menu',
  'today',
  'exercise',
  'plans',
  'progress',
  'history',
  'settings',
];

export type OpenSheet = {
  kind: SheetKind;
  params: SheetParams;
  /** Bumps on every open or swap, so the host can tell a new content from a re-render. */
  key: number;
};

/** Open the log for this day (Start, a Live Activity tap, resume). Phase 4 consumes it. */
export type LogIntent = {
  planId: string;
  dayId: string;
  exerciseId?: string;
  /** A fresh start (plays the start moment); resume and Live Activity links never carry it. */
  start?: boolean;
  id: number;
};

/** A day whose workout just finished: Home stamps its row and flickers its lamp once (SPEC §7). */
export type JustFinished = { dayId: string; id: number };

/**
 * Device edit (PA2, screen 22): one lift's sets × reps on the device, opened from the editor
 * sheet's chip. `back` is the editor's params, so leaving edit puts the same editor back.
 */
export type EditTarget = {
  planId: string;
  dayId: string;
  exerciseId: string;
  back: SheetParams;
  id: number;
};

export type DeviceState = {
  sheet: OpenSheet | null;
  uiMode: UiMode | null;
  /** The open log session's mode (`log` / `rest` / `finish`), mirrored for readers outside it. */
  logMode: LogMode | null;
  logIntent: LogIntent | null;
  /** Set when the receipt closes (Phase 5); Home plays the stamp, then clears it. */
  justFinished: JustFinished | null;
  /** The lift on the device while `uiMode` is `edit` (Phase 6). */
  edit: EditTarget | null;
  /** Monotonic counter for `key` and `id`. */
  seq: number;
};

export const initialDeviceState: DeviceState = {
  sheet: null,
  uiMode: null,
  logMode: null,
  logIntent: null,
  justFinished: null,
  edit: null,
  seq: 0,
};

export type DeviceAction =
  /** Opens a sheet; with one already up, its content swaps in place (one sheet at a time). */
  | { type: 'openSheet'; kind: SheetKind; params?: SheetParams }
  /** Replaces the open sheet's content in place (‹ back, a row that opens its detail). */
  | { type: 'swapSheet'; kind: SheetKind; params?: SheetParams }
  | { type: 'closeSheet' }
  | { type: 'setUiMode'; mode: UiMode | null }
  /** The log session's mode changed (the device mirrors it; the session owns it). */
  | { type: 'setLogMode'; mode: LogMode | null }
  | { type: 'requestLog'; intent: Omit<LogIntent, 'id'> }
  /** The log session took the intent; `id` guards against clearing a newer one. */
  | { type: 'consumeLogIntent'; id: number }
  /** A workout of this day just finished: Home stamps it in when it next shows. */
  | { type: 'markJustFinished'; dayId: string }
  /** Home played the stamp; `id` guards against clearing a newer one. */
  | { type: 'clearJustFinished'; id: number }
  /** The editor's sets × reps chip: the sheet hides and the device edits that lift. */
  | { type: 'startEdit'; target: Omit<EditTarget, 'id'> }
  /** Done, ‹ or the rocker's middle in edit: the editor sheet comes back where it was. */
  | { type: 'leaveEdit' };

export function deviceReducer(state: DeviceState, action: DeviceAction): DeviceState {
  switch (action.type) {
    case 'openSheet':
    case 'swapSheet': {
      const seq = state.seq + 1;
      return { ...state, seq, sheet: { kind: action.kind, params: action.params ?? {}, key: seq } };
    }
    case 'closeSheet':
      return state.sheet ? { ...state, sheet: null } : state;
    case 'setUiMode':
      return state.uiMode === action.mode ? state : { ...state, uiMode: action.mode };
    case 'setLogMode':
      return state.logMode === action.mode ? state : { ...state, logMode: action.mode };
    case 'requestLog': {
      const seq = state.seq + 1;
      // Opening the log puts the device in front: any sheet goes away.
      return { ...state, seq, sheet: null, logIntent: { ...action.intent, id: seq } };
    }
    case 'consumeLogIntent':
      return state.logIntent?.id === action.id ? { ...state, logIntent: null } : state;
    case 'markJustFinished': {
      const seq = state.seq + 1;
      return { ...state, seq, justFinished: { dayId: action.dayId, id: seq } };
    }
    case 'clearJustFinished':
      return state.justFinished?.id === action.id ? { ...state, justFinished: null } : state;
    case 'startEdit': {
      const seq = state.seq + 1;
      return { ...state, seq, sheet: null, uiMode: 'edit', edit: { ...action.target, id: seq } };
    }
    case 'leaveEdit': {
      if (!state.edit) {
        return state;
      }
      const seq = state.seq + 1;
      return {
        ...state,
        seq,
        uiMode: state.uiMode === 'edit' ? null : state.uiMode,
        edit: null,
        sheet: { kind: 'editor', params: state.edit.back, key: seq },
      };
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** The mode on screen: a UI mode wins, then the log session's (mirrored unless passed), then Home. */
export function deviceMode(state: DeviceState, logMode: LogMode | null = state.logMode): DeviceMode {
  return state.uiMode ?? logMode ?? 'home';
}

export type LogCommand = { mode: 'log'; planId: string; dayId: string; exerciseId?: string; start?: boolean };
export type SheetCommand = { sheet: SheetKind; params?: SheetParams };
/** Device edit of one lift (Phase 6); `back` is the editor's params to return to. Never a link. */
export type EditCommand = { mode: 'edit'; planId: string; dayId: string; exerciseId: string; back?: SheetParams };

/** What `/` search params ask for (`?log=1&planId&dayId&exerciseId`, or `?sheet=…`), plus device edit. */
export type DeviceCommand = LogCommand | SheetCommand | EditCommand;

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads a device command from `/` search params; `null` when they ask for nothing. */
export function commandFromParams(raw: RawParams): DeviceCommand | null {
  const planId = first(raw.planId);
  const dayId = first(raw.dayId);
  if (first(raw.log) === '1' && planId && dayId) {
    const exerciseId = first(raw.exerciseId);
    return {
      mode: 'log',
      planId,
      dayId,
      ...(exerciseId ? { exerciseId } : {}),
      ...(first(raw.start) === '1' ? { start: true } : {}),
    };
  }
  const sheet = first(raw.sheet);
  if (!isSheetKind(sheet)) {
    return null;
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (key !== 'sheet' && v != null) {
      params[key] = v;
    }
  }
  return { sheet, params };
}

/** The reducer action a command maps to. */
export function actionForCommand(command: DeviceCommand): DeviceAction {
  if ('mode' in command && command.mode === 'edit') {
    const { mode: _mode, back, ...target } = command;
    return { type: 'startEdit', target: { ...target, back: back ?? { planId: command.planId } } };
  }
  if ('mode' in command) {
    const { mode: _mode, ...intent } = command;
    return { type: 'requestLog', intent };
  }
  return { type: 'openSheet', kind: command.sheet, params: command.params };
}

/** `/` with the params for a command, for links into the device from routes and deep links. */
export function deviceHref(command: LogCommand | SheetCommand): `/?${string}` {
  const params = new URLSearchParams();
  if ('mode' in command) {
    params.set('log', '1');
    params.set('planId', command.planId);
    params.set('dayId', command.dayId);
    if (command.exerciseId) params.set('exerciseId', command.exerciseId);
    if (command.start) params.set('start', '1');
  } else {
    params.set('sheet', command.sheet);
    for (const [key, value] of Object.entries(command.params ?? {})) {
      if (value != null) params.set(key, value);
    }
  }
  return `/?${params.toString()}`;
}
