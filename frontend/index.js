// Entry point for expo-router must be the very first thing evaluated.
require('expo-router/entry');

// The home-screen widget feature uses react-native-android-widget, which requires
// a custom dev client (its AndroidWidget TurboModule is NOT present in Expo Go).
// Importing it statically throws at bundle-evaluation time on Expo Go and blanks
// the whole app before React mounts. So we only touch the package lazily, and
// only on runtimes where it is actually supported (real Android dev/prod builds).
import { isWidgetSupported } from './src/widgets/expo-env';

if (isWidgetSupported) {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./src/widgets/widget-task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (e) {
    // Widget task registration must never take down the app. Log and continue.
    console.warn('[widgets] widget task handler registration skipped:', e);
  }
}