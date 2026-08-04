import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';

const KINDS = ['wedding', 'house', 'car', 'vacation'] as const;

export default function NewPlan() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<(typeof KINDS)[number]>((params.kind as any) || 'wedding');
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Enter a name'); return; }
    const b = parseFloat(budget);
    if (!b || b <= 0) { setErr('Enter a budget'); return; }
    setLoading(true);
    try {
      const r = await api.createPlan({ kind, name: name.trim(), total_budget: b, target_date: date || undefined });
      router.replace({ pathname: '/plan/[id]', params: { id: r.plan.id } });
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title="New plan" onBack={() => router.back()}>
      <Label>Kind</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {KINDS.map((k) => (
          <Chip key={k} testID={`plan-kind-${k}`} label={k[0].toUpperCase() + k.slice(1)} active={kind === k} onPress={() => setKind(k)} />
        ))}
      </ScrollView>
      <Input testID="plan-name" label="Name" value={name} onChangeText={setName} placeholder="Our wedding 2026" />
      <MoneyInput testID="plan-budget" label="Total budget" value={budget} onChange={setBudget} placeholder="25000" />
      <DateField testID="plan-date" label="Target date (optional)" value={date} onChange={setDate} />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="plan-save" label="Create plan" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
