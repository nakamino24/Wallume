import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { useI18n } from '@/src/lib/I18nProvider';

const TYPES = ['cash', 'bank', 'credit_card', 'e_wallet', 'savings', 'investment'] as const;

export default function NewWallet() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('wallet.form.validation.name')); return; }
    setLoading(true);
    try {
      await api.createWallet({
        name: name.trim(), type,
        balance: parseFloat(balance) || 0,
        currency: user?.currency || 'USD',
      });
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title={t('wallet.new.title')} onBack={() => router.back()}>
      <Input testID="wallet-name" label={t('wallet.name.label')} value={name} onChangeText={setName} placeholder={t('wallet.form.namePlaceholder')} />
      <Label>{t('common.type')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, alignItems: 'center' }}>
        {TYPES.map((walletType) => (
          <Chip key={walletType} testID={`wtype-${walletType}`} label={t(`wallet.type.${walletType}`)} active={type === walletType} onPress={() => setType(walletType)} />
        ))}
      </ScrollView>
      <MoneyInput testID="wallet-balance" label={t('wallet.form.startingBalance')} value={balance} onChange={setBalance} placeholder="0" />
      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="wallet-save" label={t('wallet.form.add')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
