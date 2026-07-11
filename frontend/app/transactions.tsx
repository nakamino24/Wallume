import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, formatMoney } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Chip, EmptyState } from '@/src/components/ui';

const CAT_ICON: Record<string, any> = {
  Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle',
  Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
  Rent: 'home', Salary: 'cash', Groceries: 'basket', Other: 'ellipsis-horizontal',
  Freelance: 'laptop', Investment: 'trending-up', Business: 'briefcase', Gift: 'gift',
};

export default function Transactions() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [txs, setTxs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  const load = useCallback(async () => {
    const r = await api.transactions();
    setTxs(r.transactions || []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = filter === 'all' ? txs : txs.filter((t) => t.type === filter);
  const cur = user?.currency || 'USD';

  const remove = (t: any) => {
    Alert.alert('Delete transaction?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteTransaction(t.id); load(); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md, flex: 1 }}>Transactions</H2>
          <TouchableOpacity testID="tx-add-fab" onPress={() => router.push('/transaction/new')}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={20} color={colors.onBrand} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}>
          {(['all', 'income', 'expense', 'transfer'] as const).map((f) => (
            <Chip key={f} testID={`tx-filter-${f}`} label={f[0].toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60, gap: spacing.sm }}>
          {shown.length === 0 ? (
            <EmptyState testID="tx-empty" title="No transactions" subtitle="Add one to get started." actionLabel="Add transaction" onAction={() => router.push('/transaction/new')} />
          ) : shown.map((t) => {
            const positive = t.type === 'income';
            const negative = t.type === 'expense';
            const color = positive ? colors.success : negative ? colors.error : colors.brandPrimary;
            const iconName = t.type === 'transfer' ? 'swap-horizontal' : (CAT_ICON[t.category] || 'ellipsis-horizontal');
            const d = new Date(t.date);
            const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <TouchableOpacity key={t.id} activeOpacity={0.85} onLongPress={() => remove(t)}>
                <Card style={{ padding: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                      <Ionicons name={iconName} size={18} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontFamily: font.textBold }}>{t.category}</Body>
                      <Body muted style={{ fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t.note || label}</Body>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Body style={{ fontFamily: font.displayBold, color }}>
                        {positive ? '+' : negative ? '-' : ''}{formatMoney(t.amount, cur)}
                      </Body>
                      <Body muted style={{ fontSize: 11, marginTop: 2 }}>{label}</Body>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
