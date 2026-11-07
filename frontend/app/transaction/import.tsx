import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { Screen, H2, Body, Label, Button, Chip, Card } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { useWallets, invalidateWalletsCache } from '@/src/hooks/use-wallets';
import { useI18n } from '@/src/lib/I18nProvider';
import { api } from '@/src/api/client';
import { invalidateTransactionsCache } from '@/src/hooks/use-transactions';
import { parseCsv, normalizeStatement, type ImportRow, type DefaultType } from '@/src/lib/csv';
import { findMatch, loadStore, type MappingStore } from '@/src/utils/merchant-engine';

type Preview = {
  rows: ImportRow[];
  readyCount: number;
  duplicateCount: number;
  skippedCount: number;
};

export default function ImportStatement() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const { wallets, loading: walletsLoading, error: walletsError, refresh: refreshWallets } = useWallets();

  const [walletId, setWalletId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [defaultType, setDefaultType] = useState<DefaultType>('expense');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [store, setStore] = useState<MappingStore>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const cur = user?.currency || 'USD';

  useEffect(() => {
    if (!walletId && wallets.length > 0) setWalletId(wallets[0].id);
  }, [wallets, walletId]);

  // Load the learned merchant map once so previews show real category guesses.
  useEffect(() => {
    void loadStore().then(setStore).catch(() => setStore({}));
  }, []);

  const suggest = useMemo(
    () => (merchant: string) => (merchant ? findMatch(merchant, store) : null),
    [store],
  );

  // Any edit invalidates a previous preview so the count can't go stale.
  const onChangeCsv = (value: string) => { setCsvText(value); setPreview(null); setErr(''); };
  const onChangeType = (value: DefaultType) => { setDefaultType(value); setPreview(null); };
  const onChangeWallet = (value: string) => { setWalletId(value); setPreview(null); };

  const runPreview = async () => {
    setErr('');
    if (!walletId) { setErr(t('import.selectWallet')); return; }
    if (!csvText.trim()) { setErr(t('import.empty')); return; }

    const cells = parseCsv(csvText);
    const { rows, skipped } = normalizeStatement(cells, { defaultType, suggest });
    if (rows.length === 0) { setErr(t('import.none')); return; }

    setLoading(true);
    try {
      const result: any = await api.importTransactions({ wallet_id: walletId, rows, dry_run: true });
      const ready = result?.rows || [];
      setPreview({
        rows: ready,
        readyCount: ready.length,
        duplicateCount: Number(result?.duplicate_count ?? 0),
        skippedCount: skipped.length + Number(result?.errors?.length ?? 0),
      });
    } catch (cause: any) {
      setErr(cause?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!preview || preview.readyCount === 0) return;
    setLoading(true);
    setErr('');
    try {
      const result: any = await api.importTransactions({
        wallet_id: walletId,
        rows: preview.rows,
        dry_run: false,
      });
      invalidateTransactionsCache();
      invalidateWalletsCache();
      const imported = Number(result?.imported ?? preview.readyCount);
      Alert.alert(t('import.title'), t('import.success', { count: imported }), [
        { text: t('common.save'), onPress: () => router.back() },
      ]);
    } catch (cause: any) {
      setErr(cause?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md }}>{t('import.title')}</H2>
        </View>

        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60, gap: spacing.md }}>
          <Body muted style={{ fontSize: 12 }}>{t('import.hint')}</Body>

          <Label>{t('import.wallet')}</Label>
          {walletsLoading ? (
            <Body muted>{t('common.loading')}</Body>
          ) : walletsError ? (
            <View style={{ gap: spacing.sm }}>
              <Body style={{ color: colors.error }}>{walletsError}</Body>
              <Button label={t('common.retry')} onPress={refreshWallets} />
            </View>
          ) : wallets.length === 0 ? (
            <Body muted>{t('transaction.noWalletsFirst')}</Body>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
              contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center' }}>
              {wallets.map((w: any) => (
                <Chip key={w.id} testID={`import-wallet-${w.id}`} label={w.name} active={walletId === w.id} onPress={() => onChangeWallet(w.id)} />
              ))}
            </ScrollView>
          )}

          <Label>{t('import.allRowsAre')}</Label>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Chip testID="import-type-expense" label={t('transactions.type.expense')} active={defaultType === 'expense'} onPress={() => onChangeType('expense')} />
            <Chip testID="import-type-income" label={t('transactions.type.income')} active={defaultType === 'income'} onPress={() => onChangeType('income')} />
            <Chip testID="import-type-auto" label={t('import.auto')} active={defaultType === 'auto'} onPress={() => onChangeType('auto')} />
          </View>

          <Label>{t('import.paste')}</Label>
          <TextInput
            testID="import-csv"
            value={csvText}
            onChangeText={onChangeCsv}
            placeholder={t('import.pastePlaceholder')}
            placeholderTextColor={colors.onSurface3}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              minHeight: 160,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface2,
              color: colors.onSurface,
              padding: spacing.md,
              fontFamily: font.text,
              fontSize: 13,
              textAlignVertical: 'top',
            }}
          />

          {!!err && <Body style={{ color: colors.error }}>{err}</Body>}

          <Button testID="import-preview" label={t('import.preview')} onPress={runPreview} loading={loading} />

          {preview && (
            <Card testID="import-preview-result" style={{ gap: spacing.xs }}>
              <Body style={{ fontFamily: font.textBold, color: preview.readyCount > 0 ? colors.success : colors.error }}>
                {t('import.newRows', { count: preview.readyCount })}
              </Body>
              {preview.duplicateCount > 0 && (
                <Body muted style={{ fontSize: 12 }}>{t('import.duplicates', { count: preview.duplicateCount })}</Body>
              )}
              {preview.skippedCount > 0 && (
                <Body muted style={{ fontSize: 12 }}>{t('import.skipped', { count: preview.skippedCount })}</Body>
              )}

              <View style={{ marginTop: spacing.sm, gap: 4 }}>
                {preview.rows.slice(0, 8).map((row, index) => (
                  <View key={`${row.date}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                    <Body muted style={{ fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {row.date} · {row.merchant || row.note || '—'}
                    </Body>
                    <Body style={{ fontSize: 12, color: row.type === 'income' ? colors.success : colors.error }}>
                      {row.type === 'income' ? '+' : '-'}{row.amount} {cur}
                    </Body>
                  </View>
                ))}
                {preview.rows.length > 8 && (
                  <Body muted style={{ fontSize: 11 }}>+{preview.rows.length - 8}</Body>
                )}
              </View>
            </Card>
          )}

          {preview && preview.readyCount > 0 && (
            <Button
              testID="import-run"
              label={t('import.import', { count: preview.readyCount })}
              onPress={runImport}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
