import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as LinkingExpo from 'expo-linking';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { font, spacing } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { Screen, Body, Button, Input } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { WallumeMark } from '@/src/components/WallumeMark';
import { useI18n } from '@/src/lib/I18nProvider';
import {
  consumePasswordRecoverySuccess,
  hasPasswordRecoverySuccess,
} from '@/src/auth/password-recovery-state';

export default function Login() {
  const { colors } = useTheme();
  const { login, loginWithEmergentToken } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSucceeded] = useState(() => hasPasswordRecoverySuccess());

  useEffect(() => {
    if (resetSucceeded) consumePasswordRecoverySuccess();
  }, [resetSucceeded]);

  const submit = async () => {
    if (!email || !password) { setErr(t('auth.validation.required')); return; }
    setLoading(true); setErr('');
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      const status = e?.status;
      const msg = String(e?.detail || e?.message || '').toLowerCase();
      if (status === 401 || msg.includes('invalid credentials')) setErr(t('auth.error.invalidCredentials'));
      else if (status === 429) setErr(t('auth.error.rateLimited'));
      else if (status >= 500) setErr(t('auth.error.server'));
      else if (!status || msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) setErr(t('auth.error.network'));
      else setErr(t('auth.error.login'));
    } finally { setLoading(false); }
  };

  const googleLogin = async () => {
    setGoogleLoading(true); setErr('');
    try {
      const redirectUrl = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin + '/' : '')
        : LinkingExpo.createURL('');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const url = result.url;
        const hashIdx = url.indexOf('#');
        const qIdx = url.indexOf('?');
        let params = new URLSearchParams();
        if (hashIdx >= 0) params = new URLSearchParams(url.substring(hashIdx + 1));
        else if (qIdx >= 0) params = new URLSearchParams(url.substring(qIdx + 1));
        const sid = params.get('session_id');
        if (!sid) { setErr(t('auth.login.cancelled')); return; }
        await loginWithEmergentToken(sid);
        router.replace('/(tabs)/home');
      }
    } catch {
      setErr(t('auth.error.google'));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ marginBottom: spacing.xxl }}>
              <View style={[styles.logoBadge, { backgroundColor: colors.brand }]}>
                <WallumeMark size={28} color={colors.onBrand} />
              </View>
              <Body style={{ fontFamily: font.displayBold, fontSize: scale(24), color: colors.onSurface, fontWeight: '600', letterSpacing: -0.3 }}>
                {t('welcome.back')}
              </Body>
              <Body muted style={{ marginTop: spacing.xs, fontSize: font.sizes.base }}>{t('sign.in.to')}</Body>
            </View>

            <Input
              testID="login-email"
              label={t('email')}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.email.placeholder')}
              autoComplete="email"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => {}}
            />
            <Input
              testID="login-password"
              label={t('password')}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password.placeholder')}
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            <TouchableOpacity
              testID="login-forgot-password"
              accessibilityRole="button"
              onPress={() => router.push('/(auth)/forgot-password')}
              style={{ alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.md }}
            >
              <Body style={{ color: colors.brandPrimary, fontFamily: font.textMedium, fontSize: font.sizes.sm }}>
                {t('auth.forgot.link')}
              </Body>
            </TouchableOpacity>

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md, fontSize: font.sizes.sm }}>{err}</Body>}
            {resetSucceeded && (
              <Body testID="login-reset-success" style={{ color: colors.success, marginBottom: spacing.md, fontSize: font.sizes.sm }}>
                {t('auth.reset.success')}
              </Body>
            )}

            <Button testID="login-submit" label={t('sign.in')} onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Body muted style={{ marginHorizontal: spacing.md, fontSize: font.sizes.sm }}>{t('or')}</Body>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <Button
              testID="login-google"
              variant="secondary"
              label={googleLoading ? t('auth.connecting') : t('continue.google')}
              onPress={googleLogin}
              loading={googleLoading}
              icon={<Ionicons name="logo-google" size={16} color={colors.onSurface} />}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl }}>
              <Body muted style={{ fontSize: font.sizes.sm }}>{t('new.here')} </Body>
              <TouchableOpacity testID="login-goto-signup" onPress={() => router.push('/(auth)/signup')}>
                <Body style={{ color: colors.brandPrimary, fontFamily: font.textMedium, fontSize: font.sizes.sm, fontWeight: '500' }}>{t('create.account')}</Body>
              </TouchableOpacity>
            </View>
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1 },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
