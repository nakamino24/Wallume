import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';

export default function NewBudget() {
  const { colors } = useTheme();
  const router = useRouter();
  const { getOptions } = useUserCategories();
  const cats = getOptions('expense');
  const [category, setCategory] = useState('Food');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('Enter a valid amount'); return; }
    setLoading(true);
    try {
      await api.createBudget({ category, amount: amt, period: 'monthly' });
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
            <H2 style={{ marginLeft: spacing.md }}>New budget</H2>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Label>Category</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {cats.map((c) => (
                <Chip key={c} testID={`budget-cat-${c}`} label={c} active={category === c} onPress={() => setCategory(c)} />
              ))}
            </ScrollView>
            <Input testID="budget-amount" label="Monthly limit" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="500" />
            {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
            <Button testID="budget-save" label="Add budget" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
