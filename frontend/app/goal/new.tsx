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
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>New goal</H2>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Input testID="goal-name" label="Name" value={name} onChangeText={setName} placeholder="Emergency fund, dream car…" />
            <Label>Kind</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {KINDS.map((k) => (
                <Chip key={k.id} testID={`goal-kind-${k.id}`} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
              ))}
            </ScrollView>
            <Input testID="goal-target" label="Target amount" keyboardType="decimal-pad" value={target} onChangeText={setTarget} placeholder="5000" />
            <Input testID="goal-saved" label="Already saved (optional)" keyboardType="decimal-pad" value={saved} onChangeText={setSaved} placeholder="0" />
            <Input testID="goal-date" label="Target date (optional)" value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD" />
            {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
            <Button testID="goal-save" label="Create goal" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
