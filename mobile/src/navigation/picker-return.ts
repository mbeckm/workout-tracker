/**
 * The plan editor hands the picker a day and gets it back on return (trim-ui §13 Plan detail):
 * which day to scroll to, and which exercises were already there, so the ones that just
 * arrived can light up once. Module state, like `plan-created`: one picker at a time.
 */
let pending: { dayId: string; knownIds: Set<string> } | null = null;

export function rememberPickerDay(dayId: string, exerciseIds: readonly string[]) {
  pending = { dayId, knownIds: new Set(exerciseIds) };
}

/** The day the picker was opened for, if any. Consumed on read. */
export function takePickerDay(): { dayId: string; knownIds: Set<string> } | null {
  const value = pending;
  pending = null;
  return value;
}
