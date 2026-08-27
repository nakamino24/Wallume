import React, { useCallback, useRef, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, Body, Label, Divider } from '@/src/components/ui';
import { computeInvestmentMetrics, kindLabel, quantitySummary, type InvestmentDoc } from '@/src/lib/investmentKinds';
import { MoneyValue } from '@/src/components/MoneyValue';

export default function InvestmentDetail() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inv, setInv] = useState<InvestmentDoc | null>(null);
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const sheetRef = useRef<BottomSheetModal>(null);
  const cur = user?.currency || 'USD';

  const load = useCallback(async () => {
    const r = await api.investments();
    const all: InvestmentDoc[] = r.investments || [];
    const found = all.find((i) => i.id === id) || null;
    setInv(found);
    const total = all.reduce((sum, i) => sum + computeInvestmentMetrics(i).value, 0);
    setPortfolioTotal(total);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!inv) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  const { value, cost, pl, returnPct } = computeInvestmentMetrics(inv);
  const plColor = pl >= 0 ? colors.success : colors.error;
  const allocationPct = portfolioTotal > 0 ? (value / portfolioTotal) * 100 : 0;

  const editParams: Record<string, string> = {
    id: inv.id || '',
    name: inv.name,
    ticker: inv.ticker || '',
    kind: inv.kind,
    quantity: String(inv.quantity ?? ''),
    avg_cost: String(inv.avg_cost ?? ''),
    current_price: String(inv.current_price ?? ''),
    face_value: String(inv.face_value ?? ''),
    coupon_rate: String(inv.coupon_rate ?? ''),
    purchase_price: String(inv.purchase_price ?? ''),
    current_value: String(inv.current_value ?? ''),
    broker: inv.broker || '',
    purchase_date: inv.purchase_date || '',
    notes: inv.notes || '',
  };

  const onDelete = () => {
    sheetRef.current?.dismiss();
    Alert.alert('Delete investment?', `Remove ${inv.name} from your portfolio.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await api.deleteInvestment(inv.id!); router.back(); },
      },
    ]);
  };

  const onEdit = () => {
    sheetRef.current?.dismiss();
    router.push({ pathname: '/investment/new', params: editParams });
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity testID="inv-detail-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <TouchableOpacity testID="inv-detail-actions" onPress={() => sheetRef.current?.present()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Label>{kindLabel(inv.kind)}{inv.broker ? ` · ${inv.broker}` : ''}</Label>
          <H1 style={{ marginTop: 4 }}>{inv.name}</H1>
          {!!inv.ticker && <Body muted style={{ marginTop: 2 }}>{inv.ticker}</Body>}

          <Card style={{ marginTop: spacing.lg }}>
            <Label>Current Value</Label>
            <MoneyValue value={value} currency={cur} style={{ fontFamily: font.displayBold, fontSize: 26, marginTop: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm }}>
              <Ionicons name={pl >= 0 ? 'trending-up' : 'trending-down'} size={16} color={plColor} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><MoneyValue value={pl} currency={cur} style={{ color: plColor, fontFamily: font.textBold }} /><Body style={{ color: plColor, fontFamily: font.textBold }}> ({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%)</Body></View>
            </View>

            <Divider />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Body muted>Quantity</Body>
              <Body style={{ fontFamily: font.textMedium }}>{quantitySummary(inv)}</Body>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Body muted>Total Cost</Body>
              <MoneyValue value={cost} currency={cur} style={{ fontFamily: font.textMedium }} />
            </View>
            {inv.kind === 'bond' && !!inv.face_value && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Body muted>Face Value</Body>
                <MoneyValue value={cv(inv, 'face_value')} currency={cur} style={{ fontFamily: font.textMedium }} />
              </View>
            )}
            {inv.kind === 'bond' && !!inv.coupon_rate && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Body muted>Coupon Rate</Body>
                <Body style={{ fontFamily: font.textMedium }}>{inv.coupon_rate}%</Body>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Body muted>Portfolio Allocation</Body>
              <Body style={{ fontFamily: font.textMedium }}>{allocationPct.toFixed(1)}%</Body>
            </View>
          </Card>

          {(inv.purchase_date || inv.notes) && (
            <Card style={{ marginTop: spacing.md }}>
              {!!inv.purchase_date && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: inv.notes ? spacing.sm : 0 }}>
                  <Body muted>Purchase date</Body>
                  <Body style={{ fontFamily: font.textMedium }}>{inv.purchase_date}</Body>
                </View>
              )}
              {!!inv.notes && (
                <>
                  <Label style={{ marginBottom: 4 }}>Notes</Label>
                  <Body>{inv.notes}</Body>
                </>
              )}
            </Card>
          )}

          <Body muted style={{ marginTop: spacing.lg, fontSize: 12, textAlign: 'center' }}>
            Performance chart will appear here once price history tracking is added.
          </Body>
        </View>
      </SafeAreaView>

      <BottomSheetModal ref={sheetRef} snapPoints={['22%']} backgroundStyle={{ backgroundColor: colors.surface2 }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}>
        <BottomSheetView style={{ padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm }}>
          <TouchableOpacity testID="inv-sheet-edit" onPress={onEdit}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="create-outline" size={20} color={colors.onSurface} />
            <Body style={{ fontFamily: font.textMedium }}>Edit investment</Body>
          </TouchableOpacity>
          <TouchableOpacity testID="inv-sheet-delete" onPress={onDelete}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Body style={{ color: colors.error, fontFamily: font.textMedium }}>Delete investment</Body>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </Screen>
  );
}
