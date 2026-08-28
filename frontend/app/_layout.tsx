import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider';
import { BalancePrivacyProvider } from '@/src/privacy/BalancePrivacyProvider';
import { ReportPeriodProvider } from '@/src/hooks/use-report-period';
import { AuthProvider } from '@/src/auth/AuthProvider';
import { AppLockGate } from '@/src/auth/AppLockGate';
import { AppErrorBoundary } from '@/src/components/ErrorBoundary';
import { ToastProvider } from '@/src/components/Toast';
import { I18nProvider, useI18n } from '@/src/lib/I18nProvider';

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
  Inter: Inter_400Regular,
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_700Bold,
};

function BottomSheetGate({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') return <>{children}</>;
  return <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
}

export default function RootLayout() {
  const [iconsLoaded, iconsErr] = useIconFonts();
  const [fontsLoaded, fontsErr] = useFonts(CUSTOM_FONTS);

  return (
    <I18nProvider>
      <InitializedRoot iconsLoaded={iconsLoaded} iconsErr={iconsErr} fontsLoaded={fontsLoaded} fontsErr={fontsErr} />
    </I18nProvider>
  );
}

function InitializedRoot({ iconsLoaded, iconsErr, fontsLoaded, fontsErr }: {
  iconsLoaded: boolean;
  iconsErr: Error | null;
  fontsLoaded: boolean;
  fontsErr: Error | null;
}) {
  const { ready: localeReady } = useI18n();
  const ready = (iconsLoaded || iconsErr) && fontsLoaded && localeReady;

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
            <BalancePrivacyProvider>
              <ReportPeriodProvider>
                <AuthProvider>
                  <ToastProvider>
                    <AppLockGate>
                      <BottomSheetGate>
                        <StackWithTheme />
                      </BottomSheetGate>
                    </AppLockGate>
                  </ToastProvider>
                </AuthProvider>
              </ReportPeriodProvider>
            </BalancePrivacyProvider>
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
