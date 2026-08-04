import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// react-native-android-widget ships native (Android home-screen widget) code that
// calls TurboModuleRegistry.getEnforcing('AndroidWidget') at MODULE EVALUATION time.
// Expo Go does not bundle that native module, so merely importing the package
// throws during bundle init (before React mounts) -> blank screen. It only works
// in a custom dev client / production build. This flag lets callers avoid ever
// touching the package on unsupported runtimes (Expo Go).
export const isWidgetSupported: boolean =
  Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;