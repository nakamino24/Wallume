import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { Body, H2, Button } from '@/src/components/ui';
import { storage } from '@/src/utils/storage';
import { useAuth } from '@/src/auth/AuthProvider';
import { useI18n } from '@/src/lib/I18nProvider';

export const BIOMETRIC_LOCK_KEY = 'mf.biometricLockEnabled';

export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await storage.secureGet<boolean>(BIOMETRIC_LOCK_KEY, false)) ?? false;
}
export async function setBiometricLockEnabled(v: boolean) {
  await storage.secureSet(BIOMETRIC_LOCK_KEY, v);
}
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

// Gates its children behind a Face ID / fingerprint / device passcode prompt.
// Re-locks whenever the app comes back from the background, not just on cold start —
// that's the behavior people actually expect from a "lock my finance app" toggle.
export function AppLockGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const [lockEnabled, setLockEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const appState = useRef(AppState.currentState);

  const attemptUnlock = useCallback(async () => {
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('applock.prompt'),
        fallbackLabel: t('applock.passcode'),
        disableDeviceFallback: false,
      });
      if (result.success) setUnlocked(true);
    } finally {
      setAuthenticating(false);
    }
  }, [t]);

  // Initial check on mount / when the signed-in user changes.
  useEffect(() => {
    (async () => {
      setChecking(true);
      const enabled = user ? await isBiometricLockEnabled() : false;
      setLockEnabled(enabled);
      setUnlocked(!enabled);
      setChecking(false);
      if (enabled) attemptUnlock();
    })();
  }, [user?.user_id, attemptUnlock]);

  // Re-lock on returning from background — this is the part a naive
  // "check once on launch" implementation always forgets.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active' && lockEnabled) {
        setUnlocked(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [lockEnabled]);

  useEffect(() => {
    if (lockEnabled && !unlocked && !checking && !authenticating) {
      // Re-trigger the prompt automatically once we land back on the lock screen.
      attemptUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, lockEnabled, checking]);

  if (checking) return null;
  if (unlocked) return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
        <Ionicons name="lock-closed" size={30} color={colors.onBrandSoft} />
      </View>
      <H2>{t('applock.title')}</H2>
      <Body muted style={{ marginTop: 6, marginBottom: spacing.xl, textAlign: 'center' }}>
        {t('applock.subtitle')}
      </Body>
      <Button testID="applock-unlock-btn" label={authenticating ? t('applock.waiting') : t('applock.unlock')} onPress={attemptUnlock} loading={authenticating} />
    </View>
  );
}
