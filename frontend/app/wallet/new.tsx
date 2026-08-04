import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';

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
    <FormLayout title="New wallet" onBack={() => router.back()}>
      <Input testID="wallet-name" label="Name" value={name} onChangeText={setName} placeholder="Main Bank, Cash, Visa…" />
      <Label>Type</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {TYPES.map((t) => (
          <Chip key={t.id} testID={`wtype-${t.id}`} label={t.label} active={type === t.id} onPress={() => setType(t.id)} />
        ))}
      </ScrollView>
      <MoneyInput testID="wallet-balance" label="Starting balance" value={balance} onChange={setBalance} placeholder="0" />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="wallet-save" label="Add wallet" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
