import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Chip } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { useI18n } from '@/src/lib/I18nProvider';

export default function NewBudget() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { getOptions } = useUserCategories();
  const cats = getOptions('expense');
  const [category, setCategory] = useState('Food');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr(t('transaction.validation.amount')); return; }
    setLoading(true);
    try {
      await api.createBudget({ category, amount: amt, period: 'monthly' });
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title={t('budget.new.title')} onBack={() => router.back()}>
      <Label>{t('category.title')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {cats.map((c) => (
          <Chip key={c} testID={`budget-cat-${c}`} label={c} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>
      <MoneyInput testID="budget-amount" label={t('budget.monthlyLimit')} value={amount} onChange={setAmount} placeholder="500" />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="budget-save" label={t('budget.add')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
