import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Button, Body, Label, Chip, Input } from '@/src/components/ui';
import { useToast } from '@/src/components/Toast';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { useWallets, invalidateWalletsCache } from '@/src/hooks/use-wallets';
import { invalidateTransactionsCache } from '@/src/hooks/use-transactions';
import { storage } from '@/src/utils/storage';
import { DateField } from '@/src/components/DateField';
import { CategorySelector } from '@/src/components/CategorySelector';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { todayLocalISO } from '@/src/utils/dates';

export default function NewTransaction() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { getOptions } = useUserCategories();
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>((params.type as any) || 'expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const { wallets, loading: walletsLoading, error: walletsError, refresh: refreshWallets } = useWallets();
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [date, setDate] = useState(() => todayLocalISO());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Auto-select first wallets when cache populates
  useEffect(() => {
    if (wallets.length > 0) {
      if (!walletId && wallets[0]) setWalletId(wallets[0].id);
      if (!toWalletId && wallets[1]) setToWalletId(wallets[1].id);
    }
  }, [wallets, walletId, toWalletId]);

  useEffect(() => {
    setCategory(getOptions(type === 'transfer' ? 'expense' : type)[0]);
  }, [type]);

  const submit = async () => {
    setErr('');
    const errors: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) errors.amount = 'Enter a valid amount';
    if (!walletId) errors.wallet = 'Select a wallet';
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) errors.toWallet = 'Select a different wallet';
    if (Object.keys(errors).length > 0) {
      setErr(Object.values(errors)[0]);
      return;
    }
    setLoading(true);
    try {
      await api.createTransaction({
        wallet_id: walletId,
        to_wallet_id: type === 'transfer' ? toWalletId : undefined,
        type, amount: amt, category, note, date: date || undefined,
      });
      invalidateWalletsCache();
      invalidateTransactionsCache();
      await storage.removeItem('mf.home.cache.v1');
      toast.show(`${type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'} added`, 'success');
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const cur = user?.currency || 'USD';

  return (
    <FormLayout title="New transaction" onBack={() => router.back()}>

      {/* Type selector */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl }}>
              {(['expense', 'income', 'transfer'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  testID={`type-${t}`}
                  onPress={() => setType(t)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    backgroundColor: type === t
                      ? (t === 'income' ? colors.success : t === 'expense' ? colors.error : colors.brandPrimary)
                      : 'transparent',
                  }}
                >
                  <Body style={{
                    color: type === t ? '#fff' : colors.onSurface2,
                    fontFamily: font.textBold,
                    textTransform: 'capitalize',
                  }}>{t}</Body>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount */}
            <View style={{ alignSelf: 'stretch', marginBottom: spacing.xl }}>
              <MoneyInput
                testID="tx-amount"
                label="Amount"
                variant="hero"
                symbol={currencySymbol(cur)}
                value={amount}
                onChange={setAmount}
                autoFocus
              />
            </View>

            {/* Date */}
            <DateField testID="tx-date" label="Date" value={date} onChange={setDate} />

            {/* Category */}
            <CategorySelector type={type} value={category} onChange={setCategory} testID="tx" />

            {/* Wallet */}
            <Label style={{ marginTop: spacing.md }}>{type === 'transfer' ? 'From' : 'Wallet'}</Label>
            {walletsLoading ? (
              <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <Body muted>Loading wallets…</Body>
              </View>
            ) : walletsError ? (
              <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
                <Body style={{ color: colors.error }}>{walletsError}</Body>
                <Button label="Retry" onPress={refreshWallets} />
              </View>
            ) : wallets.length === 0 ? (
              <View style={{ paddingVertical: spacing.md }}>
                <Body muted>No wallets found. Add one first.</Body>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                {wallets.map((w) => (
                  <Chip key={w.id} testID={`wallet-from-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />
                ))}
              </ScrollView>
            )}

            {type === 'transfer' && (
              <>
                <Label style={{ marginTop: spacing.md }}>To</Label>
                {walletsLoading ? (
                  <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                    <Body muted>Loading wallets…</Body>
                  </View>
                ) : walletsError ? (
                  <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
                    <Body style={{ color: colors.error }}>{walletsError}</Body>
                    <Button label="Retry" onPress={refreshWallets} />
                  </View>
                ) : wallets.length === 0 ? (
                  <View style={{ paddingVertical: spacing.md }}>
                    <Body muted>No wallets found.</Body>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                    {wallets.map((w) => (
                      <Chip key={w.id} testID={`wallet-to-${w.id}`} label={w.name} active={toWalletId === w.id} onPress={() => setToWalletId(w.id)} />
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <Input testID="tx-note" label="Note (optional)" value={note} onChangeText={setNote} placeholder="Coffee, groceries…" />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="tx-save" label="Save transaction" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
