import { useLocalSearchParams } from 'expo-router';

import { BodyGoalSheetScreen } from '@/screens/body-goal-sheet';
import { GoalSheetScreen } from '@/screens/goal-sheet';

/** One goal sheet route: `name` for a lift, `metric` for a body measurement. */
export default function GoalRoute() {
  const { metric } = useLocalSearchParams<{ metric?: string }>();
  return metric ? <BodyGoalSheetScreen /> : <GoalSheetScreen />;
}
