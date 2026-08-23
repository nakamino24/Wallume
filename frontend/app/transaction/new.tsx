import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Button, Body, Label, Chip, Input } from '@/src/components/ui';
import { useToast } from '@/src/components/Toast';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { DateField } from '@/src/components/DateField';
import { CategorySelector } from '@/src/components/CategorySelector';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { todayLocalISO } from '@/src/utils/dates';
import { findMatch, loadStore } from '@/src/utils/merchant-engine';

export default function NewTransaction() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { getOptions, isKnown } = useUserCategories();
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>((params.type as any) || 'expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Bills');
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [note, setNote] = useState('');
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [date, setDate] = useState(() => todayLocalISO());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await api.wallets();
    setWallets(r.wallets || []);
    if (r.wallets?.[0]) setWalletId(r.wallets[0].id);
    if (r.wallets?.[1]) setToWalletId(r.wallets[1].id);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!hasManuallySelectedCategory) {
      setCategory(getOptions(type === 'transfer' ? 'expense' : type)[0]);
    }
  }, [type, getOptions, hasManuallySelectedCategory]);

  // Debounced auto-categorization
  useEffect(() => {
    if (!merchant.trim() || hasManuallySelectedCategory) return;
    
    const handler = setTimeout(async () => {
      const store = await loadStore();
      const match = findMatch(merchant, store);
      if (match && match !== category) {
        setCategory(match);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [merchant, hasManuallySelectedCategory, category]);

  const handleManualCategoryChange = (newCat: string) => {
    setHasManuallySelectedCategory(true);
    setCategory(newCat);
  };


  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('Enter a valid amount'); return; }
    if (!walletId) { setErr('Select a wallet'); return; }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) { setErr('Select a different destination wallet'); return; }
    setLoading(true);
    try {
      await api.createTransaction({
        wallet_id: walletId,
        to_wallet_id: type === 'transfer' ? toWalletId : undefined,
        type, amount: amt, category, merchant, note, date: date || undefined,
      });
      
      // Learn AFTER successful save
      if (merchant.trim()) {
        import('@/src/utils/merchant-engine').then(async ({ normalize, loadStore, saveStore }) => {
          const store = await loadStore();
          const normalized = normalize(merchant);
          const mapping = store[normalized] || { category, match_count: 0, last_used: Date.now(), is_seeded: false };
          mapping.category = category; // User's choice overrides suggestion
          mapping.match_count += 1;
          mapping.last_used = Date.now();
          store[normalized] = mapping;
          await saveStore(store);
        }).catch(console.warn);
      }

      toast.show(`${type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'} added`, 'success');
      router.back();
    } catch (e: any) { 
      setErr(e.message); 
      setLoading(false);
    }
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

            {/* Merchant */}
            <View style={{ alignSelf: 'stretch', marginBottom: spacing.xl }}>
              <Input testID="tx-merchant" label="Merchant (optional)" value={merchant} onChangeText={setMerchant} placeholder="e.g. Starbucks, Grab" />
            </View>

            {/* Date */}
            <DateField testID="tx-date" label="Date" value={date} onChange={setDate} />

            {/* Category */}
            <CategorySelector type={type} value={category} onChange={handleManualCategoryChange} testID="tx" />

            {/* Wallet */}
            <Label style={{ marginTop: spacing.md }}>{type === 'transfer' ? 'From' : 'Wallet'}</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {wallets.map((w) => (
                <Chip key={w.id} testID={`wallet-from-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />
              ))}
            </ScrollView>

            {type === 'transfer' && (
              <>
                <Label style={{ marginTop: spacing.md }}>To</Label>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                  {wallets.map((w) => (
                    <Chip key={w.id} testID={`wallet-to-${w.id}`} label={w.name} active={toWalletId === w.id} onPress={() => setToWalletId(w.id)} />
                  ))}
                </ScrollView>
              </>
            )}

            <Input testID="tx-note" label="Note (optional)" value={note} onChangeText={setNote} placeholder="Coffee, groceries…" />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="tx-save" label="Save transaction" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
