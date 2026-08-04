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

const KINDS = [
  { id: 'general', label: 'General' },
  { id: 'emergency', label: 'Emergency Fund' },
  { id: 'car', label: 'Car' },
  { id: 'vacation', label: 'Vacation' },
  { id: 'education', label: 'Education' },
  { id: 'gadget', label: 'Gadget' },
  { id: 'business', label: 'Business' },
];

export default function NewGoal() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [kind, setKind] = useState('general');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Enter a goal name'); return; }
    const t = parseFloat(target);
    if (!t || t <= 0) { setErr('Enter a target amount'); return; }
    setLoading(true);
    try {
      await api.createGoal({
        name: name.trim(),
        target_amount: t,
        saved_amount: parseFloat(saved) || 0,
        kind, target_date: targetDate || undefined,
      });
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title="New goal" onBack={() => router.back()}>
      <Input testID="goal-name" label="Name" value={name} onChangeText={setName} placeholder="Emergency fund, dream car…" />
      <Label>Kind</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {KINDS.map((k) => (
          <Chip key={k.id} testID={`goal-kind-${k.id}`} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </ScrollView>
      <MoneyInput testID="goal-target" label="Target amount" value={target} onChange={setTarget} placeholder="5000" />
      <MoneyInput testID="goal-saved" label="Already saved (optional)" value={saved} onChange={setSaved} placeholder="0" />
      <DateField testID="goal-date" label="Target date (optional)" value={targetDate} onChange={setTargetDate} />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="goal-save" label="Create goal" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
