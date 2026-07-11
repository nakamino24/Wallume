import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';

const TYPES = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'e_wallet', label: 'E-Wallet' },
  { id: 'savings', label: 'Savings' },
  { id: 'investment', label: 'Investment' },
];

export default function NewWallet() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Enter a wallet name'); return; }
    setLoading(true);
    try {
      await api.createWallet({
        name: name.trim(), type,
        balance: parseFloat(balance) || 0,
        currency: user?.currency || 'USD',
      });
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity testID="new-wallet-back" onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>New wallet</H2>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Input testID="wallet-name" label="Name" value={name} onChangeText={setName} placeholder="Main Bank, Cash, Visa…" />
            <Label>Type</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {TYPES.map((t) => (
                <Chip key={t.id} testID={`wtype-${t.id}`} label={t.label} active={type === t.id} onPress={() => setType(t.id)} />
              ))}
            </ScrollView>
            <Input testID="wallet-balance" label="Starting balance" keyboardType="decimal-pad" value={balance} onChangeText={setBalance} placeholder="0" />
            {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
            <Button testID="wallet-save" label="Add wallet" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
