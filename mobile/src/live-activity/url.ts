import * as Linking from 'expo-linking';

export type WorkoutLogLink = {
  planId: string;
  dayId: string;
  exerciseId?: string;
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function workoutLogUrl(link: { planId: string; dayId: string; exerciseId: string }): string {
  return Linking.createURL('/log', {
    queryParams: {
      planId: link.planId,
      dayId: link.dayId,
      exerciseId: link.exerciseId,
    },
  });
}

export function workoutLogHref(link: WorkoutLogLink & { start?: boolean }): `/log?${string}` {
  const params = new URLSearchParams();
  params.set('planId', link.planId);
  params.set('dayId', link.dayId);
  if (link.exerciseId) {
    params.set('exerciseId', link.exerciseId);
  }
  // Start tapped (Home, day preview): the log plays its start moment. Resume and Live
  // Activity links never carry it.
  if (link.start) {
    params.set('start', '1');
  }
  return `/log?${params.toString()}`;
}

export function parseWorkoutLogUrl(url: string): WorkoutLogLink | null {
  const parsed = Linking.parse(url);
  const parts = [parsed.hostname, parsed.path]
    .flatMap((value) => (value ?? '').split('/'))
    .filter((part) => part.length > 0);
  // Live Activity / scheme URLs may be scratchworkout:///log or …/--/log
  if (!parts.includes('log')) {
    return null;
  }
  const planId = firstQueryValue(parsed.queryParams?.planId);
  const dayId = firstQueryValue(parsed.queryParams?.dayId);
  const exerciseId = firstQueryValue(parsed.queryParams?.exerciseId);
  if (!planId || !dayId) {
    return null;
  }
  return { planId, dayId, exerciseId };
}
