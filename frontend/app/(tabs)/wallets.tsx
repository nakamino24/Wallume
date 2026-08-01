import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoneyFull } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H1, Body, DisplayNumber, EmptyState, Caption } from '@/src/components/ui';
import { confirmAction } from '@/src/utils/confirm';

const WALLET_META: Record<string, { icon: any; tint: string }> = {
  cash: { icon: 'cash-outline', tint: '#10B981' },
  bank: { icon: 'business-outline', tint: '#3B82F6' },
  credit_card: { icon: 'card-outline', tint: '#F59E0B' },
  e_wallet: { icon: 'phone-portrait-outline', tint: '#8B5CF6' },
  savings: { icon: 'lock-closed-outline', tint: '#14B8A6' },
  investment: { icon: 'trending-up-outline', tint: '#22C55E' },
};

const TYPE_LABEL: Record<string, string> = {
  cash: 'Cash', bank: 'Bank', credit_card: 'Credit Card',
  e_wallet: 'E-Wallet', savings: 'Savings', investment: 'Investment',
};

const POCKET_HINTS: Record<string, string> = {
  bank: 'Pocket',
  savings: 'Pocket',
  e_wallet: 'Service',
  cash: 'Vault',
  credit_card: 'Card',
  investment: 'Bucket',
};

export default function Wallets() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.wallets();
      setWallets(r.wallets || []);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

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
              <H1>Wallets</H1>
              <Body muted style={{ marginTop: 4 }}>Manage your accounts at a glance</Body>
            </View>
            <TouchableOpacity testID="wallets-add-btn" onPress={() => router.push('/wallet/new')}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={22} color={colors.onBrand} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
            <View style={[styles.summary, { backgroundColor: colors.surface2, borderColor: colors.border }]}> 
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Body muted style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Total balance</Body>
                  <DisplayNumber size={24} style={{ marginTop: 6 }}>{formatMoneyFull(total, cur)}</DisplayNumber>
                </View>
                <View style={[styles.pill, { backgroundColor: colors.brandSoft }]}> 
                  <Body style={{ color: colors.onBrandSoft, fontFamily: font.textBold, fontSize: 12 }}>{wallets.length} accounts</Body>
                </View>
              </View>

              <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Body style={{ fontFamily: font.textBold, fontSize: 13 }}>Quick actions</Body>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                  <TouchableOpacity onPress={() => router.push('/transaction/new')} style={[styles.actionBtn, { backgroundColor: colors.brandSoft }]}> 
                    <Ionicons name="add-circle-outline" size={16} color={colors.onBrandSoft} />
                    <Body style={{ color: colors.onBrandSoft, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>Add transaction</Body>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/goal/new')} style={[styles.actionBtn, { backgroundColor: colors.surface3 }]}> 
                    <Ionicons name="flag-outline" size={16} color={colors.onSurface} />
                    <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>Set savings goal</Body>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/budget/new')} style={[styles.actionBtn, { backgroundColor: colors.surface3 }]}> 
                    <Ionicons name="pie-chart-outline" size={16} color={colors.onSurface} />
                    <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>Set budget</Body>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/recurring/new')} style={[styles.actionBtn, { backgroundColor: colors.surface3 }]}> 
                    <Ionicons name="repeat-outline" size={16} color={colors.onSurface} />
                    <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 12, marginLeft: 6 }}>Add recurring</Body>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {wallets.length === 0 ? (
            <EmptyState
              testID="wallets-empty"
              title="No wallets yet"
              subtitle="Add cash, bank, credit card or e-wallet accounts to track your money."
              actionLabel="Add your first wallet"
              onAction={() => router.push('/wallet/new')}
            />
          ) : (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
              {wallets.map((w) => (
                <WalletCard key={w.id} wallet={w} currency={cur}
                  onPress={() => router.push({ pathname: '/wallet/[id]', params: { id: w.id } })}
                  onLongPress={() => confirmDelete(w, load)}
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

  const pocketLabel = POCKET_HINTS[wallet.type] || 'Account';
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
            <Body muted style={{ marginTop: 2, fontSize: 12 }}>{TYPE_LABEL[wallet.type] || wallet.type}</Body>
          </View>
        </View>
        <View style={[styles.pill, { backgroundColor: meta.tint + '14' }]}> 
          <Body style={{ color: meta.tint, fontFamily: font.textBold, fontSize: 11 }}>{pocketLabel}</Body>
        </View>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Body muted style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7 }}>Balance</Body>
        <DisplayNumber size={22} style={{ marginTop: 4 }}>
          {formatMoneyFull(wallet.converted_balance ?? (wallet.balance || 0), wallet.home_currency || currency)}
        </DisplayNumber>
        {wallet.currency && wallet.currency !== (wallet.home_currency || currency) && (
          <Caption muted style={{ marginTop: 2 }}>{formatMoneyFull(wallet.balance || 0, wallet.currency)} · {wallet.currency}</Caption>
        )}
      </View>
    </TouchableOpacity>
  );
}

function confirmDelete(w: any, reload: () => void) {
  confirmAction(
    'Delete wallet',
    `Delete "${w.name}" and its transactions?`,
    async () => { await api.deleteWallet(w.id); reload(); },
    { confirmLabel: 'Delete', destructive: true },
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
