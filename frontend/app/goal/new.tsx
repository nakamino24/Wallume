import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { useI18n } from '@/src/lib/I18nProvider';

const KINDS = ['general', 'emergency', 'car', 'vacation', 'education', 'gadget', 'business'] as const;

export default function NewGoal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [kind, setKind] = useState('general');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('goal.validation.name')); return; }
    const targetAmount = parseFloat(target);
    if (!targetAmount || targetAmount <= 0) { setErr(t('goal.validation.target')); return; }
    setLoading(true);
    try {
      await api.createGoal({
        name: name.trim(),
        target_amount: targetAmount,
        saved_amount: parseFloat(saved) || 0,
        kind, target_date: targetDate || undefined,
      });
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title={t('goal.new.title')} onBack={() => router.back()}>
      <Input testID="goal-name" label={t('common.name')} value={name} onChangeText={setName} placeholder={t('goal.namePlaceholder')} />
      <Label>{t('goal.kind')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' }}>
        {KINDS.map((goalKind) => (
          <Chip key={goalKind} testID={`goal-kind-${goalKind}`} label={t(`goal.kind.${goalKind}`)} active={kind === goalKind} onPress={() => setKind(goalKind)} />
        ))}
      </ScrollView>
      <MoneyInput testID="goal-target" label={t('goal.targetAmount')} value={target} onChange={setTarget} placeholder="5000" />
      <MoneyInput testID="goal-saved" label={t('goal.savedOptional')} value={saved} onChange={setSaved} placeholder="0" />
      <DateField testID="goal-date" label={t('goal.targetDateOptional')} value={targetDate} onChange={setTargetDate} />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="goal-save" label={t('goal.create')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
