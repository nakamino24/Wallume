import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H2, Body, Label, Button, ProgressBar } from '@/src/components/ui';
import { MoneyInput } from '@/src/components/MoneyInput';
import { MoneyValue } from '@/src/components/MoneyValue';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { useI18n } from '@/src/lib/I18nProvider';

export default function GoalDetail() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<any>(null);
  const [amt, setAmt] = useState('');

  const load = useCallback(async () => {
    const r = await api.goals();
    setGoal((r.goals || []).find((g: any) => g.id === id));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!goal) return <Screen><SafeAreaView><Body style={{ padding: spacing.xl }}>{t('common.loading')}</Body></SafeAreaView></Screen>;

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
    Alert.alert(t('goal.delete.title'), t('goal.delete.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await api.deleteGoal(goal.id); router.back(); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md, flex: 1 }}>{goal.name}</H2>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('goal.delete.title')} hitSlop={10} onPress={remove}><Ionicons name="trash" size={20} color={colors.error} /></TouchableOpacity>
        </View>
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
          <Card>
            <Label>{t('goal.saved')}</Label>
            <MoneyValue value={saved} currency={cur} style={{ fontFamily: font.displayBold, fontSize: 38, marginTop: 6, letterSpacing: -0.5 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}><Body muted>{t('goal.of')} </Body><MoneyValue value={target} currency={cur} style={{ color: colors.muted, fontSize: 15 }} /><Body muted> {t('goal.targetSuffix')}</Body></View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar progress={p} height={10} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
              <Body muted>{t('goal.complete', { value: Math.round(p * 100) })}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><MoneyValue value={remaining} currency={cur} style={{ fontFamily: font.textBold }} /><Body> {t('goal.toGoSuffix')}</Body></View>
            </View>
          </Card>

          <Card>
            <Label>{t('goal.addContribution')}</Label>
            <MoneyInput testID="goal-contribute-amt" currency={cur} value={amt} onChange={setAmt} placeholder="100" />
            <Button testID="goal-contribute-btn" label={t('goal.add')} onPress={contribute} />
          </Card>

          {goal.target_date && (
            <Card>
              <Label>{t('goal.targetDate')}</Label>
              <Body style={{ fontFamily: font.textBold, marginTop: 4 }}>{goal.target_date}</Body>
            </Card>
          )}
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
