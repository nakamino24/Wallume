import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { Button, Body, Label, Chip, Input } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { useWallets } from '@/src/hooks/use-wallets';
import { useTransactions } from '@/src/hooks/use-transactions';
import { DateField } from '@/src/components/DateField';
import { CategorySelector } from '@/src/components/CategorySelector';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { todayLocalISO } from '@/src/utils/dates';
import { useI18n } from '@/src/lib/I18nProvider';
import { findMatch, loadStore, normalize, saveStore } from '@/src/utils/merchant-engine';

export default function NewTransaction() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { getOptions } = useUserCategories();
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>((params.type as any) || 'expense');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Bills');
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [note, setNote] = useState('');
  const { wallets, loading: walletsLoading, error: walletsError, refresh: refreshWallets } = useWallets();
  const { create } = useTransactions();
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [date, setDate] = useState(() => todayLocalISO());
  const [err, setErr] = useState('');
  const [loading] = useState(false);

  // Auto-select first wallets when cache populates
  useEffect(() => {
    if (wallets.length > 0) {
      if (!walletId && wallets[0]) setWalletId(wallets[0].id);
      if (!toWalletId && wallets[1]) setToWalletId(wallets[1].id);
    }
  }, [wallets, walletId, toWalletId]);

  useEffect(() => {
    if (!hasManuallySelectedCategory) {
      setCategory(getOptions(type === 'transfer' ? 'expense' : type)[0]);
    }
  }, [type, getOptions, hasManuallySelectedCategory]);

  // Debounced auto-categorization
  useEffect(() => {
    if (!merchant.trim() || hasManuallySelectedCategory) return;
    
    const handler = setTimeout(async () => {
      const store = await loadStore();
      const match = findMatch(merchant, store);
      if (match && match !== category) {
        setCategory(match);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [merchant, hasManuallySelectedCategory, category]);

  const handleManualCategoryChange = (newCat: string) => {
    setHasManuallySelectedCategory(true);
    setCategory(newCat);
  };


  const submit = async () => {
    setErr('');
    const errors: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) errors.amount = t('transaction.validation.amount');
    if (!walletId) errors.wallet = t('transaction.validation.wallet');
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) errors.toWallet = t('transaction.validation.toWallet');
    if (Object.keys(errors).length > 0) {
      setErr(Object.values(errors)[0]);
      return;
    }
    const optimisticTx = {
      wallet_id: walletId,
      to_wallet_id: type === 'transfer' ? toWalletId : undefined,
      type, amount: amt, category, merchant: merchant.trim(), note, date: date || todayLocalISO(), currency: user?.currency || 'USD',
      created_at: new Date().toISOString(),
    };
    create(optimisticTx);

    // Learn the merchant → category association so future entries with the
    // same merchant auto-categorize. Fire-and-forget: a storage hiccup must
    // never block the optimistic save.
    if (merchant.trim()) {
      void (async () => {
        try {
          const store = await loadStore();
          const normalized = normalize(merchant);
          const mapping = store[normalized] || { category, match_count: 0, last_used: Date.now(), is_seeded: false };
          mapping.category = category;
          mapping.match_count += 1;
          mapping.last_used = Date.now();
          store[normalized] = mapping;
          await saveStore(store);
        } catch {}
      })();
    }

    router.back();
  };

  const cur = user?.currency || 'USD';

  return (
    <FormLayout title={t('transaction.new.title')} onBack={() => router.back()}>

      {/* Type selector */}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface3, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl }}>
              {(['expense', 'income', 'transfer'] as const).map((txType) => (
                <TouchableOpacity
                  key={txType}
                  testID={`type-${txType}`}
                  onPress={() => setType(txType)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    backgroundColor: type === txType
                      ? (txType === 'income' ? colors.success : txType === 'expense' ? colors.error : colors.brandPrimary)
                      : 'transparent',
                  }}
                >
                  <Body style={{
                    color: type === txType ? '#fff' : colors.onSurface2,
                    fontFamily: font.textBold,
                    textTransform: 'capitalize',
                  }}>{t(`transaction.type.${txType}`)}</Body>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount */}
            <View style={{ alignSelf: 'stretch', marginBottom: spacing.xl }}>
              <MoneyInput
                testID="tx-amount"
                label={t('transaction.amount')}
                variant="hero"
                currency={cur}
                symbol={currencySymbol(cur)}
                value={amount}
                onChange={setAmount}
                autoFocus
              />
            </View>

            {/* Merchant */}
            <View style={{ alignSelf: 'stretch', marginBottom: spacing.xl }}>
              <Input testID="tx-merchant" label="Merchant (optional)" value={merchant} onChangeText={setMerchant} placeholder="e.g. Starbucks, Grab" />
            </View>

            {/* Date */}
            <DateField testID="tx-date" label={t('transaction.date')} value={date} onChange={setDate} />

            {/* Category */}
            <CategorySelector type={type} value={category} onChange={handleManualCategoryChange} testID="tx" />

            {/* Wallet */}
            <Label style={{ marginTop: spacing.md }}>{t(type === 'transfer' ? 'transaction.wallet.from' : 'transaction.wallet')}</Label>
            {walletsLoading ? (
              <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <Body muted>{t('transaction.loadingWallets')}</Body>
              </View>
            ) : walletsError ? (
              <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
                <Body style={{ color: colors.error }}>{walletsError}</Body>
                <Button label={t('common.retry')} onPress={refreshWallets} />
              </View>
            ) : wallets.length === 0 ? (
              <View style={{ paddingVertical: spacing.md }}>
                <Body muted>{t('transaction.noWalletsFirst')}</Body>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' }}>
                {wallets.map((w) => (
                  <Chip key={w.id} testID={`wallet-from-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />
                ))}
              </ScrollView>
            )}

            {type === 'transfer' && (
              <>
                <Label style={{ marginTop: spacing.md }}>{t('transaction.wallet.to')}</Label>
                {walletsLoading ? (
                  <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                    <Body muted>{t('transaction.loadingWallets')}</Body>
                  </View>
                ) : walletsError ? (
                  <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
                    <Body style={{ color: colors.error }}>{walletsError}</Body>
                    <Button label={t('common.retry')} onPress={refreshWallets} />
                  </View>
                ) : wallets.length === 0 ? (
                  <View style={{ paddingVertical: spacing.md }}>
                    <Body muted>{t('transaction.noWallets')}</Body>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' }}>
                    {wallets.map((w) => (
                      <Chip key={w.id} testID={`wallet-to-${w.id}`} label={w.name} active={toWalletId === w.id} onPress={() => setToWalletId(w.id)} />
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <Input testID="tx-note" label={t('transaction.note.label')} value={note} onChangeText={setNote} placeholder={t('transaction.note.placeholder')} />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="tx-save" label={t('transaction.save')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
