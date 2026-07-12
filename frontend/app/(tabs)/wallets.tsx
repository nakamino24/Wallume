import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoneyFull } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H1, H2, Body, Label, DisplayNumber, Button, EmptyState } from '@/src/components/ui';

const WALLET_META: Record<string, { icon: any; gradient: [string, string] }> = {
  cash:        { icon: 'cash-outline',         gradient: ['#10B981', '#064E3B'] },
  bank:        { icon: 'business-outline',     gradient: ['#18181B', '#3F3F46'] },
  credit_card: { icon: 'card-outline',         gradient: ['#F87171', '#7F1D1D'] },
  e_wallet:    { icon: 'phone-portrait-outline', gradient: ['#FBBF24', '#78350F'] },
  savings:     { icon: 'lock-closed-outline',  gradient: ['#34D399', '#065F46'] },
  investment:  { icon: 'trending-up-outline',  gradient: ['#A7F3D0', '#059669'] },
};

const TYPE_LABEL: Record<string, string> = {
  cash: 'Cash', bank: 'Bank', credit_card: 'Credit Card',
  e_wallet: 'E-Wallet', savings: 'Savings', investment: 'Investment',
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
  const total = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          <View style={{ padding: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <H1>Wallets</H1>
              <Body muted style={{ marginTop: 4 }}>Tap to edit · {wallets.length} accounts · {formatMoneyFull(total, cur)}</Body>
            </View>
            <TouchableOpacity testID="wallets-add-btn" onPress={() => router.push('/wallet/new')}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={22} color={colors.onBrand} />
            </TouchableOpacity>
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
  return (
    <TouchableOpacity
      testID={`wallet-card-${wallet.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
      style={[styles.card, { backgroundColor: meta.gradient[1] }]}
    >
      <View style={[styles.cardTop, { backgroundColor: meta.gradient[0] + '55' }]} />
      <View style={styles.cardHeader}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={meta.icon} size={20} color="#fff" />
        </View>
        <Body style={{ color: '#ffffffcc', fontFamily: font.textMedium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {TYPE_LABEL[wallet.type] || wallet.type}
        </Body>
      </View>
      <View style={styles.cardBody}>
        <Body style={{ color: '#ffffffaa', fontFamily: font.textMedium }}>{wallet.name}</Body>
        <DisplayNumber size={30} color="#fff" style={{ marginTop: 6 }}>
          {formatMoneyFull(wallet.balance || 0, wallet.currency || currency)}
        </DisplayNumber>
      </View>
    </TouchableOpacity>
  );
}

function confirmDelete(w: any, reload: () => void) {
  Alert.alert('Delete wallet', `Delete "${w.name}" and its transactions?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteWallet(w.id); reload(); } },
  ]);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    height: 180,
    padding: spacing.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBody: {},
});
