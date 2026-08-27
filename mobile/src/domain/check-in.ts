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

/** Fields shown in the check-in sheet (bodyweight first, then circumferences). */
export const CHECK_IN_METRICS: { key: BodyMetricKey; label: string; unit: 'kg' | 'cm' }[] =
  BODY_METRICS.map((metric) => ({
    ...metric,
    unit: metric.key === 'bodyweightKg' ? 'kg' : 'cm',
  }));

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
