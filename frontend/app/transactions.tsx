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
import { useI18n } from '@/src/lib/I18nProvider';

export default function Transactions() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const { transactions: txs, loading, error, refresh, remove: removeTransaction } = useTransactions();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const shown = filter === 'all' ? txs : txs.filter((t) => t.type === filter);
  const dayGroups = groupTransactionsByDate(shown);
  const cur = user?.currency || 'USD';

  const remove = (tx: any) => {
    Alert.alert(t('transactions.delete.title'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        removeTransaction(tx.id);
      } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md, flex: 1 }}>{t('transactions.heading')}</H2>
          <TouchableOpacity testID="tx-add-fab" accessibilityRole="button" accessibilityLabel={t('transactions.empty.action')} onPress={() => router.push('/transaction/new')}
            style={{ width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={20} color={colors.onBrand} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}>
          {(['all', 'income', 'expense', 'transfer'] as const).map((f) => (
            <Chip key={f} testID={`tx-filter-${f}`} label={f === 'all' ? t('common.all') ?? 'All' : t(`transactions.type.${f}`)} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 60, gap: spacing.sm }}>
          {loading ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <Body muted>{t('common.loading')}</Body>
            </View>
          ) : error ? (
            <View style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xl }}>
              <Body style={{ color: colors.error, textAlign: 'center' }}>{error}</Body>
              <TouchableOpacity onPress={refresh} style={{ paddingVertical: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: 8 }}>
                <Body style={{ color: colors.onBrand, fontFamily: font.textBold }}>{t('common.retry')}</Body>
              </TouchableOpacity>
            </View>
          ) : shown.length === 0 ? (
            <EmptyState testID="tx-empty" title={t('transactions.empty.title')} subtitle={t('transactions.empty.subtitle')} actionLabel={t('transactions.empty.action')} onAction={() => router.push('/transaction/new')} />
          ) : dayGroups.map((group) => <TransactionDayGroup key={group.key} group={group} currency={cur} onRemove={remove} onOpen={(t) => router.push({ pathname: '/transaction/[id]', params: { id: t.id, wallet_id: t.wallet_id, to_wallet_id: t.to_wallet_id || '', type: t.type, amount: String(t.amount), category: t.category, note: t.note || '', date: (t.date || '').split('T')[0] } })} />)}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
