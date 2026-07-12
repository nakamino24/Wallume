// Cross-platform confirm helper.
// Alert.alert with multiple buttons is a no-op on react-native-web, so we
// fall back to window.confirm on web and use Alert on native.
import { Alert, Platform } from 'react-native';

export function confirmAction(
  title: string,
  message: string | undefined,
  onConfirm: () => void | Promise<void>,
  opts: { confirmLabel?: string; destructive?: boolean } = {},
) {
  const { confirmLabel = 'Confirm', destructive = false } = opts;
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined'
      ? window.confirm(message ? `${title}\n\n${message}` : title)
      : true;
    if (ok) Promise.resolve(onConfirm());
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => { Promise.resolve(onConfirm()); } },
  ]);
}
