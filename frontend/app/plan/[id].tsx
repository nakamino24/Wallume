import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, ImageBackground, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoney, formatMoneyFull, images, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, Button, Input, ProgressBar, DisplayNumber } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';

const HERO: Record<string, string> = { wedding: images.wedding, house: images.house, car: images.car, vacation: images.vacation };

export default function PlanDetail() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');

  const load = useCallback(async () => {
    const r = await api.plans();
    setPlan((r.plans || []).find((p: any) => p.id === id));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cur = user?.currency || 'USD';

  const totals = useMemo(() => {
    if (!plan) return { paid: 0, allocated: 0 };
    const paid = (plan.items || []).reduce((s: number, i: any) => s + cv(i, 'paid'), 0);
    const allocated = (plan.items || []).reduce((s: number, i: any) => s + cv(i, 'amount'), 0);
    return { paid, allocated };
  }, [plan]);

  if (!plan) return <Screen><SafeAreaView><Body style={{ padding: spacing.xl }}>Loading…</Body></SafeAreaView></Screen>;

  const budget = cv(plan, 'total_budget');
  const progress = budget > 0 ? Math.min(1, totals.paid / budget) : 0;

  const updateItem = async (itemId: string, patch: any) => {
    const items = plan.items.map((it: any) => it.id === itemId ? { ...it, ...patch } : it);
    setPlan({ ...plan, items });
    await api.updatePlan(plan.id, { items });
  };
  const removeItem = async (itemId: string) => {
    const items = plan.items.filter((it: any) => it.id !== itemId);
    setPlan({ ...plan, items });
    await api.updatePlan(plan.id, { items });
  };
  const addItem = async () => {
    if (!newItemLabel.trim()) return;
    const items = [...(plan.items || []), {
      id: `it_${Math.random().toString(36).slice(2, 10)}`,
      label: newItemLabel.trim(),
      amount: parseFloat(newItemAmount) || 0,
      paid: 0, done: false,
    }];
    setNewItemLabel(''); setNewItemAmount('');
    setPlan({ ...plan, items });
    await api.updatePlan(plan.id, { items });
  };
  const deletePlan = () => {
    Alert.alert('Delete plan?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deletePlan(plan.id); router.back(); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ paddingBottom: 100 }}>
          <ImageBackground source={{ uri: HERO[plan.kind] }} style={{ height: 260 }}>
            <LinearGradient colors={['#00000088', 'transparent', '#000000ee']} style={{ flex: 1, padding: spacing.xl, justifyContent: 'space-between' }}>
              <SafeAreaView edges={['top']}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TouchableOpacity testID="plan-back" onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity testID="plan-delete" onPress={deletePlan} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trash" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
              <View>
                <Body style={{ color: '#ffffffcc', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, fontFamily: font.textMedium }}>{plan.kind}</Body>
                <H1 style={{ color: '#fff', marginTop: 4 }}>{plan.name}</H1>
                <Body style={{ color: '#ffffffcc', marginTop: 4 }}>
                  {formatMoney(totals.paid, cur)} paid of {formatMoney(budget, cur)}
                </Body>
                <View style={{ marginTop: 10 }}>
                  <ProgressBar progress={progress} color={colors.brandPrimary} height={6} />
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>

          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            <Card>
              <Label>Summary</Label>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.sm }}>
                <View>
                  <Body muted style={{ fontSize: 12 }}>Budget</Body>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>{formatMoney(budget, cur)}</Body>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Body muted style={{ fontSize: 12 }}>Allocated</Body>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>{formatMoney(totals.allocated, cur)}</Body>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View>
                  <Body muted style={{ fontSize: 12 }}>Funds collected</Body>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 18, color: colors.brandPrimary }}>{formatMoney(totals.paid, cur)}</Body>
                </View>
                <Body muted style={{ fontSize: 12 }}>{Math.round(progress * 100)}% of budget</Body>
              </View>
            </Card>

            <H2>Checklist</H2>
            {(plan.items || []).map((it: any) => (
              <Card key={it.id} style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity testID={`item-toggle-${it.id}`} onPress={() => updateItem(it.id, { done: !it.done })}
                    style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: it.done ? colors.brandPrimary : colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, backgroundColor: it.done ? colors.brandPrimary : 'transparent' }}>
                    {it.done && <Ionicons name="checkmark" size={16} color={colors.onBrand} />}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: font.textBold, textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.label}</Body>
                    <View style={{ marginTop: 4 }}>
                      <Body muted style={{ fontSize: 12, lineHeight: 16 }}>Budget  <Body style={{ fontFamily: font.textBold, fontSize: 12, lineHeight: 16 }}>{formatMoney(cv(it, 'amount'), cur)}</Body></Body>
                      <Body muted style={{ fontSize: 12, lineHeight: 16 }}>Funds collected  <Body style={{ fontFamily: font.textBold, fontSize: 12, lineHeight: 16, color: colors.brandPrimary }}>{formatMoney(cv(it, 'paid'), cur)}</Body></Body>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(it.id)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: spacing.sm }}>
                  <Input testID={`item-amount-${it.id}`} keyboardType="decimal-pad" value={String(it.amount ?? '')} label="Budget"
                    onChangeText={(v) => updateItem(it.id, { amount: parseFloat(v) || 0 })}
                    style={{ marginBottom: 0 }} />
                  <Input testID={`item-paid-${it.id}`} keyboardType="decimal-pad" value={String(it.paid ?? '')} label="Funds collected"
                    onChangeText={(v) => updateItem(it.id, { paid: parseFloat(v) || 0 })}
                    style={{ marginTop: spacing.sm, marginBottom: 0 }} />
                </View>
              </Card>
            ))}

            <Card>
              <Label>Add item</Label>
              <Input testID="new-item-label" placeholder="e.g. Wedding cake" value={newItemLabel} onChangeText={setNewItemLabel} />
              <Input testID="new-item-amount" placeholder="Amount (optional)" keyboardType="decimal-pad" value={newItemAmount} onChangeText={setNewItemAmount} />
              <Button testID="add-item-btn" label="Add checklist item" onPress={addItem} />
            </Card>
          </View>
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}

