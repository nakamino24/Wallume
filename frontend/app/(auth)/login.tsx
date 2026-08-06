import React, { useState } from 'react';
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

export default function Login() {
  const { colors } = useTheme();
  const { login, loginWithEmergentToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { setErr('Please enter email and password'); return; }
    setLoading(true); setErr('');
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setErr(e.message || 'Login failed');
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
        if (!sid) { setErr('Login was cancelled'); return; }
        await loginWithEmergentToken(sid);
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      setErr(e.message || 'Google sign-in failed');
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
                <Body style={{ color: '#FFFFFF', fontFamily: font.displayBold, fontSize: 20, fontWeight: '600', letterSpacing: -0.5 }}>W</Body>
              </View>
              <Body style={{ fontFamily: font.displayBold, fontSize: scale(24), color: colors.onSurface, fontWeight: '600', letterSpacing: -0.3 }}>
                Welcome back.
              </Body>
              <Body muted style={{ marginTop: spacing.xs, fontSize: font.sizes.base }}>Sign in to Wallume</Body>
            </View>

            <Input
              testID="login-email"
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => {}}
            />
            <Input
              testID="login-password"
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md, fontSize: font.sizes.sm }}>{err}</Body>}

            <Button testID="login-submit" label="Sign in" onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Body muted style={{ marginHorizontal: spacing.md, fontSize: font.sizes.sm }}>or</Body>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <Button
              testID="login-google"
              variant="secondary"
              label={googleLoading ? 'Connecting\u2026' : 'Continue with Google'}
              onPress={googleLogin}
              loading={googleLoading}
              icon={<Ionicons name="logo-google" size={16} color={colors.onSurface} />}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl }}>
              <Body muted style={{ fontSize: font.sizes.sm }}>New here? </Body>
              <TouchableOpacity testID="login-goto-signup" onPress={() => router.push('/(auth)/signup')}>
                <Body style={{ color: colors.brandPrimary, fontFamily: font.textMedium, fontSize: font.sizes.sm, fontWeight: '500' }}>Create account</Body>
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