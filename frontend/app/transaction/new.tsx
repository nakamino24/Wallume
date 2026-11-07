import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { Button, Body, Label, Chip, Input } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { useWallets } from '@/src/hooks/use-wallets';
import { useTransactions, invalidateTransactionsCache } from '@/src/hooks/use-transactions';
import { api } from '@/src/api/client';
import { DateField } from '@/src/components/DateField';
import { CategorySelector } from '@/src/components/CategorySelector';
import { SplitEditor } from '@/src/components/SplitEditor';
import { summarizeSplits, type SplitPart } from '@/src/lib/split';
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
  const [loading, setLoading] = useState(false);
  const [splits, setSplits] = useState<SplitPart[] | null>(null);
  const [pickedReceipt, setPickedReceipt] = useState<{ uri: string; name: string; type: string } | null>(null);

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setErr(t('receipt.permissionDenied')); return; }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setPickedReceipt({
      uri: asset.uri,
      name: asset.fileName || 'receipt.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
  };

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

  const totalAmount = parseFloat(amount) || 0;

  const toggleSplit = () => {
    if (splits) { setSplits(null); return; }
    // Seed two parts so the header/remaining maths has something to work with.
    setSplits([
      { key: 'sp0', category, amount: '' },
      { key: 'sp1', category: 'Other', amount: '' },
    ]);
  };


  const submit = async () => {
    // Optimistic enqueue is synchronous, but a rapid double tap would still
    // enqueue two transactions; navigate-first means the guard also prevents
    // a second push while the screen is animating away.
    if (loading) return;
    setErr('');
    const errors: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) errors.amount = t('transaction.validation.amount');
    if (!walletId) errors.wallet = t('transaction.validation.wallet');
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) errors.toWallet = t('transaction.validation.toWallet');
    if (type === 'transfer' && splits) errors.amount = t('split.notForTransfer');
    if (splits && type !== 'transfer') {
      const summary = summarizeSplits(splits, amt);
      if (splits.length < 2) errors.amount = t('split.needsTwo');
      else if (!summary.balanced) errors.amount = t('split.mustBalance');
    }
    if (Object.keys(errors).length > 0) {
      setErr(Object.values(errors)[0]);
      return;
    }
    setLoading(true);
    const optimisticTx = {
      wallet_id: walletId,
      to_wallet_id: type === 'transfer' ? toWalletId : undefined,
      type, amount: amt, category, merchant: merchant.trim(), note, date: date || todayLocalISO(), currency: user?.currency || 'USD',
      created_at: new Date().toISOString(),
      ...(splits && type !== 'transfer'
        ? { splits: splits.map((part) => ({ category: part.category, amount: parseFloat(part.amount) || 0 })) }
        : {}),
    };

    // A receipt needs the real transaction id, which only exists after the
    // server responds — so receipt-attached creates bypass the optimistic
    // path and wait. Everyone else keeps the instant save.
    if (pickedReceipt) {
      try {
        const result: any = await api.createTransaction(optimisticTx);
        const realId = result?.transaction?.id;
        if (!realId) throw new Error(t('receipt.uploadFailed'));
        await api.uploadReceipt(realId, pickedReceipt);
        invalidateTransactionsCache();
        router.back();
      } catch (cause: any) {
        setErr(cause?.message || t('common.error'));
        setLoading(false);
      }
      return;
    }

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

            {/* Category — a split replaces the single category selector */}
            {type !== 'transfer' && (
              <TouchableOpacity
                testID="tx-split-toggle"
                accessibilityRole="button"
                accessibilityState={{ selected: !!splits }}
                accessibilityLabel={t('split.toggle')}
                onPress={toggleSplit}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}
              >
                <Ionicons name={splits ? 'remove-circle-outline' : 'git-branch-outline'} size={16} color={colors.brandPrimary} />
                <Body style={{ fontSize: 13, color: colors.brandPrimary, fontFamily: font.textBold }}>
                  {splits ? t('split.remove') : t('split.toggle')}
                </Body>
              </TouchableOpacity>
            )}

            {splits && type !== 'transfer' ? (
              <SplitEditor parts={splits} onChange={setSplits} total={totalAmount} currency={cur} />
            ) : (
              <CategorySelector type={type} value={category} onChange={handleManualCategoryChange} testID="tx" />
            )}

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

            {/* Receipt (create): attached locally now, uploaded once the
                transaction has a real id. */}
            <View style={{ alignSelf: 'stretch', marginBottom: spacing.lg }}>
              <TouchableOpacity
                testID="tx-receipt-pick"
                accessibilityRole="button"
                accessibilityLabel={pickedReceipt ? t('receipt.replace') : t('receipt.add')}
                onPress={pickReceipt}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  padding: spacing.md, borderRadius: radius.md,
                  borderWidth: 1, borderColor: pickedReceipt ? colors.brandPrimary : colors.border,
                  backgroundColor: pickedReceipt ? colors.brandPrimary + '11' : colors.surface2,
                }}
              >
                <Ionicons
                  name={pickedReceipt ? 'checkmark-circle' : 'camera-outline'}
                  size={18}
                  color={pickedReceipt ? colors.brandPrimary : colors.muted}
                />
                <Body style={{ flex: 1, fontSize: 13, color: pickedReceipt ? colors.brandPrimary : colors.onSurface2 }}>
                  {pickedReceipt ? t('receipt.attached') : t('receipt.add')}
                </Body>
                {pickedReceipt && (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.dismiss')} hitSlop={8}
                    onPress={() => setPickedReceipt(null)}>
                    <Ionicons name="close" size={16} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="tx-save" label={t('transaction.save')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
