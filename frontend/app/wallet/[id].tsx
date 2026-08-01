import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, formatMoneyFull } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip, Card } from '@/src/components/ui';
import { confirmAction } from '@/src/utils/confirm';

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
    return <Screen><SafeAreaView><Body style={{ padding: spacing.xl }}>Loading…</Body></SafeAreaView></Screen>;
  }

  const cur = user?.currency || 'USD';

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity testID="edit-wallet-back" onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md, flex: 1 }}>Edit wallet</H2>
            <TouchableOpacity testID="edit-wallet-delete" onPress={remove}>
              <Ionicons name="trash" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
            <Card style={{ marginBottom: spacing.md }}>
              <Label>Current balance</Label>
              <Body style={{ fontSize: 24, fontFamily: 'SpaceGrotesk-Bold', marginTop: 4 }}>
                {formatMoneyFull(wallet.converted_balance ?? (wallet.balance || 0), wallet.home_currency || cur)}
              </Body>
            </Card>

            <Input testID="edit-wallet-name" label="Name" value={name} onChangeText={setName} placeholder="Main Bank" />

            <Label>Type</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {TYPES.map((t) => (
                <Chip key={t.id} testID={`edit-wtype-${t.id}`} label={t.label} active={type === t.id} onPress={() => setType(t.id)} />
              ))}
            </ScrollView>

            <Input
              testID="edit-wallet-balance"
              label="Balance"
              keyboardType="decimal-pad"
              value={balance}
              onChangeText={setBalance}
              placeholder="0"
            />
            <Body muted style={{ fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md }}>
              Manually set the balance. This does not create a transaction.
            </Body>

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="edit-wallet-save" label="Save changes" onPress={submit} loading={loading} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
