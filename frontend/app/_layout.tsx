import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeProvider';
import { AuthProvider } from '@/src/auth/AuthProvider';

LogBox.ignoreAllLogs(true);
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

// Fontsource TTF via jsDelivr — works cross-platform, no local assets needed.
const FS = 'https://cdn.jsdelivr.net/fontsource/fonts';
const CUSTOM_FONTS = {
  SpaceGrotesk: `${FS}/space-grotesk@latest/latin-400-normal.ttf`,
  'SpaceGrotesk-Medium': `${FS}/space-grotesk@latest/latin-500-normal.ttf`,
  'SpaceGrotesk-Bold': `${FS}/space-grotesk@latest/latin-700-normal.ttf`,
  PlusJakarta: `${FS}/plus-jakarta-sans@latest/latin-400-normal.ttf`,
  'PlusJakarta-Medium': `${FS}/plus-jakarta-sans@latest/latin-500-normal.ttf`,
  'PlusJakarta-SemiBold': `${FS}/plus-jakarta-sans@latest/latin-600-normal.ttf`,
};

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
            <BottomSheetModalProvider>
              <StackWithTheme />
            </BottomSheetModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
