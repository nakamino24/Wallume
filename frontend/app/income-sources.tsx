import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip, EmptyState } from '@/src/components/ui';
import { useToast } from '@/src/components/Toast';

const METHODS = ['fixed_amount', 'hourly', 'per_visit', 'per_shift', 'per_sale', 'per_project', 'percentage', 'manual'];

export default function IncomeSources() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [sources, setSources] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [method, setMethod] = useState('fixed_amount');
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.incomeSources();
      setSources(r.sources || []);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!name.trim()) { toast.show('Enter a source name', 'error'); return; }
    try {
      await api.createIncomeSource({
        name: name.trim(), calculation_method: method, frequency: 'monthly',
        expected_payment_date: { type: 'fixed_date', day: 25 },
        adjustment_rules: [{ type: 'weekend_rule', value: 'previous_business_day' }],
        forecast_rules: {}, currency: 'IDR', tax_status: 'taxable', recurring: true,
        amount: parseFloat(amount) || 0,
      });
      setName(''); setAmount('');
      toast.show('Income source added');
      load();
    } catch (e: any) { toast.show(e.message || 'Could not add', 'error'); }
  };

  const updateAmount = async (id: string, value: string) => {
    await api.updateIncomeSource(id, { amount: parseFloat(value) || 0 });
    load();
  };
  const remove = async (id: string, n: string) => {
    try {
      await api.deleteIncomeSource(id);
      toast.show(`Removed ${n}`);
      load();
    } catch { toast.show('Could not remove', 'error'); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>Income sources</H2>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
            <Body muted style={{ marginBottom: spacing.md }}>
              Your generated income config. Nominal amounts are added here when you log real income — nothing is locked in.
            </Body>

            {sources.length === 0 ? (
              <EmptyState title="No income sources" subtitle="Pick an occupation template or add sources manually." actionLabel="Add income source" onAction={() => {}} />
            ) : sources.map((s) => (
              <View key={s.id} style={{ backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{s.name}</Body>
                    <Body muted style={{ fontSize: 11, textTransform: 'capitalize', marginTop: 2 }}>{s.calculation_method.replace(/_/g, ' ')} · {s.frequency}</Body>
                  </View>
                  <TouchableOpacity onPress={() => remove(s.id, s.name)} style={{ padding: 4 }}><Ionicons name="close-circle" size={20} color={colors.error} /></TouchableOpacity>
                </View>
                <TextInput value={String(s.amount ?? '')} onChangeText={(v) => updateAmount(s.id, v)}
                  keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted}
                  style={{ color: colors.onSurface, fontFamily: font.displayBold, fontSize: 18, marginTop: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 }} />
              </View>
            ))}

            <Label style={{ marginTop: spacing.lg }}>Add new source</Label>
            <Input testID="income-source-name" value={name} onChangeText={setName} placeholder="e.g. Side Project" />
            <Label>Type</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {METHODS.map((m) => (
                <Chip key={m} label={m.replace(/_/g, ' ')} active={method === m} onPress={() => setMethod(m)} />
              ))}
            </ScrollView>
            <Input testID="income-source-amount" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="Amount (optional)" />
            <Button testID="income-source-add" label="Add source" onPress={add} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}