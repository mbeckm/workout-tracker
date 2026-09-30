/**
 * Home's head (trim-ui §13 Home): the time of day and the user's name, plain. `Morning, Marvin`;
 * without a name, `Good morning`. No exclamation mark, no rotating lines (trim-ui §9).
 */
export type DayPart = 'morning' | 'afternoon' | 'evening';

/** Where each part starts, in local hours. Evening runs through the night until 5. */
const MORNING_FROM = 5;
const AFTERNOON_FROM = 12;
const EVENING_FROM = 18;

export function dayPartAt(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= MORNING_FROM && hour < AFTERNOON_FROM) {
    return 'morning';
  }
  if (hour >= AFTERNOON_FROM && hour < EVENING_FROM) {
    return 'afternoon';
  }
  return 'evening';
}

/** Milliseconds from `date` until the greeting's next boundary (5:00, 12:00 or 18:00). */
export function msUntilNextDayPart(date: Date): number {
  const next = [MORNING_FROM, AFTERNOON_FROM, EVENING_FROM]
    .map((hour) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour))
    .find((boundary) => boundary.getTime() > date.getTime());
  const boundary =
    next ?? new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, MORNING_FROM);
  return boundary.getTime() - date.getTime();
}

const WORD: Record<DayPart, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export function formatGreeting(part: DayPart, name: string): string {
  const trimmed = name.trim();
  return trimmed ? `${WORD[part]}, ${trimmed}` : `Good ${part}`;
}
