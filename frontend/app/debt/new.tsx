import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { useI18n } from '@/src/lib/I18nProvider';

const KINDS = ['loan', 'credit_card', 'mortgage', 'personal', 'other'] as const;

export default function NewDebt() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('loan');
  const [principal, setPrincipal] = useState('');
  const [remaining, setRemaining] = useState('');
  const [rate, setRate] = useState('');
  const [monthly, setMonthly] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('debt.validation.name')); return; }
    const p = parseFloat(principal);
    if (!p || p <= 0) { setErr(t('debt.validation.principal')); return; }
    setLoading(true);
    try {
      await api.createDebt({
        name: name.trim(), kind,
        principal: p,
        remaining: parseFloat(remaining) || p,
        interest_rate: parseFloat(rate) || 0,
        monthly_payment: parseFloat(monthly) || 0,
      });
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title={t('debt.new.title')} onBack={() => router.back()}>
      <Input testID="debt-name" label={t('common.name')} value={name} onChangeText={setName} placeholder={t('debt.namePlaceholder')} />
      <Label>{t('goal.kind')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' }}>
        {KINDS.map((debtKind) => (
          <Chip key={debtKind} testID={`debt-kind-${debtKind}`} label={t(`debt.kind.${debtKind}`)} active={kind === debtKind} onPress={() => setKind(debtKind)} />
        ))}
      </ScrollView>
      <MoneyInput testID="debt-principal" label={t('debt.totalPrincipal')} value={principal} onChange={setPrincipal} placeholder="10000" />
      <MoneyInput testID="debt-remaining" label={t('debt.remainingOptional')} value={remaining} onChange={setRemaining} placeholder="8500" />
      <Input testID="debt-rate" label={t('debt.apr')} keyboardType="decimal-pad" value={rate} onChangeText={setRate} placeholder="6.5" />
      <MoneyInput testID="debt-monthly" label={t('debt.monthlyPayment')} value={monthly} onChange={setMonthly} placeholder="250" />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="debt-save" label={t('debt.add')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
