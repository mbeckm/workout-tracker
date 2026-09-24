import { useLocalSearchParams } from 'expo-router';

import { parseProReason } from '@/purchases/pro-gate';
import { PaywallScreen } from '@/screens/paywall';

export default function PaywallRoute() {
  const params = useLocalSearchParams<{ reason?: string | string[]; session?: string | string[] }>();
  const session = Array.isArray(params.session) ? params.session[0] : params.session;
  return <PaywallScreen reason={parseProReason(params.reason)} session={session} />;
}
