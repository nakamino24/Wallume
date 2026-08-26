import React, { useCallback, useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip, Card } from '@/src/components/ui';
import { confirmAction } from '@/src/utils/confirm';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { MoneyValue } from '@/src/components/MoneyValue';

const TYPES = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'e_wallet', label: 'E-Wallet' },
  { id: 'savings', label: 'Savings' },
  { id: 'investment', label: 'Investment' },
];

export default function EditWallet() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [wallet, setWallet] = useState<any>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await api.wallets();
    const w = (r.wallets || []).find((x: any) => x.id === id);
    if (w) {
      setWallet(w);
      setName(w.name);
      setType(w.type);
      setBalance(String(w.balance ?? 0));
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Enter a wallet name'); return; }
    if (balance.trim() === '') { setErr('Enter a balance (use 0 for empty)'); return; }
    const parsed = parseFloat(balance);
    if (Number.isNaN(parsed)) { setErr('Balance must be a number'); return; }
    setLoading(true);
    try {
      await api.updateWallet(id!, {
        name: name.trim(),
        type,
        balance: parsed,
      });
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const remove = () => {
    confirmAction(
      'Delete wallet?',
      'This also deletes all transactions in this wallet.',
      async () => { await api.deleteWallet(id!); router.back(); },
      { confirmLabel: 'Delete', destructive: true },
    );
  };

  if (!wallet) {
    return <FormLayout title="Edit wallet"><Body style={{ padding: spacing.xl }}>Loading…</Body></FormLayout>;
  }

  const cur = user?.currency || 'USD';

  return (
    <FormLayout title="Edit wallet" onBack={() => router.back()}
      headerRight={
        <TouchableOpacity testID="edit-wallet-delete" onPress={remove} style={{ padding: 8 }}>
          <Ionicons name="trash" size={20} color={colors.error} />
        </TouchableOpacity>
      }>
      <Card style={{ marginBottom: spacing.md }}>
        <Label>Current balance</Label>
        <MoneyValue value={wallet.converted_balance ?? (wallet.balance || 0)} currency={wallet.home_currency || cur} privacy="financial" style={{ fontSize: scale(24), fontFamily: font.displayBold, marginTop: 4 }} />
      </Card>

      <Input testID="edit-wallet-name" label="Name" value={name} onChangeText={setName} placeholder="Main Bank" />

      <Label>Type</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {TYPES.map((t) => (
          <Chip key={t.id} testID={`edit-wtype-${t.id}`} label={t.label} active={type === t.id} onPress={() => setType(t.id)} />
        ))}
      </ScrollView>

      <MoneyInput testID="edit-wallet-balance" label="Balance" value={balance} onChange={setBalance} placeholder="0" />
      <Body muted style={{ fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md }}>
        Manually set the balance. This does not create a transaction.
      </Body>

      {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

      <Button testID="edit-wallet-save" label="Save changes" onPress={submit} loading={loading} />
    </FormLayout>
  );
}
