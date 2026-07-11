import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font } from '@/src/theme/tokens';
import { Screen, H1, Body, Button, Input } from '@/src/components/ui';

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
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
            <H1>Start your financial journey.</H1>
            <Body muted style={{ marginTop: 8, marginBottom: spacing.xl }}>
              Sign up in 30 seconds. No credit card.
            </Body>

            <Input testID="signup-name" label="Name" value={name} onChangeText={setName} placeholder="Your name" />
            <Input testID="signup-email" label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
            <Input testID="signup-password" label="Password" secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 6 characters" />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="signup-submit" label="Create account" onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
              <Body muted>Already have an account? </Body>
              <TouchableOpacity testID="signup-goto-login" onPress={() => router.replace('/(auth)/login')}>
                <Body style={{ color: colors.brandPrimary, fontFamily: font.textBold }}>Sign in</Body>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
