import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoneyFull, formatMoney } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, DisplayNumber, ProgressRing, ProgressBar, Chip, EmptyState, IconBadge } from '@/src/components/ui';

const CATEGORY_ICON: Record<string, any> = {
  Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle',
  Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
  Rent: 'home', Salary: 'cash', Other: 'ellipsis-horizontal',
};

export default function Home() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t, r] = await Promise.all([api.summary(), api.transactions(), api.recurring().catch(() => ({ recurring: [] }))]);
      setSummary(s);
      setTxs(t.transactions || []);
      setUpcoming((r.recurring || []).filter((x: any) => x.active).slice(0, 3));
    } catch (e) {
      // ignore
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const cur = user?.currency || 'USD';
  const shownTxs = filter === 'all' ? txs : txs.filter((t) => t.type === filter);

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
                {formatMoneyFull(summary?.net_worth ?? 0, cur)}
              </DisplayNumber>
              <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.xl }}>
                <View>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Income (mo)</Label>
                  <Body style={{ color: colors.success, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                    +{formatMoney(summary?.month_income ?? 0, cur)}
                  </Body>
                </View>
                <View>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Expense (mo)</Label>
                  <Body style={{ color: colors.error, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                    -{formatMoney(summary?.month_expense ?? 0, cur)}
                  </Body>
                </View>
                <View>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Cash flow</Label>
                  <Body style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                    {formatMoney(summary?.cash_flow ?? 0, cur)}
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

          {/* Health score */}
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                <ProgressRing progress={(summary?.health_score ?? 0) / 100} size={78} stroke={10}>
                  <DisplayNumber size={22}>{summary?.health_score ?? 0}</DisplayNumber>
                </ProgressRing>
                <View style={{ flex: 1 }}>
                  <Label>Financial Health Score</Label>
                  <H2 style={{ marginTop: 4 }}>{healthLabel(summary?.health_score ?? 0)}</H2>
                  <Body muted style={{ marginTop: 4 }}>
                    Saving {summary?.saving_rate ?? 0}% · Debt ratio {summary?.debt_ratio ?? 0}%
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
            {shownTxs.length === 0 ? (
              <EmptyState
                testID="home-tx-empty"
                title="No transactions yet"
                subtitle="Track your first income or expense to see it here."
                actionLabel="Add transaction"
                onAction={() => router.push('/transaction/new')}
              />
            ) : (
              <Card style={{ padding: 0 }}>
                {shownTxs.slice(0, 8).map((t, idx) => (
                  <TxRow key={t.id} tx={t} last={idx === Math.min(shownTxs.length, 8) - 1} currency={cur} />
                ))}
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
});
