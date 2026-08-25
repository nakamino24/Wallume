import Constants from 'expo-constants';

import { Caption } from '@/src/components/ui';

export function AppVersion() {
  const version = Constants.expoConfig?.version ?? Constants.nativeApplicationVersion ?? '—';
  return <Caption testID="app-version">Wallume v{version}</Caption>;
}
