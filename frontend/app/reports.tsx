import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle, G } from 'react-native-svg';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, formatMoney, formatMoneyCompact } from '@/src/theme/tokens';
import { api, type ReportSummary } from '@/src/api/client';
import { Screen, Card, H2, Body, Label, DisplayNumber } from '@/src/components/ui';
import { DateField } from '@/src/components/DateField';
import { todayLocalISO } from '@/src/utils/dates';

const CAT_COLORS = ['#3FA796', '#F4A261', '#D32F2F', '#2E7D32', '#16213E', '#ED6C02', '#6B7280', '#222222'];

export default function Reports() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const cur = user?.currency || 'USD';

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return todayLocalISO(d);
  });
  const [toDate, setToDate] = useState(() => todayLocalISO());
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const income = summary?.income_total ?? 0;
  const expense = summary?.expense_total ?? 0;
  const netFlow = summary?.net_total ?? 0;
  const categoryBreakdown = [...(summary?.expense_by_category ?? [])]
    .sort((a, b) => b.amount - a.amount);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.reports.getSummary({ from_date: fromDate, to_date: toDate }));
    } catch (e: any) {
      console.error('[Reports] failed to load:', e?.message || e);
      setError('Unable to load this period. Try again.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

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
            <DateField testID="report-from" label="From" value={fromDate} onChange={setFromDate} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField testID="report-to" label="To" value={toDate} onChange={setToDate} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 60 }}>
          {loading ? (
            <Card><Body>Updating report...</Body></Card>
          ) : error ? (
            <Card>
              <Body style={{ color: colors.error }}>{error}</Body>
              <TouchableOpacity onPress={load} style={{ marginTop: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: 8, alignSelf: 'flex-start' }}>
                <Body style={{ color: colors.onBrand, fontFamily: font.textBold }}>Try again</Body>
              </TouchableOpacity>
            </Card>
          ) : summary?.transaction_count === 0 ? (
            <Card><Body>No transactions in this period.</Body></Card>
          ) : (
            <>
              {/* Summary */}
              <Card style={{ backgroundColor: colors.inverse }}>
                <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Net cash flow</Label>
                <DisplayNumber size={34} color={colors.onInverse} style={{ marginTop: 6 }}>
                  {formatMoney(netFlow, cur)}
                </DisplayNumber>
                <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
                  <MiniStat label="Income" value={formatMoney(income, cur)} color={colors.success} />
                  <MiniStat label="Expense" value={formatMoney(expense, cur)} color={colors.error} />
                  <MiniStat label="Transactions" value={String(summary?.transaction_count ?? 0)} />
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
                  <DonutChart data={categoryBreakdown} total={expense} />
                </View>
                <View style={{ marginTop: spacing.md, gap: 8 }}>
                  {categoryBreakdown.map((c, i) => (
                    <View key={c.category} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length], marginRight: 8 }} />
                      <Body style={{ flex: 1 }}>{c.category}</Body>
                      <Body style={{ fontFamily: font.textBold }}>{formatMoneyCompact(c.amount, cur)}</Body>
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
            </>
          )}
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

function DonutChart({ data, total }: any) {
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
