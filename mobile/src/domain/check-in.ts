import { newId } from '@/domain/id';

export type BodyCheckIn = {
  id: string;
  recordedAt: string;
  bodyweightKg?: number;
  waistCm?: number;
  shouldersCm?: number;
  chestCm?: number;
  neckCm?: number;
  upperArmLeftCm?: number;
  upperArmRightCm?: number;
  forearmLeftCm?: number;
  forearmRightCm?: number;
  hipCm?: number;
  thighLeftCm?: number;
  thighRightCm?: number;
  calfLeftCm?: number;
  calfRightCm?: number;
};

export type BodyMetricKey = keyof Omit<BodyCheckIn, 'id' | 'recordedAt'>;

export const BODY_METRICS: { key: BodyMetricKey; label: string }[] = [
  { key: 'bodyweightKg', label: 'Weight' },
  { key: 'waistCm', label: 'Waist' },
  { key: 'shouldersCm', label: 'Shoulders' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'neckCm', label: 'Neck' },
  { key: 'upperArmLeftCm', label: 'Upper arm left' },
  { key: 'upperArmRightCm', label: 'Upper arm right' },
  { key: 'forearmLeftCm', label: 'Forearm left' },
  { key: 'forearmRightCm', label: 'Forearm right' },
  { key: 'hipCm', label: 'Hip' },
  { key: 'thighLeftCm', label: 'Thigh left' },
  { key: 'thighRightCm', label: 'Thigh right' },
  { key: 'calfLeftCm', label: 'Calf left' },
  { key: 'calfRightCm', label: 'Calf right' },
];

export type WeightUnits = 'kg' | 'lbs';

const KG_PER_LB = 0.45359237;

/** Bodyweight is stored in kg (`bodyweightKg`); lbs users type and read pounds. */
export function bodyweightForDisplay(kg: number, units: WeightUnits): number {
  const value = units === 'lbs' ? kg / KG_PER_LB : kg;
  return Math.round(value * 10) / 10;
}

export function bodyweightToKg(value: number, units: WeightUnits): number {
  return units === 'lbs' ? Math.round(value * KG_PER_LB * 100) / 100 : value;
}

/** Convert a stored metric value to the unit the user reads (only bodyweight changes). */
export function bodyMetricForDisplay(
  key: BodyMetricKey,
  value: number,
  units: WeightUnits,
): number {
  return key === 'bodyweightKg' ? bodyweightForDisplay(value, units) : value;
}

export type CheckInMetric = { key: BodyMetricKey; label: string; unit: WeightUnits | 'cm' };

/** Fields shown in the check-in sheet (bodyweight first, then circumferences). */
export function checkInMetrics(units: WeightUnits): CheckInMetric[] {
  return BODY_METRICS.map((metric) => ({
    ...metric,
    unit: metric.key === 'bodyweightKg' ? units : 'cm',
  }));
}

/** @deprecated Use `checkInMetrics(units)`; this assumes kg. */
export const CHECK_IN_METRICS: CheckInMetric[] = checkInMetrics('kg');

/** Progress index keeps a short primary set; limb pairs live in check-in + detail. */
export const PROGRESS_INDEX_BODY_METRICS = BODY_METRICS.filter((metric) =>
  (
    [
      'bodyweightKg',
      'waistCm',
      'shouldersCm',
      'chestCm',
      'hipCm',
    ] as BodyMetricKey[]
  ).includes(metric.key),
);

export function emptyCheckInDraft(): Omit<BodyCheckIn, 'id'> {
  return {
    recordedAt: new Date().toISOString(),
  };
}

export function newCheckIn(input: Partial<Omit<BodyCheckIn, 'id'>> = {}): BodyCheckIn {
  return {
    id: newId(),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    ...input,
  };
}

/** Legacy single-thigh key from earlier builds. */
export function migrateLegacyThigh(checkIn: BodyCheckIn & { thighCm?: number }): BodyCheckIn {
  if (checkIn.thighCm == null) {
    return checkIn;
  }
  const { thighCm, ...rest } = checkIn;
  return {
    ...rest,
    thighLeftCm: rest.thighLeftCm ?? thighCm,
    thighRightCm: rest.thighRightCm ?? thighCm,
  };
}
