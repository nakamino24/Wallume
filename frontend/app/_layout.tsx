import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider';
import { AuthProvider } from '@/src/auth/AuthProvider';
import { AppLockGate } from '@/src/auth/AppLockGate';
import { AppErrorBoundary } from '@/src/components/ErrorBoundary';

if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = ((...args: Parameters<typeof console.warn>) => {
    const [firstArg] = args;
    const message = typeof firstArg === 'string'
      ? firstArg
      : firstArg instanceof Error
        ? firstArg.message
        : '';

    if (message.includes('props.pointerEvents is deprecated') || message.includes('Cannot record touch end without a touch start')) {
      return;
    }

    originalWarn(...args);
  }) as typeof console.warn;
}

LogBox.ignoreAllLogs(true);
LogBox.ignoreLogs(['props.pointerEvents is deprecated', 'Cannot record touch end without a touch start']);
SplashScreen.preventAutoHideAsync();

function StackWithTheme() {
  const { mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
    </>
  );
}

const LOCAL_FONT = require('../assets/fonts/SpaceMono-Regular.ttf');
const CUSTOM_FONTS = {
  SpaceGrotesk: LOCAL_FONT,
  'SpaceGrotesk-Medium': LOCAL_FONT,
  'SpaceGrotesk-Bold': LOCAL_FONT,
  PlusJakarta: LOCAL_FONT,
  'PlusJakarta-Medium': LOCAL_FONT,
  'PlusJakarta-SemiBold': LOCAL_FONT,
};

function BottomSheetGate({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') return <>{children}</>;
  return <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
}

export default function RootLayout() {
  const [iconsLoaded, iconsErr] = useIconFonts();
  const [fontsLoaded, fontsErr] = useFonts(CUSTOM_FONTS);

  // Don't block the app on custom Google font fetch failures — fall through to system font.
  const ready = (iconsLoaded || iconsErr) && (fontsLoaded || fontsErr);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppErrorBoundary>
              <AppLockGate>
                <BottomSheetGate>
                  <StackWithTheme />
                </BottomSheetGate>
              </AppLockGate>
            </AppErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
