import type { OpenSheet, SheetKind } from '@/device/device-state';

import { CheckInSheet } from './check-in-sheet';
import { BodySheet, LiftSheet } from './detail-sheets';
import { EmptySheet } from './empty-sheet';
import { FinishesSheet } from './finishes-sheet';
import { HistorySheet } from './history-sheet';
import { MenuSheet } from './menu-sheet';
import { ReceiptSheet } from './receipt-sheet';
import { GoalSheet } from './goal-sheet';
import { ProgressSheet } from './progress-sheet';
import { SettingsSheet } from './settings-sheet';

/** Sheets with a text field: their content ends above the keyboard. */
const KEYBOARD_SHEETS: readonly SheetKind[] = ['settings', 'editor', 'add', 'goal', 'checkin'];

export function sheetUsesKeyboard(kind: SheetKind): boolean {
  return KEYBOARD_SHEETS.includes(kind);
}

/** Titles of the sheets whose content comes in later phases. */
const TITLES: Record<SheetKind, string> = {
  menu: 'Trim',
  finishes: 'Finish',
  settings: 'Settings',
  plans: 'Plans',
  editor: 'Plan',
  add: 'Add lifts',
  progress: 'Progress',
  lift: 'Lift',
  body: 'Body',
  history: 'History',
  receipt: 'Receipt',
  today: 'Today',
  exercise: 'Exercise',
  goal: 'Goal',
  checkin: 'Check in',
};

/** The content for the open sheet. Keyed by the open, so a swap starts fresh (scroll at top). */
export function SheetContent({ sheet }: { sheet: OpenSheet }) {
  switch (sheet.kind) {
    case 'menu':
      // TODO(Phase 4): pass the open workout ({logged, total, onEnd}) from useLogSession.
      return <MenuSheet key={sheet.key} workout={null} />;
    case 'finishes':
      return <FinishesSheet key={sheet.key} />;
    case 'settings':
      return <SettingsSheet key={sheet.key} fromMenu={sheet.params.from === 'menu'} />;
    case 'history':
      return <HistorySheet key={sheet.key} params={sheet.params} />;
    case 'receipt':
      return <ReceiptSheet key={sheet.key} params={sheet.params} />;
    case 'progress':
      return <ProgressSheet key={sheet.key} params={sheet.params} />;
    case 'lift':
      return <LiftSheet key={sheet.key} params={sheet.params} />;
    case 'body':
      return <BodySheet key={sheet.key} params={sheet.params} />;
    case 'goal':
      return <GoalSheet key={sheet.key} params={sheet.params} />;
    case 'checkin':
      return <CheckInSheet key={sheet.key} params={sheet.params} />;
    default:
      return <EmptySheet key={sheet.key} title={TITLES[sheet.kind]} params={sheet.params} />;
  }
}
