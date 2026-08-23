import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, formatMoney, formatMoneyFull, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H2, Body, Label, Button, Input, ProgressBar, DisplayNumber } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';

export default function GoalDetail() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<any>(null);
  const [amt, setAmt] = useState('');

  const load = useCallback(async () => {
    const r = await api.goals();
    setGoal((r.goals || []).find((g: any) => g.id === id));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!goal) return <Screen><SafeAreaView><Body style={{ padding: spacing.xl }}>Loading…</Body></SafeAreaView></Screen>;

  const cur = user?.currency || 'USD';
  const saved = cv(goal, 'saved_amount');
  const target = cv(goal, 'target_amount');
  const p = target > 0 ? Math.min(1, saved / target) : 0;
  const remaining = Math.max(0, target - saved);

  const contribute = async () => {
    const v = parseFloat(amt);
    if (!v || v <= 0) return;
    await api.contributeGoal(goal.id, v);
    setAmt('');
    load();
  };
  const remove = () => {
    Alert.alert('Delete goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteGoal(goal.id); router.back(); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md, flex: 1 }}>{goal.name}</H2>
          <TouchableOpacity onPress={remove}><Ionicons name="trash" size={20} color={colors.error} /></TouchableOpacity>
        </View>
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
          <Card>
            <Label>Saved</Label>
            <DisplayNumber size={38} style={{ marginTop: 6 }}>{formatMoneyFull(saved, cur)}</DisplayNumber>
            <Body muted style={{ marginTop: 6 }}>of {formatMoneyFull(target, cur)} target</Body>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar progress={p} height={10} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
              <Body muted>{Math.round(p * 100)}% complete</Body>
              <Body style={{ fontFamily: font.textBold }}>{formatMoney(remaining, cur)} to go</Body>
            </View>
          </Card>

          <Card>
            <Label>Add contribution</Label>
            <Input testID="goal-contribute-amt" keyboardType="decimal-pad" value={amt} onChangeText={setAmt} placeholder="100" />
            <Button testID="goal-contribute-btn" label="Add" onPress={contribute} />
          </Card>

          {goal.target_date && (
            <Card>
              <Label>Target date</Label>
              <Body style={{ fontFamily: font.textBold, marginTop: 4 }}>{goal.target_date}</Body>
            </Card>
          )}
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}

