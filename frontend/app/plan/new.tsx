import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { useI18n } from '@/src/lib/I18nProvider';

const KINDS = ['wedding', 'house', 'car', 'vacation'] as const;

export default function NewPlan() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ kind?: string }>();
  const initialKind = (params.kind as (typeof KINDS)[number] | undefined);
  const isPreselected = !!initialKind && (KINDS as readonly string[]).includes(initialKind);
  const [kind, setKind] = useState<(typeof KINDS)[number]>(initialKind || 'wedding');
  const [step, setStep] = useState(isPreselected ? 2 : 1);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('plan.form.validation.name')); return; }
    const b = parseFloat(budget);
    if (!b || b <= 0) { setErr(t('plan.form.validation.budget')); return; }
    setLoading(true);
    try {
      const r = await api.createPlan({ kind, name: name.trim(), total_budget: b, target_date: date || undefined });
      router.replace({ pathname: '/plan/[id]', params: { id: r.plan.id } });
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  const handleBack = () => {
    if (!isPreselected && step === 2) setStep(1);
    else router.back();
  };

  const title = step === 2 && isPreselected
    ? t('plan.form.kindTitle', { kind: t(`plans.template.${kind}`) })
    : step === 2 ? t('plan.form.newTitle') : t('plan.form.chooseType');

  if (step === 1 && !isPreselected) {
    return (
      <FormLayout title={title} onBack={handleBack}>
        <Label>{t('plan.form.chooseTemplate')}</Label>
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {KINDS.map((k) => (
            <Chip key={k} testID={`plan-kind-${k}`} label={t(`plans.template.${k}`)} active={false} onPress={() => { setKind(k); setStep(2); }} />
          ))}
        </View>
      </FormLayout>
    );
  }

  return (
    <FormLayout title={title} onBack={handleBack}>
      {isPreselected && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.surface3, borderRadius: 10 }}>
          <Body style={{ fontFamily: 'Inter-Medium' }}>{t(`plans.template.${kind}`)}</Body>
        </View>
      )}
      {!isPreselected && step === 2 && (
        <TouchableOpacity onPress={() => setStep(1)} style={{ marginBottom: spacing.md }}>
          <Body style={{ color: colors.brandPrimary, fontFamily: 'Inter-Medium' }}>{t('plan.form.changeType')}</Body>
        </TouchableOpacity>
      )}
      <Input testID="plan-name" label={t('common.name')} value={name} onChangeText={setName} placeholder={t('plan.form.namePlaceholder')} />
      <MoneyInput testID="plan-budget" label={t('plan.form.totalBudget')} value={budget} onChange={setBudget} placeholder="25000" />
      <DateField testID="plan-date" label={t('plan.form.targetDate')} value={date} onChange={setDate} />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="plan-save" label={t('plan.form.create')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
