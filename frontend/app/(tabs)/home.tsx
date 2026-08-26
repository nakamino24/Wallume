import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, AppState, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { usePayday } from '@/src/hooks/use-payday';
import { spacing, radius, font, cv } from '@/src/theme/tokens';
import { t } from '@/src/lib/i18n';
import { useBalancePrivacy } from '@/src/privacy/BalancePrivacyProvider';
import { MoneyValue } from '@/src/components/MoneyValue';
import { api } from '@/src/api/client';
import { Screen, Card, H2, Body, Label, DisplayNumber, ProgressRing, Chip, EmptyState, Caption } from '@/src/components/ui';
import { Skeleton, SkeletonCard, SkeletonRow } from '@/src/components/Skeleton';
import { ErrorBanner } from '@/src/components/ErrorBanner';
import { refreshNetWorthWidget } from '@/src/widgets/refresh-widget';
import { useWallets } from '@/src/hooks/use-wallets';
import { useTransactions } from '@/src/hooks/use-transactions';

const CATEGORY_ICON: Record<string, any> = {
  Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle',
  Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
  Rent: 'home', Salary: 'cash', Other: 'ellipsis-horizontal',
};

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isBalanceVisible, toggleBalanceVisibility } = useBalancePrivacy();
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const { transactions: txs, remove: removeTransaction } = useTransactions();
  const { wallets } = useWallets();
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const { info: payday } = usePayday(user?.payday_day, user?.work_week);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const summaryResult = await api.summary().catch(() => null);
      const nextSummary = summaryResult;
      const updatedAt = Date.now();

      setSummary(nextSummary);
      setUpcoming([]);
      setLastSyncedAt(updatedAt);
      setInitialLoading(false);
      refreshNetWorthWidget();
    } catch {
      setLoadError('Could not load your data');
      setInitialLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Sync the home-screen widget when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshNetWorthWidget();
    });
    return () => sub.remove();
  }, []);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  // Delete a transaction inline, reusing the exact confirm pattern from
  // transactions.tsx so Home and the full list behave identically.
  const removeTx = useCallback((t: any) => {
    Alert.alert('Delete transaction?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            removeTransaction(t.id);
          } catch {}
        },
      },
    ]);
  }, [removeTransaction]);

  const cur = user?.currency || 'USD';
  const shownTxs = filter === 'all' ? txs : txs.filter((t) => t.type === filter);
  const walletBalance = wallets.reduce((sum: number, wallet: any) => sum + (Number(wallet.converted_balance ?? wallet.balance) || 0), 0);
  const monthIncome = txs.reduce((sum: number, tx: any) => sum + ((tx.type === 'income' && Number(tx.amount)) || 0), 0);
  const monthExpense = txs.reduce((sum: number, tx: any) => sum + ((tx.type === 'expense' && Number(tx.amount)) || 0), 0);
  // Home hero is Total Balance (wallet_total), not Net Worth. Widget shows the same wallet_total as Total Saldo.
  // True Net Worth (wallet + assets + investments - debts) is authoritative in summary.net_worth via AnalyticsService,
  // but Home hero must not mislabel wallet total as Net Worth.
  const derivedSummary = {
    total_balance: summary?.wallet_total ?? walletBalance,
    net_worth: summary?.net_worth ?? 0,
    month_income: summary?.month_income ?? monthIncome,
    month_expense: summary?.month_expense ?? monthExpense,
    cash_flow: summary?.cash_flow ?? (monthIncome - monthExpense),
    health_score: summary?.health_score ?? 0,
    saving_rate: summary?.saving_rate ?? 0,
    debt_ratio: summary?.debt_ratio ?? 0,
  };

  const insights = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthTxs = txs.filter((tx: any) => {
      const raw = tx.date || '';
      const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
      return !Number.isNaN(d.getTime()) && d >= monthStart && d <= monthEnd;
    });
    const expenses = monthTxs.filter((tx: any) => tx.type === 'expense');
    const categoryTotals = expenses.reduce((acc: Record<string, number>, tx: any) => {
      const key = tx.category || 'Other';
      acc[key] = (acc[key] || 0) + (Number(tx.amount) || 0);
      return acc;
    }, {});
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const largestExpense = expenses.reduce((best: any, tx: any) => {
      const amt = Number(tx.amount) || 0;
      return !best || amt > Number(best.amount) ? tx : best;
    }, null as any);
    const savingsRate = Math.round(summary?.saving_rate ?? 0);
    const tip = savingsRate >= 20
      ? 'You are building a healthy cash buffer.'
      : derivedSummary.month_expense > 0
        ? 'Trim one recurring expense to improve cash flow.'
        : 'Add a transaction to unlock personalized insights.';

    return {
      topCategory: topCategory ? topCategory[0] : 'No expenses',
      topCategoryValue: topCategory ? topCategory[1] : 0,
      largestExpense,
      savingsRate,
      tip,
    };
  }, [derivedSummary.month_expense, txs, summary]);

  if (initialLoading && !summary) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <Skeleton width={120} height={14} />
            <Skeleton width={100} height={22} style={{ marginTop: 4 }} />
          </View>
          <View style={{ padding: spacing.xl }}>
            <SkeletonCard />
          </View>
          <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', gap: spacing.md }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} width={80} height={80} style={{ borderRadius: radius.md, flex: 1 }} />)}
          </View>
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            <Skeleton width={120} height={16} />
            <SkeletonCard />
            <Skeleton width={140} height={16} />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          {/* Header */}
            <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body muted style={{ fontSize: font.sizes.sm }}>Welcome back</Body>
                <H2 style={{ marginTop: 2 }}>{user?.name?.split(' ')[0] || 'there'}</H2>
            </View>
            <TouchableOpacity testID="home-profile-btn" onPress={() => router.push('/profile')}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={18} color={colors.onBrandSoft} />
              </View>
            </TouchableOpacity>
          </View>

          {loadError && (
            <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
              <ErrorBanner message={loadError} onRetry={onRefresh} />
            </View>
          )}

          {/* Payday countdown */}
          {payday && (
            <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
              <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.7}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, backgroundColor: colors.surface3, borderColor: 'transparent' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: payday.isPaydayToday ? colors.success + '22' : colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                    <Ionicons name={payday.isPaydayToday ? 'gift' : 'calendar-outline'} size={18} color={payday.isPaydayToday ? colors.success : colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: font.textMedium, fontSize: font.sizes.sm }}>
                      {payday.isPaydayToday ? 'Payday today!' : `${payday.daysRemaining} days until payday`}
                    </Body>
                    <Caption muted>
                      {payday.nextDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Caption>
                  </View>
                  {!payday.isPaydayToday && (
                    <Body style={{ fontFamily: font.displayBold, fontSize: 18, color: colors.brandPrimary }}>{payday.daysRemaining}</Body>
                  )}
                </Card>
              </TouchableOpacity>
            </View>
          )}

          {/* Total Balance hero — wallet_total, not Net Worth */}
          <View style={{ padding: spacing.xl }}>
            <Card style={{ padding: spacing.xl, backgroundColor: colors.inverse, borderColor: 'transparent', borderRadius: radius.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label style={{ color: colors.onInverse, opacity: 0.6 }}>{t('total.balance')}</Label>
                <TouchableOpacity
                  testID="home-eye-toggle"
                  onPress={toggleBalanceVisibility}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name={isBalanceVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.onInverse} />
                </TouchableOpacity>
              </View>
              <MoneyValue
                value={derivedSummary.total_balance}
                currency={cur}
                privacy="financial"
                testID="home-total-balance"
                style={{ color: colors.onInverse, fontFamily: font.textBold, fontSize: 40, letterSpacing: -0.5, marginTop: 6 }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              />
              <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Income (mo)</Label>
                  <MoneyValue
                    value={derivedSummary.month_income}
                    currency={cur}
                    compact
                    privacy="financial"
                    testID="net-worth-income"
                    style={{ color: colors.success, fontFamily: font.textBold, fontSize: font.sizes.base, marginTop: 2 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Expense (mo)</Label>
                  <MoneyValue
                    value={-derivedSummary.month_expense}
                    currency={cur}
                    compact
                    privacy="financial"
                    testID="net-worth-expense"
                    style={{ color: colors.error, fontFamily: font.textBold, fontSize: font.sizes.base, marginTop: 2 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Cash flow</Label>
                  <MoneyValue
                    value={derivedSummary.cash_flow}
                    currency={cur}
                    compact
                    privacy="financial"
                    testID="net-worth-cash-flow"
                    style={{ color: colors.onInverse, fontFamily: font.textBold, fontSize: font.sizes.base, marginTop: 2 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  />
                </View>
              </View>
            </Card>
          </View>

          {/* Quick actions */}
          <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', gap: spacing.md }}>
            <QuickAction testID="home-add-income" icon="arrow-down" label="Income" color={colors.success}
              onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'income' } })} />
            <QuickAction testID="home-add-expense" icon="arrow-up" label="Expense" color={colors.error}
              onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'expense' } })} />
            <QuickAction testID="home-add-transfer" icon="swap-horizontal" label="Transfer" color={colors.brandPrimary}
              onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'transfer' } })} />
            <QuickAction testID="home-reports" icon="stats-chart" label="Reports" color={colors.warning}
              onPress={() => router.push('/reports')} />
          </View>

          {/* Smart insights */}
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <H2>Smart insights</H2>
                <Body muted>{lastSyncedAt ? `Updated ${formatTimeAgo(lastSyncedAt)}` : 'Cached'}</Body>
              </View>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <InsightPill label="Savings rate" value={`${insights.savingsRate}%`} color={colors.success} />
                  <InsightPill label="Top category" value={insights.topCategory} color={colors.warning} />
                </View>
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md }}>
                  <Body style={{ fontFamily: font.textBold }}>This month’s focus</Body>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                    {insights.largestExpense ? (
                      <>
                        <Body muted>{insights.largestExpense.category}: </Body>
                        <MoneyValue value={insights.largestExpense.amount} currency={cur} privacy="financial" style={{ color: colors.muted, fontFamily: font.textBold }} />
                      </>
                    ) : (
                      <Body muted>No major expense yet.</Body>
                    )}
                  </View>
                  <Body muted style={{ marginTop: 6 }}>{insights.tip}</Body>
                </View>
              </View>
            </Card>
          </View>

          {/* Health score */}
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                <ProgressRing progress={(derivedSummary.health_score ?? 0) / 100} size={78} stroke={10}>
                  <DisplayNumber size={22}>{derivedSummary.health_score ?? 0}</DisplayNumber>
                </ProgressRing>
                <View style={{ flex: 1 }}>
                  <Label>Financial Health Score</Label>
                  <H2 style={{ marginTop: 4 }}>{healthLabel(derivedSummary.health_score ?? 0)}</H2>
                  <Body muted style={{ marginTop: 4 }}>
                    Saving {derivedSummary.saving_rate ?? 0}% · Debt ratio {derivedSummary.debt_ratio ?? 0}%
                  </Body>
                </View>
              </View>
            </Card>
          </View>

          {/* Upcoming bills & subscriptions */}
          {upcoming.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <H2>Upcoming</H2>
                <TouchableOpacity testID="home-recurring-see-all" onPress={() => router.push('/recurring')}>
                  <Body style={{ color: colors.brandPrimary, fontFamily: font.textBold }}>See all</Body>
                </TouchableOpacity>
              </View>
              <Card style={{ padding: 0 }}>
                {upcoming.map((r, idx) => {
                  const overdue = r.days_until !== null && r.days_until < 0;
                  const dueSoon = r.days_until !== null && r.days_until >= 0 && r.days_until <= 3;
                  const dueColor = overdue ? colors.error : dueSoon ? colors.warning : colors.onSurface2;
                  const dueText = overdue ? `${Math.abs(r.days_until)}d overdue` : r.days_until === 0 ? 'Due today' : `in ${r.days_until}d`;
                  return (
                    <TouchableOpacity key={r.id} testID={`home-recurring-${r.id}`} onPress={() => router.push(`/recurring/${r.id}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: idx === upcoming.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: dueColor + '22', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                        <Ionicons name="calendar" size={18} color={dueColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontFamily: font.textMedium }}>{r.name}</Body>
                        <Body style={{ fontSize: 12, marginTop: 2, color: dueColor }}>{dueText}</Body>
                      </View>
                      <MoneyValue value={cv(r, 'amount')} currency={cur} privacy="financial" style={{ fontFamily: font.displayBold }} />
                    </TouchableOpacity>
                  );
                })}
              </Card>
            </View>
          )}

          {/* Filter chips */}
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <H2>Recent</H2>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Body style={{ color: colors.brandPrimary, fontFamily: font.textBold }}>See all</Body>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}
          >
            {(['all', 'income', 'expense', 'transfer'] as const).map((f) => (
              <Chip key={f} testID={`home-filter-${f}`} label={f[0].toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>

          {/* Transactions */}
          <View style={{ paddingHorizontal: spacing.xl }}>
            {shownTxs.length === 0 && wallets.length === 0 ? (
              <EmptyState
                testID="home-tx-empty"
                title="No transactions yet"
                subtitle="Track your first income or expense to see it here."
                actionLabel="Add transaction"
                onAction={() => router.push('/transaction/new')}
              />
            ) : (
              <Card style={{ padding: 0 }}>
                {shownTxs.length > 0 ? shownTxs.slice(0, 8).map((t, idx) => (
                  <TxRow
                    key={t.id}
                    tx={t}
                    last={idx === Math.min(shownTxs.length, 8) - 1}
                    currency={cur}
                    onPress={() => router.push({
                      pathname: '/transaction/[id]',
                      params: {
                        id: t.id,
                        wallet_id: t.wallet_id,
                        to_wallet_id: t.to_wallet_id || '',
                        type: t.type,
                        amount: String(t.amount),
                        category: t.category,
                        note: t.note || '',
                        date: (t.date || '').split('T')[0],
                      },
                    })}
                    onLongPress={() => removeTx(t)}
                  />
                )) : (
                  <View style={{ padding: spacing.xl }}>
                    <Body style={{ fontFamily: font.textMedium }}>Wallet balance available</Body>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                      <MoneyValue value={walletBalance} currency={cur} privacy="financial" style={{ color: colors.muted, fontFamily: font.textBold }} />
                      <Body muted> is ready to view from your wallets.</Body>
                    </View>
                  </View>
                )}
              </Card>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Floating add button */}
      <TouchableOpacity
        testID="home-fab"
        onPress={() => router.push('/transaction/new')}
        activeOpacity={0.9}
        style={[styles.fab, { backgroundColor: colors.brandPrimary, bottom: insets.bottom + spacing.xl }]}
      >
        <Ionicons name="add" size={28} color={colors.onBrand} />
      </TouchableOpacity>
    </Screen>
  );
}

function healthLabel(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Healthy';
  if (score >= 40) return 'Okay';
  if (score >= 20) return 'Needs work';
  return 'At risk';
}

function formatTimeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function InsightPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, minWidth: 132, backgroundColor: color + '14', borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
      <Body style={{ fontSize: 12, color }} numberOfLines={1}>{label}</Body>
      <Body style={{ fontFamily: font.displayBold, marginTop: 4 }} numberOfLines={1}>{value}</Body>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress, testID }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.85} style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.surface2, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Body numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 6, fontFamily: font.textMedium, fontSize: 12, textAlign: 'center' }}>
          {label}
        </Body>
      </View>
    </TouchableOpacity>
  );
}

function TxRow({ tx, last, currency, onPress, onLongPress }: any) {
  const { colors } = useTheme();
  const positive = tx.type === 'income';
  const negative = tx.type === 'expense';
  const iconName = CATEGORY_ICON[tx.category] || 'ellipsis-horizontal';
  const color = positive ? colors.success : negative ? colors.error : colors.brandPrimary;
  const amount = positive ? tx.amount : negative ? -Math.abs(tx.amount) : tx.amount;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} onLongPress={onLongPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
          <Ionicons name={tx.type === 'transfer' ? 'swap-horizontal' : iconName} size={18} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Body style={{ fontFamily: font.textMedium }} numberOfLines={1}>{tx.category}</Body>
          {!!tx.note && <Body muted style={{ fontSize: 12, marginTop: 2 }} numberOfLines={1}>{tx.note}</Body>}
        </View>
        <MoneyValue
          value={amount}
          currency={currency}
          privacy="financial"
          style={{ fontFamily: font.textBold, color: positive ? colors.success : negative ? colors.error : colors.onSurface }}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.15)',
    elevation: 8,
  },
});
