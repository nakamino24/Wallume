import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H1, Body, EmptyState, Caption } from '@/src/components/ui';
import { MoneyValue } from '@/src/components/MoneyValue';
import { confirmAction } from '@/src/utils/confirm';
import { useWallets } from '@/src/hooks/use-wallets';
import { t as translate } from '@/src/lib/i18n';
import { useI18n } from '@/src/lib/I18nProvider';

const WALLET_META: Record<string, { icon: any; tint: string }> = {
  cash: { icon: 'cash-outline', tint: '#10B981' },
  bank: { icon: 'business-outline', tint: '#3B82F6' },
  credit_card: { icon: 'card-outline', tint: '#F59E0B' },
  e_wallet: { icon: 'phone-portrait-outline', tint: '#8B5CF6' },
  savings: { icon: 'lock-closed-outline', tint: '#14B8A6' },
  investment: { icon: 'trending-up-outline', tint: '#22C55E' },
};

export default function Wallets() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const { wallets, loading, error, refresh } = useWallets();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const cur = user?.currency || 'USD';
  const total = wallets.reduce((s, w) => s + (Number(w.converted_balance ?? w.balance) || 0), 0);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <H1>{t('wallets.heading')}</H1>
              <Body muted style={{ marginTop: 4 }}>{t('wallets.subtitle')}</Body>
            </View>
            <TouchableOpacity testID="wallets-add-btn" accessibilityRole="button" accessibilityLabel={t('wallets.empty.action')} onPress={() => router.push('/wallet/new')}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={22} color={colors.onBrand} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
              <View style={[styles.summary, { backgroundColor: colors.brandSoft, borderColor: 'transparent', borderRadius: radius.lg }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ color: colors.onBrandSoft, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.72 }}>{t('wallets.totalBalance')}</Body>
                    <MoneyValue value={total} currency={cur} privacy="balance" style={{ color: colors.onBrandSoft, fontFamily: font.textBold, fontSize: 24, marginTop: 6 }} />
                </View>
                <View style={[styles.pill, { backgroundColor: colors.brandSoft }]}> 
                  <Body style={{ color: colors.onBrandSoft, fontFamily: font.textBold, fontSize: 12 }}>{t('wallets.accountCount', { count: wallets.length })}</Body>
                </View>
              </View>

              <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.onBrandSoft + '2E' }}>
                <Body style={{ color: colors.onBrandSoft, fontFamily: font.textBold, fontSize: 13 }}>{t('wallets.quickActions')}</Body>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                  <TouchableOpacity onPress={() => router.push('/transaction/new')} style={[styles.actionBtn, { backgroundColor: colors.brandSoft }]}> 
                    <Ionicons name="add-circle-outline" size={16} color={colors.onBrandSoft} />
                    <Body style={{ color: colors.onBrandSoft, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>{t('add.transaction')}</Body>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/goal/new')} style={[styles.actionBtn, { backgroundColor: colors.surface3 }]}> 
                    <Ionicons name="flag-outline" size={16} color={colors.onSurface} />
                    <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>{t('goals.empty.action')}</Body>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/budget/new')} style={[styles.actionBtn, { backgroundColor: colors.surface3 }]}> 
                    <Ionicons name="pie-chart-outline" size={16} color={colors.onSurface} />
                    <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>{t('budgets.empty.action')}</Body>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/recurring/new')} style={[styles.actionBtn, { backgroundColor: colors.surface3 }]}> 
                    <Ionicons name="repeat-outline" size={16} color={colors.onSurface} />
                    <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>{t('bills')}</Body>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
              {[0, 1, 2].map((k) => (
                <View key={k} style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border, opacity: 0.5 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface3 }} />
                    <View style={{ marginLeft: spacing.md, flex: 1, gap: 6 }}>
                      <View style={{ height: 14, width: '40%', backgroundColor: colors.surface3, borderRadius: 4 }} />
                      <View style={{ height: 10, width: '25%', backgroundColor: colors.surface3, borderRadius: 4 }} />
                    </View>
                  </View>
                  <View style={{ marginTop: spacing.md, height: 10, width: '20%', backgroundColor: colors.surface3, borderRadius: 4 }} />
                  <View style={{ marginTop: 6, height: 18, width: '35%', backgroundColor: colors.surface3, borderRadius: 4 }} />
                </View>
              ))}
            </View>
          ) : error ? (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
              <Body style={{ color: colors.error, textAlign: 'center' }}>{error}</Body>
              <TouchableOpacity onPress={refresh}
                style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: radius.md }}>
                <Body style={{ color: colors.onBrand, fontFamily: font.textBold }}>{t('common.retry')}</Body>
              </TouchableOpacity>
            </View>
          ) : wallets.length === 0 ? (
            <EmptyState
              testID="wallets-empty"
              title={t('wallets.empty.title')}
              subtitle={t('wallets.empty.subtitle')}
              actionLabel={t('wallets.empty.action')}
              onAction={() => router.push('/wallet/new')}
            />
          ) : (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
              {wallets.map((w) => (
                <WalletCard key={w.id} wallet={w} currency={cur}
                  onPress={() => router.push({ pathname: '/wallet/[id]', params: { id: w.id } })}
                  onLongPress={() => confirmDelete(w, refresh)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function WalletCard({ wallet, currency, onLongPress, onPress }: any) {
  const meta = WALLET_META[wallet.type] || WALLET_META.cash;
  const { colors } = useTheme();

  const pocketKey = `wallets.pocket.${wallet.type}`;
  const pocketLabel = translate(pocketKey) === pocketKey ? translate('wallets.pocket.account') : translate(pocketKey);
  const typeKey = `wallet.type.${wallet.type}`;
  const typeLabel = translate(typeKey) === typeKey ? wallet.type : translate(typeKey);
  return (
    <TouchableOpacity
      testID={`wallet-card-${wallet.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
      style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[styles.iconBadge, { backgroundColor: meta.tint + '18' }]}>
            <Ionicons name={meta.icon} size={18} color={meta.tint} />
          </View>
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Body style={{ fontFamily: font.textBold }}>{wallet.name}</Body>
            <Body muted style={{ marginTop: 2, fontSize: 12 }}>{typeLabel}</Body>
          </View>
        </View>
        <View style={[styles.pill, { backgroundColor: meta.tint + '14' }]}> 
          <Body style={{ color: meta.tint, fontFamily: font.textBold, fontSize: 11 }}>{pocketLabel}</Body>
        </View>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Body muted style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7 }}>{translate('wallets.balance')}</Body>
        <MoneyValue
          testID={`wallet-balance-${wallet.id}`}
          value={wallet.converted_balance ?? (wallet.balance || 0)}
          currency={wallet.home_currency || currency}
          privacy="balance"
          style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 22, marginTop: 4 }}
        />
        {wallet.currency && wallet.currency !== (wallet.home_currency || currency) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <MoneyValue value={wallet.balance || 0} currency={wallet.currency} privacy="balance" style={{ color: colors.muted, fontSize: 12 }} />
            <Caption muted> · {wallet.currency}</Caption>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function confirmDelete(w: any, reload: () => void) {
  confirmAction(
    translate('wallets.delete.title'),
    translate('wallets.delete.message', { name: w.name }),
    async () => { await api.deleteWallet(w.id); reload(); },
    { confirmLabel: translate('common.delete'), destructive: true },
  );
}

const styles = StyleSheet.create({
  summary: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
