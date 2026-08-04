import React, { useCallback, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { useAuth } from '@/src/auth/AuthProvider';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';

const FREQUENCIES: { id: 'weekly' | 'monthly' | 'yearly'; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export default function RecurringForm() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { getOptions } = useUserCategories();
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
    <FormLayout title={isEdit ? 'Edit recurring' : 'New recurring'} onBack={() => router.back()}>
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

      <MoneyInput testID="recurring-amount" label="Amount" value={amount} onChange={setAmount} placeholder="150000" />

      <Label>Frequency</Label>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        {FREQUENCIES.map((f) => (
          <Chip key={f.id} testID={`recurring-freq-${f.id}`} label={f.label} active={frequency === f.id} onPress={() => setFrequency(f.id)} />
        ))}
      </View>

      <DateField testID="recurring-next-date" label="Next due date" value={nextDate} onChange={setNextDate} />

      <Label>Category</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {getOptions(type).map((c) => (<Chip key={c} testID={`recurring-cat-${c}`} label={c} active={category === c} onPress={() => setCategory(c)} />))}
      </ScrollView>

      <Label>Wallet</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {wallets.map((w) => (<Chip key={w.id} testID={`recurring-wallet-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />))}
      </ScrollView>

      <Input testID="recurring-note" label="Note (optional)" value={note} onChangeText={setNote} placeholder="Shared with roommate…" />

      {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}
      <Button testID="recurring-save" label={isEdit ? 'Save changes' : 'Add recurring'} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
