import React, { useCallback, useState, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { groupActivitiesByDay, walletActivityTitle } from '@/src/lib/activity';
import { Screen, Card, H2, Body, Label, EmptyState, Caption, Button } from '@/src/components/ui';
import { MoneyValue } from '@/src/components/MoneyValue';
import { useI18n } from '@/src/lib/I18nProvider';
import { intlLocale } from '@/src/lib/i18n';

const CATEGORY_ICON: Record<string, any> = {
  Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle',
  Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
  Rent: 'home', Salary: 'cash', Groceries: 'basket', Other: 'ellipsis-horizontal',
  Freelance: 'laptop', Investment: 'trending-up', Business: 'briefcase', Gift: 'gift',
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
  const { locale, t } = useI18n();

  const [wallet, setWallet] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [walletRes, txRes] = await Promise.all([
        api.wallets(),
        api.transactions(undefined, 50, id),
      ]);
      const w = (walletRes.wallets || []).find((x: any) => x.id === id);
      setWallet(w || null);
      setTxs(txRes.transactions || []);
    } catch (cause) {
      console.error('[WalletDetail] failed to load', cause);
      setError(t('wallet.detail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const removeTx = useCallback((transaction: any) => {
    Alert.alert(t('transactions.delete.title'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTransaction(transaction.id);
            setTxs((prev) => prev.filter((x) => x.id !== transaction.id));
          } catch {}
        },
      },
    ]);
  }, [t]);

  const cur = user?.currency || 'USD';
  const meta = wallet ? (TYPE_TINT[wallet.type] || '#6B7280') : '#6B7280';
  const icon = wallet ? (TYPE_ICON[wallet.type] || 'wallet-outline') : 'wallet-outline';

  const grouped = useMemo(() => groupActivitiesByDay(txs, {
    locale: intlLocale(locale),
    todayLabel: t('activity.today'),
    yesterdayLabel: t('activity.yesterday'),
  }), [locale, t, txs]);

  if (loading && !wallet) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <Body>{t('common.loading')}</Body>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  if (error || !wallet) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            <Body style={{ color: error ? colors.error : colors.onSurface }}>{error || t('wallet.detail.notFound')}</Body>
            <Button label={t('common.retry')} onPress={load} />
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
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <H2 style={{ flex: 1, marginLeft: spacing.md }}>{wallet.name}</H2>
            <TouchableOpacity testID="wallet-edit-btn" accessibilityRole="button" accessibilityLabel={t('wallet.detail.edit')} hitSlop={10} onPress={() => router.push({ pathname: '/wallet/edit/[id]', params: { id: wallet.id } })}>
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
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>{t('wallets.balance')}</Label>
                  <Body style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 13, marginTop: 2 }}>
                    {localizedWalletType(wallet.type, t)}
                  </Body>
                </View>
              </View>
              <MoneyValue value={wallet.converted_balance ?? (wallet.balance || 0)} currency={walletCur} privacy="balance" style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 32, marginTop: 4 }} />
              {wallet.currency && wallet.currency !== walletCur && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}><MoneyValue value={wallet.balance || 0} currency={wallet.currency} privacy="balance" style={{ color: colors.onInverse, opacity: 0.7, fontSize: 12 }} /><Caption style={{ color: colors.onInverse, opacity: 0.7 }}> · {wallet.currency}</Caption></View>
              )}
            </Card>
          </View>

          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <H2>{t('wallet.detail.activity')}</H2>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Body style={{ color: colors.brandPrimary, fontFamily: font.textBold }}>{t('wallet.detail.seeAll')}</Body>
            </TouchableOpacity>
          </View>

          {grouped.length === 0 ? (
            <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
              <EmptyState
                testID="wallet-activity-empty"
                title={t('wallet.detail.empty')}
                subtitle={t('wallet.detail.emptySubtitle')}
                actionLabel={t('add.transaction')}
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

function localizedWalletType(raw: string, translate: (key: string) => string) {
  const key = `wallet.type.${raw}`;
  const localized = translate(key);
  return localized === key ? raw : localized;
}

function ActivityRow({ tx, walletId, currency, last, onPress, onLongPress }: any) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const isSource = tx.wallet_id === walletId;
  const isDest = tx.to_wallet_id === walletId;

  let direction: 'IN' | 'OUT' = 'OUT';
  let displayAmount = Number(tx.converted_amount ?? tx.amount);

  if (tx.type === 'income') {
    direction = 'IN';
  } else if (tx.type === 'expense') {
    direction = 'OUT';
  } else if (tx.type === 'transfer') {
    if (isSource) {
      direction = 'OUT';
    } else if (isDest) {
      direction = 'IN';
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
            {walletActivityTitle(tx, walletId, t)}
          </Body>
          {!!tx.note && <Caption muted style={{ marginTop: 1 }}>{tx.note.length > 30 ? tx.note.slice(0, 30) + '…' : tx.note}</Caption>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <MoneyValue value={direction === 'IN' ? displayAmount : -Math.abs(displayAmount)} currency={currency} style={{ fontFamily: font.displayBold, color, fontSize: 14 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
