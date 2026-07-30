import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Circle as SvgCircle, G, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoney, formatMoneyFull } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, DisplayNumber, EmptyState, Input } from '@/src/components/ui';

const CAT_COLORS = ['#3FA796', '#F4A261', '#D32F2F', '#2E7D32', '#16213E', '#ED6C02', '#6B7280', '#222222'];

function toLocalDate(iso: string): string {
  if (!iso) return '';
  try { return new Date(iso).toISOString().split('T')[0]; } catch { return iso; }
}

function todayISO() { return new Date().toISOString().split('T')[0]; }

function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function Reports() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const cur = user?.currency || 'USD';

  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(todayISO());
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const filtered = txs.filter((t) => {
    const d = (t.date || '').split('T')[0];
    return d >= fromDate && d <= toDate;
  });

  const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const netFlow = income - expense;

  const catTotals: Record<string, number> = {};
  filtered.filter((t) => t.type === 'expense').forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + (Number(t.amount) || 0);
  });
  const categoryBreakdown = Object.entries(catTotals)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load more transactions to cover date range
      const r = await api.transactions(undefined, 500);
      setTxs(r.transactions || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>Reports</H2>
          </View>
          <TouchableOpacity testID="reports-export-btn" onPress={() => router.push('/export-report' as any)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="share-outline" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Date range */}
        <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Label>From</Label>
            <Input testID="report-from" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Label>To</Label>
            <Input testID="report-to" value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 60 }}>
          {/* Summary */}
          <Card style={{ backgroundColor: colors.inverse }}>
            <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Net cash flow</Label>
            <DisplayNumber size={34} color={colors.onInverse} style={{ marginTop: 6 }}>
              {formatMoney(netFlow, cur)}
            </DisplayNumber>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
              <MiniStat label="Income" value={formatMoney(income, cur)} color={colors.success} />
              <MiniStat label="Expense" value={formatMoney(expense, cur)} color={colors.error} />
              <MiniStat label="Transactions" value={String(filtered.length)} />
            </View>
          </Card>

          {/* Category breakdown */}
          <Card>
            <Label>Spending by category</Label>
            {categoryBreakdown.length === 0 ? (
              <Body muted style={{ marginTop: spacing.md }}>No expenses in this period.</Body>
            ) : (
              <>
                <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                  <DonutChart data={categoryBreakdown} />
                </View>
                <View style={{ marginTop: spacing.md, gap: 8 }}>
                  {categoryBreakdown.map((c, i) => (
                    <View key={c.category} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length], marginRight: 8 }} />
                      <Body style={{ flex: 1 }}>{c.category}</Body>
                      <Body style={{ fontFamily: font.textBold }}>{formatMoney(c.amount, cur)}</Body>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Card>

          {/* Ratios */}
          <Card>
            <Label>Ratios</Label>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
              <MiniStat label="Income vs Expense" value={income > 0 ? `${Math.round((expense / income) * 100)}%` : '-'} />
              <MiniStat label="Saving rate" value={income > 0 ? `${Math.round((netFlow / income) * 100)}%` : '-'} />
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function MiniStat({ label, value, color }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ minWidth: 80 }}>
      <Body style={{ color: colors.muted, fontSize: 12 }}>{label}</Body>
      <Body style={{ color: color || colors.onSurface, fontFamily: font.displayBold, fontSize: 18, marginTop: 2 }}>{value}</Body>
    </View>
  );
}

function DonutChart({ data }: any) {
  const total = data.reduce((s: number, d: any) => s + d.amount, 0);
  const size = 180; const r = 70; const stroke = 24;
  const c = 2 * Math.PI * r;
  let accum = 0;
  if (total <= 0) return null;
  return (
    <Svg width={size} height={size}>
      <G transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
        <SvgCircle r={r} cx={0} cy={0} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {data.map((d: any, i: number) => {
          const frac = d.amount / total;
          const dash = frac * c;
          const el = (
            <SvgCircle key={d.category} r={r} cx={0} cy={0} fill="none"
              stroke={CAT_COLORS[i % CAT_COLORS.length]} strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-accum} />
          );
          accum += dash;
          return el;
        })}
      </G>
    </Svg>
  );
}