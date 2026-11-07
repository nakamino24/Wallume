import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, radius } from '@/src/theme/tokens';
import { Screen, H2, Body, Chip, EmptyState, Button } from '@/src/components/ui';
import { ErrorBanner } from '@/src/components/ErrorBanner';
import { useTransactions } from '@/src/hooks/use-transactions';
import { useTransactionQuery } from '@/src/hooks/use-transaction-query';
import { useWallets } from '@/src/hooks/use-wallets';
import { groupTransactionsByDate, TransactionDayGroup } from '@/src/components/transactions/TransactionDayGroup';
import { useI18n } from '@/src/lib/I18nProvider';

const TYPES = ['all', 'income', 'expense', 'transfer'] as const;
const SEARCH_DEBOUNCE_MS = 300;

export default function Transactions() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const { transactions: recent, failed, refresh, retry, dismissFailed, remove: removeTransaction } = useTransactions();
  const { wallets } = useWallets();

  const [filter, setFilter] = useState<typeof TYPES[number]>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [walletId, setWalletId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Debounce keystrokes so a query fires after typing settles, not per letter.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const isFiltered = filter !== 'all' || !!search.trim() || !!walletId;

  const query = useTransactionQuery(
    { type: filter, search, wallet_id: walletId },
    true,
  );
  const { transactions: fetched, loading, loadingMore, error, hasMore, reload, loadMore } = query;

  // Unfiltered view keeps using the optimistic store so a just-created
  // transaction appears instantly; filtered views must be server-driven.
  const shown = isFiltered ? fetched : recent;

  useFocusEffect(useCallback(() => {
    if (isFiltered) { void reload(); }
  }, [isFiltered, reload]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isFiltered) await reload();
      else await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [isFiltered, reload, refresh]);

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

  const clearFilters = () => {
    setFilter('all');
    setSearchInput('');
    setSearch('');
    setWalletId('');
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md, flex: 1 }}>{t('transactions.heading')}</H2>
          <TouchableOpacity testID="tx-import-btn" accessibilityRole="button" accessibilityLabel={t('import.title')} onPress={() => router.push('/transaction/import')}
            style={{ width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity testID="tx-add-fab" accessibilityRole="button" accessibilityLabel={t('transactions.empty.action')} onPress={() => router.push('/transaction/new')}
            style={{ width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={20} color={colors.onBrand} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: colors.surface3, borderRadius: radius.md, paddingHorizontal: spacing.md,
          }}>
            <Ionicons name="search" size={16} color={colors.onSurface3} />
            <TextInput
              testID="tx-search"
              accessibilityLabel={t('transactions.search')}
              placeholder={t('transactions.search')}
              placeholderTextColor={colors.onSurface3}
              value={searchInput}
              onChangeText={setSearchInput}
              style={{ flex: 1, paddingVertical: 10, color: colors.onSurface, fontFamily: font.text, fontSize: font.sizes.base }}
            />
            {searchInput.length > 0 && (
              <TouchableOpacity testID="tx-search-clear" accessibilityRole="button" accessibilityLabel={t('transactions.clearFilters')} hitSlop={8} onPress={() => { setSearchInput(''); setSearch(''); }}>
                <Ionicons name="close-circle" size={16} color={colors.onSurface3} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/*
          Layout invariants (regression: chips stretched into giant vertical
          capsules when the filter state or loading state changed):

          - `flexGrow: 0` — RN's ScrollView applies `flexGrow: 1` for BOTH
            orientations (ScrollView.js baseHorizontal), so a horizontal
            ScrollView inside a column parent absorbs all leftover vertical
            space. The toolbar must size to its content.
          - `flexShrink: 0` — it must not be squeezed when the transaction list
            below it grows.
          - `alignItems: 'center'` on the content container — flexbox defaults
            to `stretch` on the cross axis, which is vertical in a row, so each
            Chip was stretched to the flexible container's full height. This is
            what produced the tall capsules.

          Every other horizontal chip row in the app already carries these
          constraints; this screen was the outlier.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}>
          {TYPES.map((f) => (
            <Chip key={f} testID={`tx-filter-${f}`} label={f === 'all' ? t('common.all') ?? 'All' : t(`transactions.type.${f}`)} active={filter === f} onPress={() => setFilter(f)} />
          ))}
          {wallets.length > 0 && (
            <Chip
              testID="tx-filter-wallet-toggle"
              label={walletId ? (wallets.find((w: any) => w.id === walletId)?.name || t('transaction.wallet')) : t('transaction.wallet')}
              active={!!walletId}
              onPress={() => {
                if (!walletId) { setWalletId(wallets[0]?.id || ''); return; }
                const idx = wallets.findIndex((w: any) => w.id === walletId);
                setWalletId(idx === wallets.length - 1 ? '' : wallets[idx + 1].id);
              }}
            />
          )}
          {isFiltered && (
            <Chip testID="tx-clear-filters" label={t('transactions.clearFilters')} active={false} onPress={clearFilters} />
          )}
        </ScrollView>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 60, gap: spacing.sm }}>
          {failed.length > 0 && (
            <ErrorBanner
              message={t('transactions.unsaved', { count: failed.length }) + ' — ' + t('common.error')}
              onRetry={() => failed.forEach((m) => retry(m.clientMutationId))}
              onDismiss={() => failed.forEach((m) => dismissFailed(m.clientMutationId))}
            />
          )}
          {loading ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
              <Body muted>{t('common.loading')}</Body>
            </View>
          ) : error ? (
            <View style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xl }}>
              <Body style={{ color: colors.error, textAlign: 'center' }}>{error}</Body>
              <TouchableOpacity onPress={reload} style={{ paddingVertical: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: 8 }}>
                <Body style={{ color: colors.onBrand, fontFamily: font.textBold }}>{t('common.retry')}</Body>
              </TouchableOpacity>
            </View>
          ) : shown.length === 0 ? (
            isFiltered ? (
              <EmptyState
                testID="tx-empty-filtered"
                title={t('transactions.noResults')}
                subtitle={t('transactions.noResults.subtitle')}
                actionLabel={t('transactions.clearFilters')}
                onAction={clearFilters}
              />
            ) : (
              <EmptyState testID="tx-empty" title={t('transactions.empty.title')} subtitle={t('transactions.empty.subtitle')} actionLabel={t('transactions.empty.action')} onAction={() => router.push('/transaction/new')} />
            )
          ) : dayGroups.map((group) => <TransactionDayGroup key={group.key} group={group} currency={cur} onRemove={remove} onOpen={(tx) => router.push({ pathname: '/transaction/[id]', params: { id: tx.id, wallet_id: tx.wallet_id, to_wallet_id: tx.to_wallet_id || '', type: tx.type, amount: String(tx.amount), converted_amount: String(tx.converted_amount ?? tx.amount), category: tx.category, merchant: tx.merchant || '', note: tx.note || '', date: (tx.date || '').split('T')[0] } })} />)}

          {isFiltered && hasMore && (
            <Button
              testID="tx-load-more"
              variant="secondary"
              label={loadingMore ? t('transactions.loadingMore') : t('transactions.loadMore')}
              loading={loadingMore}
              onPress={loadMore}
              style={{ marginTop: spacing.md }}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
