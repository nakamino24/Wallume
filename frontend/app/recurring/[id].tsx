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
import { Screen, Card, H1, Body, Label, Divider } from '@/src/components/ui';
import { MoneyValue } from '@/src/components/MoneyValue';

const FREQ_LABEL: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

export default function RecurringDetail() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [marking, setMarking] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const cur = user?.currency || 'USD';

  const load = useCallback(async () => {
    const r = await api.recurring();
    const list = Array.isArray(r?.recurring)
      ? r.recurring
      : Array.isArray(r?.items)
        ? r.items
        : Array.isArray(r)
          ? r
          : [];
    setItem(list.find((x: any) => x.id === id) || null);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!item) {
    return (
      <Screen><SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
        </View>
      </SafeAreaView></Screen>
    );
  }

  const overdue = item.days_until !== null && item.days_until < 0;
  const dueText = overdue ? `${Math.abs(item.days_until)} days overdue` : item.days_until === 0 ? 'Due today' : `Due in ${item.days_until} days`;
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
    Alert.alert('Mark as paid?', `This logs a transaction for ${item.name} and moves it to the next due date.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark paid', onPress: async () => {
        setMarking(true);
        try { await api.markRecurringPaid(item.id); await load(); }
        finally { setMarking(false); }
      } },
    ]);
  };
  const onEdit = () => { sheetRef.current?.dismiss(); router.push({ pathname: '/recurring/new', params: editParams }); };
  const onDelete = () => {
    sheetRef.current?.dismiss();
    Alert.alert('Delete recurring?', `Remove ${item.name} from your recurring list.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteRecurring(item.id); router.back(); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity testID="recurring-detail-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <TouchableOpacity testID="recurring-detail-actions" onPress={() => sheetRef.current?.present()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Label>{item.category} · {FREQ_LABEL[item.frequency]}</Label>
          <H1 style={{ marginTop: 4 }}>{item.name}</H1>

          <Card style={{ marginTop: spacing.lg }}>
            <Label>Amount</Label>
            <MoneyValue value={item.type === 'income' ? cv(item, 'amount') : -Math.abs(cv(item, 'amount'))} currency={cur} privacy="financial" style={{ marginTop: 4, color: item.type === 'income' ? colors.success : colors.onSurface, fontFamily: font.displayBold, fontSize: 26 }} />
            <Body style={{ color: dueColor, fontFamily: font.textBold, marginTop: spacing.sm }}>{dueText}</Body>

            <Divider />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Body muted>Next due date</Body>
              <Body style={{ fontFamily: font.textMedium }}>{item.next_date?.slice(0, 10)}</Body>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Body muted>Status</Body>
              <Body style={{ fontFamily: font.textMedium }}>{item.active ? 'Active' : 'Paused'}</Body>
            </View>
          </Card>

          {!!item.note && (
            <Card style={{ marginTop: spacing.md }}>
              <Label style={{ marginBottom: 4 }}>Note</Label>
              <Body>{item.note}</Body>
            </Card>
          )}

          <TouchableOpacity testID="recurring-detail-mark-paid" onPress={onMarkPaid}
            style={{ marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.brandPrimary }}>
            <Body style={{ fontFamily: font.textBold, color: colors.onBrand }}>Mark as paid</Body>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <BottomSheetModal ref={sheetRef} snapPoints={['30%']} backgroundStyle={{ backgroundColor: colors.surface2 }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}>
        <BottomSheetView style={{ padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm }}>
          <TouchableOpacity testID="recurring-sheet-mark-paid" onPress={onMarkPaid} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            <Body style={{ fontFamily: font.textMedium }}>Mark as paid</Body>
          </TouchableOpacity>
          <TouchableOpacity testID="recurring-sheet-edit" onPress={onEdit} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="create-outline" size={20} color={colors.onSurface} />
            <Body style={{ fontFamily: font.textMedium }}>Edit</Body>
          </TouchableOpacity>
          <TouchableOpacity testID="recurring-sheet-delete" onPress={onDelete} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Body style={{ color: colors.error, fontFamily: font.textMedium }}>Delete</Body>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </Screen>
  );
}
