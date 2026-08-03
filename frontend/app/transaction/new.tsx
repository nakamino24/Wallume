import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { formatInputDigits, stripFormatting } from '@/src/lib/money';
import { api } from '@/src/api/client';
import { Screen, H1, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { ErrorBanner } from '@/src/components/ErrorBanner';
import { useToast } from '@/src/components/Toast';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { DateField } from '@/src/components/DateField';
import { CategorySelector } from '@/src/components/CategorySelector';

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
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const r = await api.wallets();
    setWallets(r.wallets || []);
    if (r.wallets?.[0]) setWalletId(r.wallets[0].id);
    if (r.wallets?.[1]) setToWalletId(r.wallets[1].id);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    setCategory(getOptions(type === 'transfer' ? 'expense' : type)[0]);
  }, [type]);

  const submit = async () => {
    setErr('');
    setFieldErrors({});
    const errors: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) errors.amount = 'Enter a valid amount';
    if (!walletId) errors.wallet = 'Select a wallet';
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) errors.toWallet = 'Select a different wallet';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
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
      toast.show(`${type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Transfer'} added`, 'success');
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const cur = user?.currency || 'USD';

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity testID="new-tx-back" onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>New transaction</H2>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
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
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              <Label>Amount</Label>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm }}>
                <Body style={{ fontSize: scale(24), marginRight: 4, fontFamily: font.displayBold }}>{currencySymbol(cur)}</Body>
                <Input
                  testID="tx-amount"
                  keyboardType="decimal-pad"
                  value={formatInputDigits(amount)}
                  onChangeText={(t) => setAmount(stripFormatting(t))}
                  placeholder="0"
                  autoFocus
                  style={{ fontSize: scale(44), fontFamily: font.displayBold, textAlign: 'center', backgroundColor: 'transparent', borderWidth: 0, minWidth: 160, paddingVertical: 4 }}
                />
              </View>
            </View>

            {/* Date */}
            <DateField testID="tx-date" label="Date" value={date} onChange={setDate} />

            {/* Category */}
            <CategorySelector type={type} value={category} onChange={setCategory} testID="tx" />

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

            <Input testID="tx-note" label="Note (optional)" value={note} onChangeText={setNote} placeholder="Coffee, groceries…"
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)} />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="tx-save" label="Save transaction" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
