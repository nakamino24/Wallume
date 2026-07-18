import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoneyFull, formatMoney } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { storage } from '@/src/utils/storage';
import { Screen, Card, H1, H2, Body, Label, DisplayNumber, ProgressRing, Chip, EmptyState } from '@/src/components/ui';

const CATEGORY_ICON: Record<string, any> = {
  Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle',
  Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
  Rent: 'home', Salary: 'cash', Other: 'ellipsis-horizontal',
};
const HOME_CACHE_KEY = 'mf.home.cache.v1';

type HomeCachePayload = {
  summary: any;
  txs: any[];
  wallets: any[];
  updatedAt: number;
};

export default function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const load = useCallback(async (useCache = true) => {
    if (useCache) {
      const cached = await storage.getItem<HomeCachePayload | null>(HOME_CACHE_KEY, null);
      if (cached) {
        setSummary(cached.summary ?? null);
        setTxs(cached.txs ?? []);
        setWallets(cached.wallets ?? []);
        setUpcoming([]);
        setLastSyncedAt(cached.updatedAt ?? null);
      }
    }

    try {
      const [summaryResult, txResult, walletResult] = await Promise.allSettled([
        api.summary().catch(() => null),
        api.transactions().catch(() => ({ transactions: [] })),
        api.wallets().catch(() => ({ wallets: [] })),
      ]);

      const nextSummary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
      const nextTxs = txResult.status === 'fulfilled' ? (txResult.value?.transactions || []) : [];
      const nextWallets = walletResult.status === 'fulfilled' ? (walletResult.value?.wallets || []) : [];
      const updatedAt = Date.now();

      setSummary(nextSummary);
      setTxs(nextTxs);
      setWallets(nextWallets);
      setUpcoming([]);
      setLastSyncedAt(updatedAt);
      await storage.setItem(HOME_CACHE_KEY, { summary: nextSummary, txs: nextTxs, wallets: nextWallets, updatedAt });
    } catch {
      // keep cached state intact if network fails
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(true); setRefreshing(false); }, [load]);

  const cur = user?.currency || 'USD';
  const shownTxs = filter === 'all' ? txs : txs.filter((t) => t.type === filter);
  const walletBalance = wallets.reduce((sum: number, wallet: any) => sum + (Number(wallet.balance) || 0), 0);
  const monthIncome = txs.reduce((sum: number, tx: any) => sum + ((tx.type === 'income' && Number(tx.amount)) || 0), 0);
  const monthExpense = txs.reduce((sum: number, tx: any) => sum + ((tx.type === 'expense' && Number(tx.amount)) || 0), 0);
  const derivedSummary = {
    net_worth: summary?.net_worth ?? walletBalance,
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
      const d = new Date(tx.date);
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
  }, [derivedSummary.month_expense, derivedSummary.month_income, txs, summary]);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          {/* Header */}
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Body muted>Welcome back</Body>
              <H2 style={{ marginTop: 2 }}>{user?.name?.split(' ')[0] || 'there'}</H2>
            </View>
            <TouchableOpacity testID="home-profile-btn" onPress={() => router.push('/profile')}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={18} color={colors.onBrandSoft} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Net Worth hero */}
          <View style={{ padding: spacing.xl }}>
            <Card style={{ padding: spacing.xl, backgroundColor: colors.inverse }}>
              <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Net worth</Label>
              <DisplayNumber size={40} color={colors.onInverse} style={{ marginTop: 6 }}>
                {formatMoneyFull(derivedSummary.net_worth, cur)}
              </DisplayNumber>
              <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.xl }}>
                <View>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Income (mo)</Label>
                  <Body style={{ color: colors.success, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                    +{formatMoney(derivedSummary.month_income, cur)}
                  </Body>
                </View>
                <View>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Expense (mo)</Label>
                  <Body style={{ color: colors.error, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                    -{formatMoney(derivedSummary.month_expense, cur)}
                  </Body>
                </View>
                <View>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Cash flow</Label>
                  <Body style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                    {formatMoney(derivedSummary.cash_flow, cur)}
                  </Body>
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
                  <Body muted style={{ marginTop: 4 }}>
                    {insights.largestExpense ? `${insights.largestExpense.category}: ${formatMoney(insights.largestExpense.amount, cur)}` : 'No major expense yet.'}
                  </Body>
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
                      <Body style={{ fontFamily: font.displayBold }}>{formatMoney(r.amount, cur)}</Body>
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
                  <TxRow key={t.id} tx={t} last={idx === Math.min(shownTxs.length, 8) - 1} currency={cur} />
                )) : (
                  <View style={{ padding: spacing.xl }}>
                    <Body style={{ fontFamily: font.textMedium }}>Wallet balance available</Body>
                    <Body muted style={{ marginTop: 4 }}>
                      {formatMoneyFull(walletBalance, cur)} is ready to view from your wallets.
                    </Body>
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
        style={[styles.fab, { backgroundColor: colors.brandPrimary }]}
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

function TxRow({ tx, last, currency }: any) {
  const { colors } = useTheme();
  const positive = tx.type === 'income';
  const negative = tx.type === 'expense';
  const iconName = CATEGORY_ICON[tx.category] || 'ellipsis-horizontal';
  const color = positive ? colors.success : negative ? colors.error : colors.brandPrimary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={tx.type === 'transfer' ? 'swap-horizontal' : iconName} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Body style={{ fontFamily: font.textMedium }}>{tx.category}</Body>
        {!!tx.note && <Body muted style={{ fontSize: 12, marginTop: 2 }} numberOfLines={1}>{tx.note}</Body>}
      </View>
      <Body style={{ fontFamily: font.displayBold, color: positive ? colors.success : negative ? colors.error : colors.onSurface }}>
        {positive ? '+' : negative ? '-' : ''}{formatMoney(tx.amount, currency)}
      </Body>
    </View>
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
