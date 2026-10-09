import type { OpenSheet, SheetKind } from '@/device/device-state';

import { AddLiftsSheet } from './add-sheet';
import { CheckInSheet } from './check-in-sheet';
import { BodySheet, LiftSheet } from './detail-sheets';
import { EditorSheet } from './editor-sheet';
import { EmptySheet } from './empty-sheet';
import { ExerciseSheet } from './exercise-sheet';
import { FinishesSheet } from './finishes-sheet';
import { KeypadSheet } from './keypad-sheet';
import { DeviceMenuSheet } from './menu-sheet';
import { HistorySheet } from './history-sheet';
import { PlansSheet } from './plans-sheet';
import { ReceiptSheet } from './receipt-sheet';
import { GoalSheet } from './goal-sheet';
import { ProgressSheet } from './progress-sheet';
import { SettingsSheet } from './settings-sheet';
import { TodaySheet } from './today-sheet';

/** Sheets with a text field: their content ends above the keyboard. */
const KEYBOARD_SHEETS: readonly SheetKind[] = ['settings', 'editor', 'add', 'goal', 'checkin', 'today'];

export function sheetUsesKeyboard(kind: SheetKind): boolean {
  return KEYBOARD_SHEETS.includes(kind);
}

/** Titles of the sheets whose content comes in later phases. */
const TITLES: Record<SheetKind, string> = {
  menu: 'Trim',
  finishes: 'Skin Library',
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
  keypad: 'Weight',
  goal: 'Goal',
  checkin: 'Check in',
};

/** The content for the open sheet. Keyed by the open, so a swap starts fresh (scroll at top). */
export function SheetContent({ sheet }: { sheet: OpenSheet }) {
  switch (sheet.kind) {
    case 'menu':
      return <DeviceMenuSheet key={sheet.key} tour={sheet.params.tour === '1'} />;
    case 'today':
      return <TodaySheet key={sheet.key} params={sheet.params} />;
    case 'keypad':
      return <KeypadSheet key={sheet.key} />;
    case 'exercise':
      return <ExerciseSheet key={sheet.key} params={sheet.params} />;
    case 'finishes':
      return <FinishesSheet key={sheet.key} />;
    case 'settings':
      return <SettingsSheet key={sheet.key} fromMenu={sheet.params.from === 'menu'} />;
    case 'plans':
      return <PlansSheet key={sheet.key} params={sheet.params} />;
    case 'editor':
      return <EditorSheet key={sheet.key} params={sheet.params} />;
    case 'add':
      return <AddLiftsSheet key={sheet.key} params={sheet.params} />;
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
