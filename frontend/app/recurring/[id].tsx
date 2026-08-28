import React, { useCallback, useRef, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, Body, Label, Divider, Button } from '@/src/components/ui';
import { MoneyValue } from '@/src/components/MoneyValue';
import { useI18n } from '@/src/lib/I18nProvider';
import { systemCategoryLabel } from '@/src/lib/categories';

export default function RecurringDetail() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const cur = user?.currency || 'USD';

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.recurring();
      const list = Array.isArray(r?.recurring)
        ? r.recurring
        : Array.isArray(r?.items)
          ? r.items
          : Array.isArray(r)
            ? r
            : [];
      setItem(list.find((x: any) => x.id === id) || null);
    } catch (cause) {
      console.error('[RecurringDetail] failed to load', cause);
      setError(t('recurring.detail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <Screen><SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <Body>{t('common.loading')}</Body>
        </View>
      </SafeAreaView></Screen>
    );
  }

  if (error || !item) {
    return <Screen><SafeAreaView style={{ flex: 1 }} edges={['top']}><View style={{ padding: spacing.xl, gap: spacing.md }}><Body style={{ color: colors.error }}>{error || t('recurring.detail.loadError')}</Body><Button label={t('common.retry')} onPress={load} /></View></SafeAreaView></Screen>;
  }

  const overdue = item.days_until !== null && item.days_until < 0;
  const dueText = overdue ? t('recurring.overdue', { days: Math.abs(item.days_until) }) : item.days_until === 0 ? t('recurring.dueToday') : t('recurring.dueIn', { days: item.days_until });
  const dueColor = overdue ? colors.error : item.days_until <= 3 ? colors.warning : colors.onSurface2;

  const editParams = {
    id: item.id, name: item.name, type: item.type, amount: String(item.amount), category: item.category,
    wallet_id: item.wallet_id, frequency: item.frequency, next_date: item.next_date?.slice(0, 10) || '', note: item.note || '',
  };

  const onMarkPaid = () => {
    // One in-flight payment at a time — the backend logs one transaction per
    // call, so re-entry would double-charge the wallet.
    if (marking) return;
    sheetRef.current?.dismiss();
    Alert.alert(t('recurring.markPaidTitle'), t('recurring.markPaidMessage', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('recurring.markPaidConfirm'), onPress: async () => {
        setMarking(true);
        try { await api.markRecurringPaid(item.id); await load(); }
        finally { setMarking(false); }
      } },
    ]);
  };
  const onEdit = () => { sheetRef.current?.dismiss(); router.push({ pathname: '/recurring/new', params: editParams }); };
  const onDelete = () => {
    sheetRef.current?.dismiss();
    Alert.alert(t('recurring.detail.deleteTitle'), t('recurring.detail.deleteMessage', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await api.deleteRecurring(item.id); router.back(); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity testID="recurring-detail-back" accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <TouchableOpacity testID="recurring-detail-actions" accessibilityRole="button" accessibilityLabel={t('recurring.detail.actions')} onPress={() => sheetRef.current?.present()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Label>{systemCategoryLabel(item.category, t)} · {t(`recurring.frequency.${item.frequency}`)}</Label>
          <H1 style={{ marginTop: 4 }}>{item.name}</H1>

          <Card style={{ marginTop: spacing.lg }}>
            <Label>{t('transaction.amount')}</Label>
            <MoneyValue value={item.type === 'income' ? cv(item, 'amount') : -Math.abs(cv(item, 'amount'))} currency={cur} style={{ marginTop: 4, color: item.type === 'income' ? colors.success : colors.onSurface, fontFamily: font.displayBold, fontSize: 26 }} />
            <Body style={{ color: dueColor, fontFamily: font.textBold, marginTop: spacing.sm }}>{dueText}</Body>

            <Divider />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Body muted>{t('recurring.detail.nextDate')}</Body>
              <Body style={{ fontFamily: font.textMedium }}>{item.next_date?.slice(0, 10)}</Body>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Body muted>{t('recurring.detail.status')}</Body>
              <Body style={{ fontFamily: font.textMedium }}>{item.active ? t('recurring.detail.active') : t('recurring.detail.paused')}</Body>
            </View>
          </Card>

          {!!item.note && (
            <Card style={{ marginTop: spacing.md }}>
              <Label style={{ marginBottom: 4 }}>{t('recurring.detail.note')}</Label>
              <Body>{item.note}</Body>
            </Card>
          )}

          <TouchableOpacity testID="recurring-detail-mark-paid" onPress={onMarkPaid}
            style={{ marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.brandPrimary }}>
            <Body style={{ fontFamily: font.textBold, color: colors.onBrand }}>{t('recurring.markPaid')}</Body>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <BottomSheetModal ref={sheetRef} snapPoints={['30%']} backgroundStyle={{ backgroundColor: colors.surface2 }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}>
        <BottomSheetView style={{ padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm }}>
          <TouchableOpacity testID="recurring-sheet-mark-paid" onPress={onMarkPaid} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            <Body style={{ fontFamily: font.textMedium }}>{t('recurring.markPaid')}</Body>
          </TouchableOpacity>
          <TouchableOpacity testID="recurring-sheet-edit" onPress={onEdit} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="create-outline" size={20} color={colors.onSurface} />
            <Body style={{ fontFamily: font.textMedium }}>{t('edit')}</Body>
          </TouchableOpacity>
          <TouchableOpacity testID="recurring-sheet-delete" onPress={onDelete} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Body style={{ color: colors.error, fontFamily: font.textMedium }}>{t('delete')}</Body>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </Screen>
  );
}
