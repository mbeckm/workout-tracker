/** Regions that weigh gym loads in pounds. Everyone else defaults to kilograms. */
const POUND_REGIONS = new Set(['US', 'LR', 'MM']);

function deviceRegion(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale
      .split(/[-_]/)
      .slice(1)
      .find((part) => /^[A-Z]{2}$/.test(part));
    return region ?? null;
  } catch {
    return null;
  }
}

/** The unit to preselect on the Units step, from the device locale's region. */
export function localeUnits(): 'kg' | 'lbs' {
  const region = deviceRegion();
  return region && POUND_REGIONS.has(region) ? 'lbs' : 'kg';
}
