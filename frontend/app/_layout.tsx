import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider';
import { AuthProvider } from '@/src/auth/AuthProvider';
import { AppLockGate } from '@/src/auth/AppLockGate';
import { AppErrorBoundary } from '@/src/components/ErrorBoundary';
import { ToastProvider } from '@/src/components/Toast';

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

const CUSTOM_FONTS = {
  Fraunces: Fraunces_400Regular,
  'Fraunces-Medium': Fraunces_500Medium,
  'Fraunces-SemiBold': Fraunces_600SemiBold,
  Inter: Inter_400Regular,
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
};

function BottomSheetGate({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') return <>{children}</>;
  return <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
}

export default function RootLayout() {
  const [iconsLoaded, iconsErr] = useIconFonts();
  const [fontsLoaded, fontsErr] = useFonts(CUSTOM_FONTS);

  const ready = (iconsLoaded || iconsErr) && fontsLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppErrorBoundary>
              <SplashScreenHolder error={iconsErr || fontsErr} />
            </AppErrorBoundary>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppLockGate>
                  <BottomSheetGate>
                    <StackWithTheme />
                  </BottomSheetGate>
                </AppLockGate>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

// The system splash is still visible at this point; returning an empty view keeps
// the native splash on screen (it will be hidden once `ready` flips true). This
// branch exists purely to satisfy the requirement that a mounted component tree
// exists while initialization completes.
function SplashScreenHolder({ error }: { error: Error | null }) {
  if (error) throw error;
  return null;
}
