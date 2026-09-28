// Dates in the app's copy. Trim's copy is English, so month and weekday names are pinned to
// en-US and dates are built from parts in English order (`Sep 25`, `Fri 25`). A locale format
// (`toLocaleDateString(undefined, …)`) would read `25. Sep` or `Sept` on a German-region phone.
// Clock times are the exception: they keep the region's 12h/24h preference.

/** `Sep`, `Oct`. */
export function monthShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

/** `September`. */
export function monthLong(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long' });
}

/** `Fri`. */
export function weekdayShort(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/** `Friday`. */
export function weekdayLong(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/** `Sep 25`, or `Sep 25, 2025` outside the current year. */
export function formatMonthDay(date: Date, now: Date = new Date()): string {
  const label = `${monthShort(date)} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label}, ${date.getFullYear()}`;
}

/** `Fri 25`: for places where the month is already clear. */
export function formatWeekdayDay(date: Date): string {
  return `${weekdayShort(date)} ${date.getDate()}`;
}
