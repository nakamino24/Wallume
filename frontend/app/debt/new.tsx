import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';

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
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>New debt</H2>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Input testID="debt-name" label="Name" value={name} onChangeText={setName} placeholder="Student loan" />
            <Label>Kind</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {KINDS.map((k) => (
                <Chip key={k.id} testID={`debt-kind-${k.id}`} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
              ))}
            </ScrollView>
            <Input testID="debt-principal" label="Total (principal)" keyboardType="decimal-pad" value={principal} onChangeText={setPrincipal} placeholder="10000" />
            <Input testID="debt-remaining" label="Remaining (optional)" keyboardType="decimal-pad" value={remaining} onChangeText={setRemaining} placeholder="8500" />
            <Input testID="debt-rate" label="APR %" keyboardType="decimal-pad" value={rate} onChangeText={setRate} placeholder="6.5" />
            <Input testID="debt-monthly" label="Monthly payment" keyboardType="decimal-pad" value={monthly} onChangeText={setMonthly} placeholder="250" />
            {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
            <Button testID="debt-save" label="Add debt" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
