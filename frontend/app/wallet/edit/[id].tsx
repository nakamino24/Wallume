import React, { useCallback, useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip, Card } from '@/src/components/ui';
import { confirmAction } from '@/src/utils/confirm';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { MoneyValue } from '@/src/components/MoneyValue';
import { useI18n } from '@/src/lib/I18nProvider';

const TYPES = ['cash', 'bank', 'credit_card', 'e_wallet', 'savings', 'investment'] as const;

export default function EditWallet() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [wallet, setWallet] = useState<any>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await api.wallets();
    const w = (r.wallets || []).find((x: any) => x.id === id);
    if (w) {
      setWallet(w);
      setName(w.name);
      setType(w.type);
      setBalance(String(w.balance ?? 0));
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('wallet.form.validation.name')); return; }
    if (balance.trim() === '') { setErr(t('wallet.form.validation.balance')); return; }
    const parsed = parseFloat(balance);
    if (Number.isNaN(parsed)) { setErr(t('wallet.form.validation.number')); return; }
    setLoading(true);
    try {
      await api.updateWallet(id!, {
        name: name.trim(),
        type,
        balance: parsed,
      });
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  const remove = () => {
    confirmAction(
      t('wallets.delete.title'),
      t('wallets.delete.message'),
      async () => { await api.deleteWallet(id!); router.back(); },
      { confirmLabel: t('common.delete'), destructive: true },
    );
  };

  if (!wallet) {
    return <FormLayout title={t('wallet.edit.title')}><Body style={{ padding: spacing.xl }}>{t('common.loading')}</Body></FormLayout>;
  }

  const cur = user?.currency || 'USD';

  return (
    <FormLayout title={t('wallet.edit.title')} onBack={() => router.back()}
      headerRight={
        <TouchableOpacity testID="edit-wallet-delete" onPress={remove} style={{ padding: 8 }}>
          <Ionicons name="trash" size={20} color={colors.error} />
        </TouchableOpacity>
      }>
      <Card style={{ marginBottom: spacing.md }}>
        <Label>{t('wallet.form.currentBalance')}</Label>
        <MoneyValue value={wallet.converted_balance ?? (wallet.balance || 0)} currency={wallet.home_currency || cur} privacy="balance" style={{ fontSize: scale(24), fontFamily: font.displayBold, marginTop: 4 }} />
      </Card>

      <Input testID="edit-wallet-name" label={t('wallet.name.label')} value={name} onChangeText={setName} placeholder={t('wallet.form.namePlaceholder')} />

      <Label>{t('common.type')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {TYPES.map((walletType) => (
          <Chip key={walletType} testID={`edit-wtype-${walletType}`} label={t(`wallet.type.${walletType}`)} active={type === walletType} onPress={() => setType(walletType)} />
        ))}
      </ScrollView>

      <MoneyInput testID="edit-wallet-balance" label={t('wallet.balance.edit.label')} value={balance} onChange={setBalance} placeholder="0" />
      <Body muted style={{ fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md }}>
        {t('wallet.form.balanceHelp')}
      </Body>

      {!!err && <Body style={{ color: colors.error, marginBottom: spacing.md }}>{err}</Body>}

      <Button testID="edit-wallet-save" label={t('transaction.saveChanges')} onPress={submit} loading={loading} />
    </FormLayout>
  );
}
