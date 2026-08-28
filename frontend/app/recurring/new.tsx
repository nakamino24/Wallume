import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { useI18n } from '@/src/lib/I18nProvider';

const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;

export default function RecurringForm() {
  const { colors } = useTheme();
  const router = useRouter();
  const { getOptions } = useUserCategories();
  const params = useLocalSearchParams<Record<string, string>>();
  const isEdit = !!params.id;
  const { t } = useI18n();

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
  const [walletError, setWalletError] = useState('');

  const load = useCallback(async () => {
    setWalletError('');
    try {
      const r = await api.wallets();
      setWallets(r.wallets || []);
      if (!walletId && r.wallets?.length) setWalletId(r.wallets[0].id);
    } catch (cause) {
      console.error('[RecurringForm] failed to load wallets', cause);
      setWalletError(t('data.loadError'));
    }
  }, [walletId, t]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!name.trim()) { setErr(t('recurring.validation.name')); return; }
    if (!amt || amt <= 0) { setErr(t('recurring.validation.amount')); return; }
    if (!walletId) { setErr(t('recurring.validation.wallet')); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) { setErr(t('recurring.validation.date')); return; }

    setLoading(true);
    try {
      const body = { name: name.trim(), type, amount: amt, category, wallet_id: walletId, frequency, next_date: nextDate, note };
      if (isEdit) await api.updateRecurring(params.id, body);
      else await api.createRecurring(body);
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title={isEdit ? t('recurring.form.edit') : t('recurring.form.new')} onBack={() => router.back()}>
      {/* Type selector */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl }}>
        {(['expense', 'income'] as const).map((txType) => (
          <TouchableOpacity key={txType} testID={`recurring-type-${txType}`} onPress={() => setType(txType)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', backgroundColor: type === txType ? (txType === 'income' ? colors.success : colors.error) : 'transparent' }}>
            <Body style={{ color: type === txType ? '#fff' : colors.onSurface2, fontFamily: font.textBold }}>{t(`transactions.type.${txType}`)}</Body>
          </TouchableOpacity>
        ))}
      </View>

      <Input testID="recurring-name" label={t('name')} value={name} onChangeText={setName} placeholder={t('recurring.form.namePlaceholder')} />

      <MoneyInput testID="recurring-amount" label={t('transaction.amount')} value={amount} onChange={setAmount} placeholder="150000" />

      <Label>{t('recurring.form.frequency')}</Label>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        {FREQUENCIES.map((f) => (
          <Chip key={f} testID={`recurring-freq-${f}`} label={t(`recurring.frequency.${f}`)} active={frequency === f} onPress={() => setFrequency(f)} />
        ))}
      </View>

      <DateField testID="recurring-next-date" label={t('recurring.form.nextDate')} value={nextDate} onChange={setNextDate} />

      <Label>{t('recurring.form.category')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {getOptions(type).map((c) => (<Chip key={c} testID={`recurring-cat-${c}`} label={localizedCategory(c, t)} active={category === c} onPress={() => setCategory(c)} />))}
      </ScrollView>

      <Label>{t('recurring.form.wallet')}</Label>
      {!!walletError && <><Body style={{ color: colors.error }}>{walletError}</Body><Button label={t('common.retry')} onPress={load} /></>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {wallets.map((w) => (<Chip key={w.id} testID={`recurring-wallet-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />))}
      </ScrollView>

      <Input testID="recurring-note" label={t('recurring.form.note')} value={note} onChangeText={setNote} placeholder={t('recurring.form.notePlaceholder')} />

      {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}
      <Button testID="recurring-save" label={isEdit ? t('recurring.form.saveChanges') : t('recurring.form.save')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}

function localizedCategory(raw: string, translate: (key: string) => string) {
  const key = `budgets.category.${raw.trim().toLowerCase().replace(/\s+/g, '_')}`;
  const localized = translate(key);
  return localized === key ? raw : localized;
}
