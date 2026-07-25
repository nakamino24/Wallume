import React, { useCallback, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { useAuth } from '@/src/auth/AuthProvider';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';

const CATEGORIES = ['Bills', 'Entertainment', 'Health', 'Rent', 'Transport', 'Shopping', 'Other'];
const FREQUENCIES: { id: 'weekly' | 'monthly' | 'yearly'; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export default function RecurringForm() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const isEdit = !!params.id;

  const [name, setName] = useState(params.name || '');
  const [type, setType] = useState<'income' | 'expense'>((params.type as any) || 'expense');
  const [amount, setAmount] = useState(params.amount || '');
  const [category, setCategory] = useState(params.category || 'Bills');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>((params.frequency as any) || 'monthly');
  const [nextDate, setNextDate] = useState(params.next_date ? params.next_date.slice(0, 10) : '');
  const [note, setNote] = useState(params.note || '');
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState(params.wallet_id || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const r = await api.wallets();
    setWallets(r.wallets || []);
    if (!walletId && r.wallets?.length) setWalletId(r.wallets[0].id);
  }, [walletId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cur = user?.currency || 'USD';

  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!name.trim()) { setErr('Enter a name'); return; }
    if (!amt || amt <= 0) { setErr('Enter a valid amount'); return; }
    if (!walletId) { setErr('Select a wallet'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) { setErr('Next due date must be YYYY-MM-DD'); return; }

    setLoading(true);
    try {
      const body = { name: name.trim(), type, amount: amt, category, wallet_id: walletId, frequency, next_date: nextDate, note };
      if (isEdit) await api.updateRecurring(params.id, body);
      else await api.createRecurring(body);
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity testID="recurring-form-back" onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>{isEdit ? 'Edit recurring' : 'New recurring'}</H2>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {/* Type selector */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl }}>
              {(['expense', 'income'] as const).map((t) => (
                <TouchableOpacity key={t} testID={`recurring-type-${t}`} onPress={() => setType(t)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', backgroundColor: type === t ? (t === 'income' ? colors.success : colors.error) : 'transparent' }}>
                  <Body style={{ color: type === t ? '#fff' : colors.onSurface2, fontFamily: font.textBold, textTransform: 'capitalize' }}>{t}</Body>
                </TouchableOpacity>
              ))}
            </View>

            <Input testID="recurring-name" label="Name" value={name} onChangeText={setName} placeholder="Netflix, Wifi, Rent…" />

            <Label>Amount</Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Body style={{ fontSize: 20, marginRight: 8, fontFamily: font.displayBold }}>{currencySymbol(cur)}</Body>
              <Input testID="recurring-amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="150000" style={{ flex: 1 }} />
            </View>

            <Label>Frequency</Label>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {FREQUENCIES.map((f) => (
                <Chip key={f.id} testID={`recurring-freq-${f.id}`} label={f.label} active={frequency === f.id} onPress={() => setFrequency(f.id)} />
              ))}
            </View>

            <Input testID="recurring-next-date" label="Next due date" value={nextDate} onChangeText={setNextDate} placeholder="YYYY-MM-DD" />

            <Label>Category</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {CATEGORIES.map((c) => (<Chip key={c} testID={`recurring-cat-${c}`} label={c} active={category === c} onPress={() => setCategory(c)} />))}
            </ScrollView>

            <Label>Wallet</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {wallets.map((w) => (<Chip key={w.id} testID={`recurring-wallet-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />))}
            </ScrollView>

            <Input testID="recurring-note" label="Note (optional)" value={note} onChangeText={setNote} placeholder="Shared with roommate…"
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)} />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}
            <Button testID="recurring-save" label={isEdit ? 'Save changes' : 'Add recurring'} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
