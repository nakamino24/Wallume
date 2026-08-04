import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';

const KINDS = [
  { id: 'loan', label: 'Loan' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'mortgage', label: 'Mortgage' },
  { id: 'personal', label: 'Personal' },
  { id: 'other', label: 'Other' },
];

export default function NewDebt() {
  const { colors } = useTheme();
  const router = useRouter();
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
    if (!name.trim()) { setErr('Enter a name'); return; }
    const p = parseFloat(principal);
    if (!p || p <= 0) { setErr('Enter principal amount'); return; }
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
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title="New debt" onBack={() => router.back()}>
      <Input testID="debt-name" label="Name" value={name} onChangeText={setName} placeholder="Student loan" />
      <Label>Kind</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {KINDS.map((k) => (
          <Chip key={k.id} testID={`debt-kind-${k.id}`} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </ScrollView>
      <MoneyInput testID="debt-principal" label="Total (principal)" value={principal} onChange={setPrincipal} placeholder="10000" />
      <MoneyInput testID="debt-remaining" label="Remaining (optional)" value={remaining} onChange={setRemaining} placeholder="8500" />
      <Input testID="debt-rate" label="APR %" keyboardType="decimal-pad" value={rate} onChangeText={setRate} placeholder="6.5" />
      <MoneyInput testID="debt-monthly" label="Monthly payment" value={monthly} onChange={setMonthly} placeholder="250" />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="debt-save" label="Add debt" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
