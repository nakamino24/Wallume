import React, { useCallback, useState, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, formatMoney, formatMoneyFull } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { groupActivitiesByDay } from '@/src/lib/activity';
import { Screen, Card, H2, Body, Label, EmptyState, Caption, DisplayNumber } from '@/src/components/ui';

const CATEGORY_ICON: Record<string, any> = {
  Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle',
  Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
  Rent: 'home', Salary: 'cash', Groceries: 'basket', Other: 'ellipsis-horizontal',
  Freelance: 'laptop', Investment: 'trending-up', Business: 'briefcase', Gift: 'gift',
};

const TYPE_LABEL: Record<string, string> = {
  cash: 'Cash', bank: 'Bank', credit_card: 'Credit Card',
  e_wallet: 'E-Wallet', savings: 'Savings', investment: 'Investment',
};

const TYPE_ICON: Record<string, any> = {
  cash: 'cash-outline', bank: 'business-outline', credit_card: 'card-outline',
  e_wallet: 'phone-portrait-outline', savings: 'lock-closed-outline', investment: 'trending-up-outline',
};

const TYPE_TINT: Record<string, string> = {
  cash: '#10B981', bank: '#3B82F6', credit_card: '#F59E0B',
  e_wallet: '#8B5CF6', savings: '#14B8A6', investment: '#22C55E',
};

export default function WalletDetail() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [wallet, setWallet] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        api.wallets(),
        api.transactions(undefined, 50, id),
      ]);
      const w = (walletRes.wallets || []).find((x: any) => x.id === id);
      if (w) setWallet(w);
      setTxs(txRes.transactions || []);
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const removeTx = useCallback((t: any) => {
    Alert.alert('Delete transaction?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTransaction(t.id);
            setTxs((prev) => prev.filter((x) => x.id !== t.id));
          } catch {}
        },
      },
    ]);
  }, []);

  const cur = user?.currency || 'USD';
  const meta = wallet ? (TYPE_TINT[wallet.type] || '#6B7280') : '#6B7280';
  const icon = wallet ? (TYPE_ICON[wallet.type] || 'wallet-outline') : 'wallet-outline';

  const grouped = useMemo(() => groupActivitiesByDay(txs), [txs]);

  if (!wallet) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <Body>Loading…</Body>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  const walletCur = wallet.home_currency || cur;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <H2 style={{ flex: 1, marginLeft: spacing.md }}>{wallet.name}</H2>
            <TouchableOpacity testID="wallet-edit-btn" onPress={() => router.push({ pathname: '/wallet/edit/[id]', params: { id: wallet.id } })}>
              <Ionicons name="create-outline" size={22} color={colors.brandPrimary} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Card style={{ backgroundColor: colors.inverse }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: meta + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={icon} size={20} color={meta} />
                </View>
                <View style={{ marginLeft: spacing.md }}>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Balance</Label>
                  <Body style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 13, marginTop: 2 }}>
                    {TYPE_LABEL[wallet.type] || wallet.type}
                  </Body>
                </View>
              </View>
              <DisplayNumber size={32} color={colors.onInverse} style={{ marginTop: 4 }}>
                {formatMoneyFull(wallet.converted_balance ?? (wallet.balance || 0), walletCur)}
              </DisplayNumber>
              {wallet.currency && wallet.currency !== walletCur && (
                <Caption style={{ color: colors.onInverse, opacity: 0.7, marginTop: 4 }}>
                  {formatMoneyFull(wallet.balance || 0, wallet.currency)} · {wallet.currency}
                </Caption>
              )}
            </Card>
          </View>

          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <H2>Recent Activity</H2>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Body style={{ color: colors.brandPrimary, fontFamily: font.textBold }}>See all</Body>
            </TouchableOpacity>
          </View>

          {grouped.length === 0 ? (
            <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
              <EmptyState
                testID="wallet-activity-empty"
                title="No activity yet"
                subtitle="Transactions for this wallet will appear here."
                actionLabel="Add transaction"
                onAction={() => router.push({ pathname: '/transaction/new', params: { wallet_id: wallet.id } })}
              />
            </View>
          ) : (
            <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
              {grouped.map(({ label, items }) => (
                <View key={label} style={{ marginBottom: spacing.lg }}>
                  <Label style={{ marginBottom: spacing.sm }}>{label}</Label>
                  <Card style={{ padding: 0 }}>
                    {items.map((t, idx) => (
                      <ActivityRow
                        key={t.id}
                        tx={t}
                        walletId={id!}
                        currency={walletCur}
                        last={idx === items.length - 1}
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
                    ))}
                  </Card>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function ActivityRow({ tx, walletId, currency, last, onPress, onLongPress }: any) {
  const { colors } = useTheme();

  const isSource = tx.wallet_id === walletId;
  const isDest = tx.to_wallet_id === walletId;

  let direction: 'IN' | 'OUT' = 'OUT';
  let displayAmount = Number(tx.amount);
  let counterparty: string | null = null;

  if (tx.type === 'income') {
    direction = 'IN';
  } else if (tx.type === 'expense') {
    direction = 'OUT';
  } else if (tx.type === 'transfer') {
    if (isSource) {
      direction = 'OUT';
      counterparty = tx.to_wallet_name || 'Transfer out';
    } else if (isDest) {
      direction = 'IN';
      counterparty = tx.wallet_name || 'Transfer in';
    }
  }

  const color = direction === 'IN' ? colors.success : colors.error;
  const iconName = tx.type === 'transfer' ? 'swap-horizontal' : (CATEGORY_ICON[tx.category] || 'ellipsis-horizontal');

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} onLongPress={onLongPress}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', padding: spacing.md,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
      }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
          <Ionicons name={iconName} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Body style={{ fontFamily: font.textMedium, fontSize: 14 }}>
            {tx.type === 'transfer' ? (counterparty || 'Transfer') : tx.category}
          </Body>
          {!!tx.note && <Caption muted style={{ marginTop: 1 }}>{tx.note.length > 30 ? tx.note.slice(0, 30) + '…' : tx.note}</Caption>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Body style={{ fontFamily: font.displayBold, color, fontSize: 14 }}>
            {direction === 'IN' ? '+' : '-'}{formatMoney(displayAmount, currency)}
          </Body>
        </View>
      </View>
    </TouchableOpacity>
  );
}
