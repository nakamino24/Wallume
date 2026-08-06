import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { Screen, Body, Button, Input } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';

export default function Signup() {
  const { colors } = useTheme();
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !email || !password) { setErr('Please fill all fields'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password)) { setErr('Password must contain an uppercase letter'); return; }
    if (!/[0-9]/.test(password)) { setErr('Password must contain a number'); return; }
    setLoading(true); setErr('');
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setErr(e.message || 'Signup failed');
    } finally { setLoading(false); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ marginBottom: spacing.xxl }}>
              <View style={[{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }]}>
                <Body style={{ color: '#FFFFFF', fontFamily: font.displayBold, fontSize: 20, fontWeight: '600', letterSpacing: -0.5 }}>W</Body>
              </View>
              <Body style={{ fontFamily: font.displayBold, fontSize: scale(24), color: colors.onSurface, fontWeight: '600', letterSpacing: -0.3 }}>
                Create your account.
              </Body>
              <Body muted style={{ marginTop: spacing.xs }}>Start tracking your finances in seconds.</Body>
            </View>

            <Input testID="signup-name" label="Name" value={name} onChangeText={setName} placeholder="Your name" />
            <Input testID="signup-email" label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
            <Input testID="signup-password" label="Password" secureTextEntry value={password} onChangeText={setPassword} placeholder="Min 8 chars, 1 uppercase, 1 number" />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md, fontSize: font.sizes.sm }}>{err}</Body>}

            <Button testID="signup-submit" label="Create account" onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl }}>
              <Body muted style={{ fontSize: font.sizes.sm }}>Already have an account? </Body>
              <TouchableOpacity testID="signup-goto-login" onPress={() => router.replace('/(auth)/login')}>
                <Body style={{ color: colors.brandPrimary, fontFamily: font.textMedium, fontSize: font.sizes.sm, fontWeight: '500' }}>Sign in</Body>
              </TouchableOpacity>
            </View>
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
