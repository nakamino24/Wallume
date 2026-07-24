import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as LinkingExpo from 'expo-linking';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { font, spacing } from '@/src/theme/tokens';
import { Screen, H1, Body, Button, Input } from '@/src/components/ui';

export default function Login() {
  const { colors, mode } = useTheme();
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
      <LinearGradient
        colors={mode === 'dark'
          ? ['rgba(16,185,129,0.08)', 'transparent']
          : ['rgba(16,185,129,0.06)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: spacing.xxl }}>
              <View style={[styles.logoBadge, { backgroundColor: colors.brandPrimary }]}>
                <View style={styles.logoInner}>
                  <Body style={{ color: colors.onBrand, fontFamily: font.displayBold, fontSize: 22, lineHeight: 26, letterSpacing: -1 }}>W</Body>
                </View>
              </View>
              <H1>Welcome back.</H1>
              <Body style={{ marginTop: 8 }} muted>Sign in to Wallume</Body>
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
            />
            <Input
              testID="login-password"
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="login-submit" label="Sign in" onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Body muted style={{ marginHorizontal: spacing.md }}>or</Body>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <Button
              testID="login-google"
              variant="secondary"
              label={googleLoading ? 'Connecting\u2026' : 'Continue with Google'}
              onPress={googleLogin}
              loading={googleLoading}
              icon={<Ionicons name="logo-google" size={18} color={colors.onSurface} />}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
              <Body muted>New here? </Body>
              <TouchableOpacity testID="login-goto-signup" onPress={() => router.push('/(auth)/signup')}>
                <Body style={{ color: colors.brandPrimary, fontFamily: font.textBold }}>Create account</Body>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1 },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
