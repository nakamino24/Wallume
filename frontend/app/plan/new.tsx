import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';

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
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>New plan</H2>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Label>Kind</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {KINDS.map((k) => (
                <Chip key={k} testID={`plan-kind-${k}`} label={k[0].toUpperCase() + k.slice(1)} active={kind === k} onPress={() => setKind(k)} />
              ))}
            </ScrollView>
            <Input testID="plan-name" label="Name" value={name} onChangeText={setName} placeholder="Our wedding 2026" />
            <Input testID="plan-budget" label="Total budget" keyboardType="decimal-pad" value={budget} onChangeText={setBudget} placeholder="25000" />
            <Input testID="plan-date" label="Target date (optional)" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
            <Button testID="plan-save" label="Create plan" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
