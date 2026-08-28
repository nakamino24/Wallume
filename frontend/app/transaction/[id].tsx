import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { useUserCategories } from '@/src/hooks/use-user-categories';
import { useWallets } from '@/src/hooks/use-wallets';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { CategorySelector } from '@/src/components/CategorySelector';
import { todayLocalISO } from '@/src/utils/dates';
import { useTransactions } from '@/src/hooks/use-transactions';
import { useI18n } from '@/src/lib/I18nProvider';

// Edit an existing transaction. The list screen (transactions.tsx) passes the
// transaction's fields in as route params, so we don't need a dedicated
// GET /transactions/{id} endpoint just to prefill this form.
export default function EditTransaction() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { getOptions, isKnown } = useUserCategories();
  const params = useLocalSearchParams<{
    id: string;
    wallet_id?: string;
    to_wallet_id?: string;
    type?: string;
    amount?: string;
    category?: string;
    note?: string;
    date?: string;
  }>();

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>((params.type as any) || 'expense');
  const [amount, setAmount] = useState(params.amount ? String(params.amount) : '');
  const [category, setCategory] = useState(params.category || 'Food');
  const [note, setNote] = useState(params.note || '');
  const { wallets, loading: walletsLoading, error: walletsError, refresh: refreshWallets } = useWallets();
  const [walletId, setWalletId] = useState(params.wallet_id || '');
  const [toWalletId, setToWalletId] = useState(params.to_wallet_id || '');
  const [date, setDate] = useState(params.date || todayLocalISO());
  const [err, setErr] = useState('');
  const [loading] = useState(false);
  const { edit } = useTransactions();

  const submit = async () => {
    setErr('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr(t('transaction.validation.amount')); return; }
    if (!walletId) { setErr(t('transaction.validation.wallet')); return; }
    if (type === 'transfer' && (!toWalletId || toWalletId === walletId)) { setErr(t('transaction.validation.toWallet')); return; }
    edit(params.id, {
        wallet_id: walletId,
        to_wallet_id: type === 'transfer' ? toWalletId : undefined,
        type, amount: amt, category, note, date: date || undefined,
      });
    router.back();
  };

  const cur = user?.currency || 'USD';

  return (
    <FormLayout title={t('transaction.edit.title')} onBack={() => router.back()}>
      {/* Type selector */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl }}>
              {(['expense', 'income', 'transfer'] as const).map((txType) => (
                <TouchableOpacity
                  key={txType}
                  testID={`edit-type-${txType}`}
                  onPress={() => {
                    setType(txType);
                    if (txType !== 'transfer' && !isKnown(txType, category)) setCategory(getOptions(txType)[0]);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radius.md,
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
                testID="edit-tx-amount"
                label={t('transaction.amount')}
                variant="hero"
                symbol={currencySymbol(cur)}
                value={amount}
                onChange={setAmount}
                placeholder="0"
              />
            </View>

            {/* Date */}
            <DateField testID="edit-tx-date" label={t('transaction.date')} value={date} onChange={setDate} />

            {/* Category */}
            <CategorySelector type={type} value={category} onChange={setCategory} testID="edit-tx" />

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
                <Body muted>{t('transaction.noWallets')}</Body>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                {wallets.map((w) => (
                  <Chip key={w.id} testID={`edit-wallet-from-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => setWalletId(w.id)} />
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                    {wallets.map((w) => (
                      <Chip key={w.id} testID={`edit-wallet-to-${w.id}`} label={w.name} active={toWalletId === w.id} onPress={() => setToWalletId(w.id)} />
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <Input testID="edit-tx-note" label={t('transaction.note.label')} value={note} onChangeText={setNote} placeholder={t('transaction.note.placeholder')} />

            {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

            <Button testID="edit-tx-save" label={t('transaction.saveChanges')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
