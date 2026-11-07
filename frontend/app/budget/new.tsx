import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Chip } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { useI18n } from '@/src/lib/I18nProvider';
import { systemCategoryLabel } from '@/src/lib/categories';

export default function BudgetForm() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const isEdit = !!params.id;
  const { t } = useI18n();
  const { getOptions } = useUserCategories();
  const cats = getOptions('expense');
  // The category is the identity of a budget, so it is not editable after
  // creation — changing it would silently re-point the spend calculation.
  const lockedCategory = isEdit ? params.category : undefined;
  const [category, setCategory] = useState(params.category || 'Food');
  const [amount, setAmount] = useState(params.amount || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr(t('transaction.validation.amount')); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await api.updateBudget(params.id, { amount: amt });
      } else {
        await api.createBudget({ category, amount: amt, period: 'monthly' });
      }
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title={isEdit ? t('budget.edit.title') : t('budget.new.title')} onBack={() => router.back()}>
      <Label>{t('category.title')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' }}>
        {(lockedCategory ? [lockedCategory] : cats).map((c) => (
          <Chip key={c} testID={`budget-cat-${c}`} label={systemCategoryLabel(c, t)} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>
      <MoneyInput testID="budget-amount" label={t('budget.monthlyLimit')} value={amount} onChange={setAmount} placeholder="500" />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button
        testID="budget-save"
        label={isEdit ? t('common.save') : t('budget.add')}
        onPress={submit}
        loading={loading}
        style={{ marginTop: spacing.md }}
      />
    </FormLayout>
  );
}
