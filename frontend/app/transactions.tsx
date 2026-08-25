import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, radius } from '@/src/theme/tokens';
import { Screen, H2, Body, Chip, EmptyState } from '@/src/components/ui';
import { useTransactions } from '@/src/hooks/use-transactions';
import { groupTransactionsByDate, TransactionDayGroup } from '@/src/components/transactions/TransactionDayGroup';

export default function Transactions() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { transactions: txs, loading, error, refresh, remove: removeTransaction } = useTransactions();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const shown = filter === 'all' ? txs : txs.filter((t) => t.type === filter);
  const dayGroups = groupTransactionsByDate(shown);
  const cur = user?.currency || 'USD';

  const remove = (t: any) => {
    Alert.alert('Delete transaction?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        removeTransaction(t.id);
      } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md, flex: 1 }}>Transactions</H2>
          <TouchableOpacity testID="tx-add-fab" onPress={() => router.push('/transaction/new')}
            style={{ width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={20} color={colors.onBrand} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}>
          {(['all', 'income', 'expense', 'transfer'] as const).map((f) => (
            <Chip key={f} testID={`tx-filter-${f}`} label={f[0].toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 60, gap: spacing.sm }}>
          {loading ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <Body muted>Loading transactions…</Body>
            </View>
          ) : error ? (
            <View style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xl }}>
              <Body style={{ color: colors.error, textAlign: 'center' }}>{error}</Body>
              <TouchableOpacity onPress={refresh} style={{ paddingVertical: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: 8 }}>
                <Body style={{ color: colors.onBrand, fontFamily: font.textBold }}>Retry</Body>
              </TouchableOpacity>
            </View>
          ) : shown.length === 0 ? (
            <EmptyState testID="tx-empty" title="No transactions" subtitle="Add one to get started." actionLabel="Add transaction" onAction={() => router.push('/transaction/new')} />
          ) : dayGroups.map((group) => <TransactionDayGroup key={group.key} group={group} currency={cur} onRemove={remove} onOpen={(t) => router.push({ pathname: '/transaction/[id]', params: { id: t.id, wallet_id: t.wallet_id, to_wallet_id: t.to_wallet_id || '', type: t.type, amount: String(t.amount), category: t.category, note: t.note || '', date: (t.date || '').split('T')[0] } })} />)}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
