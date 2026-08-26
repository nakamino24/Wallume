import React, { useCallback, useMemo, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, Button, Input, ProgressBar } from '@/src/components/ui';
import { MoneyInput } from '@/src/components/MoneyInput';
import { MoneyValue } from '@/src/components/MoneyValue';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';

const planIcon: Record<string, any> = { wedding: 'heart-outline', house: 'home-outline', car: 'car-sport-outline', vacation: 'airplane-outline' };

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
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity testID="plan-back" onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
              </TouchableOpacity>
              <TouchableOpacity testID="plan-delete" onPress={deletePlan} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
              <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={planIcon[plan.kind] || 'compass-outline'} size={22} color={colors.onBrandSoft} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Body muted style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11, fontFamily: font.textMedium }}>{plan.kind}</Body>
                <H1 numberOfLines={2} style={{ marginTop: 2 }}>{plan.name}</H1>
              </View>
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <Body muted style={{ fontSize: 12 }}>Terkumpul</Body>
                  <MoneyValue value={totals.paid} currency={cur} privacy="financial" style={{ fontFamily: font.textBold, fontSize: 18 }} />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Body muted style={{ fontSize: 12 }}>Target</Body>
                  <MoneyValue value={budget} currency={cur} privacy="financial" style={{ fontFamily: font.textBold, fontSize: 16 }} />
                </View>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <ProgressBar progress={progress} color={colors.brandPrimary} height={6} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <Body muted style={{ fontSize: 12 }}>{Math.round(progress * 100)}% · </Body>
                  <MoneyValue value={totals.paid} currency={cur} privacy="financial" style={{ color: colors.muted, fontSize: 12 }} />
                  <Body muted style={{ fontSize: 12 }}> / </Body>
                  <MoneyValue value={budget} currency={cur} privacy="financial" style={{ color: colors.muted, fontSize: 12 }} />
                </View>
              </View>
            </View>
          </View>

          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            <Card>
              <Label>Summary</Label>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.sm }}>
                <View>
                  <Body muted style={{ fontSize: 12 }}>Budget</Body>
                  <MoneyValue value={budget} currency={cur} privacy="financial" style={{ fontFamily: font.displayBold, fontSize: 18 }} />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Body muted style={{ fontSize: 12 }}>Allocated</Body>
                  <MoneyValue value={totals.allocated} currency={cur} privacy="financial" style={{ fontFamily: font.displayBold, fontSize: 18 }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View>
                  <Body muted style={{ fontSize: 12 }}>Funds collected</Body>
                  <MoneyValue value={totals.paid} currency={cur} privacy="financial" style={{ fontFamily: font.displayBold, fontSize: 18, color: colors.brandPrimary }} />
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
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Body muted style={{ fontSize: 12, lineHeight: 16 }}>Budget  </Body><MoneyValue value={cv(it, 'amount')} currency={cur} privacy="financial" style={{ fontFamily: font.textBold, fontSize: 12, lineHeight: 16 }} /></View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Body muted style={{ fontSize: 12, lineHeight: 16 }}>Funds collected  </Body><MoneyValue value={cv(it, 'paid')} currency={cur} privacy="financial" style={{ fontFamily: font.textBold, fontSize: 12, lineHeight: 16, color: colors.brandPrimary }} /></View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(it.id)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                  <MoneyInput testID={`item-amount-${it.id}`} currency={cur} value={String(it.amount ?? '')} label="Budget"
                    onChange={(v) => updateItem(it.id, { amount: parseFloat(v) || 0 })}
                    style={{ marginBottom: 0 }} />
                  <MoneyInput testID={`item-paid-${it.id}`} currency={cur} value={String(it.paid ?? '')} label="Funds collected"
                    onChange={(v) => updateItem(it.id, { paid: parseFloat(v) || 0 })}
                    style={{ marginBottom: 0 }} />
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

