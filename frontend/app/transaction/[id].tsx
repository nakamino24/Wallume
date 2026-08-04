import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { CategorySelector } from '@/src/components/CategorySelector';

// Edit an existing transaction. The list screen (transactions.tsx) passes the
// transaction's fields in as route params, so we don't need a dedicated
// GET /transactions/{id} endpoint just to prefill this form.
export default function EditTransaction() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { getOptions, isKnown } = useUserCategories();
  const params = useLocalSearchParams<{
    id: string;
    wallet_id?: string;
    to_wallet_id?: string;
    type?: string;
    amount?: string;
    category?: string;
    note?: string;
    date?: string;
  }>();

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>((params.type as any) || 'expense');
  const [amount, setAmount] = useState(params.amount ? String(params.amount) : '');
  const [category, setCategory] = useState(params.category || 'Food');
  const [note, setNote] = useState(params.note || '');
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState(params.wallet_id || '');
  const [toWalletId, setToWalletId] = useState(params.to_wallet_id || '');
  const [date, setDate] = useState(params.date || new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await api.wallets();
    setWallets(r.wallets || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('Enter a valid amount'); return; }
    if (!walletId) { setErr('Select a wallet'); return; }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) { setErr('Select a different destination wallet'); return; }
    setLoading(true);
    try {
      await api.updateTransaction(params.id, {
        wallet_id: walletId,
        to_wallet_id: type === 'transfer' ? toWalletId : undefined,
        type, amount: amt, category, note, date: date || undefined,
      });
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const cur = user?.currency || 'USD';

  return (
    <FormLayout title="Edit transaction" onBack={() => router.back()}>
      {/* Type selector */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl }}>
              {(['expense', 'income', 'transfer'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  testID={`edit-type-${t}`}
                  onPress={() => {
                    setType(t);
                    if (t !== 'transfer' && !isKnown(t, category)) setCategory(getOptions(t)[0]);
                  }}
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
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              <Label>Amount</Label>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm }}>
                <Body style={{ fontSize: scale(24), marginRight: 4, fontFamily: font.displayBold }}>{currencySymbol(cur)}</Body>
                <MoneyInput testID="edit-tx-amount" value={amount} onChange={setAmount} placeholder="0" style={{ flex: 1, alignSelf: 'stretch' }} />
              </View>
            </View>

            {/* Date */}
            <DateField testID="edit-tx-date" label="Date" value={date} onChange={setDate} />

            {/* Category */}
            <CategorySelector type={type} value={category} onChange={setCategory} testID="edit-tx" />

            {/* Wallet */}
            <Label style={{ marginTop: spacing.md }}>{type === 'transfer' ? 'From' : 'Wallet'}</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {wallets.map((w) => (
                <Chip key={w.id} testID={`edit-wallet-from-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />
              ))}
            </ScrollView>

            {type === 'transfer' && (
              <>
                <Label style={{ marginTop: spacing.md }}>To</Label>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                  {wallets.map((w) => (
                    <Chip key={w.id} testID={`edit-wallet-to-${w.id}`} label={w.name} active={toWalletId === w.id} onPress={() => setToWalletId(w.id)} />
                  ))}
                </ScrollView>
              </>
            )}

            <Input testID="edit-tx-note" label="Note (optional)" value={note} onChangeText={setNote} placeholder="Coffee, groceries…" />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="edit-tx-save" label="Save changes" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
