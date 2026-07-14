import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoney } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, Button, EmptyState } from '@/src/components/ui';

const FREQ_LABEL: Record<string, string> = { weekly: '/week', monthly: '/month', yearly: '/year' };

export default function Recurring() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const cur = user?.currency || 'USD';

  const load = useCallback(async () => {
    try {
      const r = await api.recurring();
      setItems(r.recurring || []);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const monthlyTotal = items
    .filter((i) => i.active && i.type === 'expense')
    .reduce((sum, i) => {
      const mult = i.frequency === 'weekly' ? 4.33 : i.frequency === 'yearly' ? 1 / 12 : 1;
      return sum + i.amount * mult;
    }, 0);

  const markPaid = async (id: string, name: string) => {
    Alert.alert('Mark as paid?', `This logs a transaction for ${name} and moves it to the next due date.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark paid', onPress: async () => { await api.markRecurringPaid(id); load(); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity testID="recurring-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>Bills & Subscriptions</H2>
          </View>
          <TouchableOpacity testID="recurring-add-btn" onPress={() => router.push('/recurring/new')}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={18} color={colors.onBrand} />
          </TouchableOpacity>
        </View>

        <View style={{ padding: spacing.xl, paddingBottom: 0 }}>
          <Card style={{ backgroundColor: colors.inverse }}>
            <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Recurring spend</Label>
            <Body style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 26, marginTop: 4 }}>
              {formatMoney(monthlyTotal, cur)} <Body style={{ color: colors.onInverse, opacity: 0.6, fontSize: 14 }}>/month equiv.</Body>
            </Body>
          </Card>
        </View>

        <View style={{ flex: 1, padding: spacing.xl, gap: spacing.sm }}>
          {items.length === 0 ? (
            <EmptyState testID="recurring-empty" title="No recurring bills yet" subtitle="Add subscriptions and bills so you never miss a due date."
              actionLabel="Add recurring" onAction={() => router.push('/recurring/new')} />
          ) : items.map((r) => {
            const overdue = r.days_until !== null && r.days_until < 0;
            const dueSoon = r.days_until !== null && r.days_until >= 0 && r.days_until <= 3;
            const dueColor = overdue ? colors.error : dueSoon ? colors.warning : colors.onSurface2;
            const dueText = overdue ? `${Math.abs(r.days_until)}d overdue` : r.days_until === 0 ? 'Due today' : `in ${r.days_until}d`;
            return (
              <Card key={r.id} testID={`recurring-card-${r.id}`} onPress={() => router.push(`/recurring/${r.id}`)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{r.name}</Body>
                    <Body muted style={{ marginTop: 2, fontSize: 12 }}>{r.category} · {dueText}</Body>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Body style={{ fontFamily: font.displayBold, color: r.type === 'income' ? colors.success : colors.onSurface }}>
                      {r.type === 'income' ? '+' : '-'}{formatMoney(r.amount, cur)}
                    </Body>
                    <Body muted style={{ fontSize: 11, marginTop: 2 }}>{FREQ_LABEL[r.frequency]}</Body>
                  </View>
                </View>
                <TouchableOpacity testID={`recurring-mark-paid-${r.id}`} onPress={() => markPaid(r.id, r.name)}
                  style={{ marginTop: spacing.md, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.surface2 }}>
                  <Body style={{ fontFamily: font.textMedium, fontSize: 13, color: dueColor }}>Mark as paid</Body>
                </TouchableOpacity>
              </Card>
            );
          })}
        </View>
      </SafeAreaView>
    </Screen>
  );
}
