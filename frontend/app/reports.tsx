import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle, G } from 'react-native-svg';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, radius } from '@/src/theme/tokens';
import { api, type ReportSummary } from '@/src/api/client';
import { Screen, Card, H2, Body, Label } from '@/src/components/ui';
import { MoneyValue } from '@/src/components/MoneyValue';
import { useReportPeriod } from '@/src/hooks/use-report-period';
import { ReportPeriodPicker } from '@/src/components/ReportPeriodPicker';
import { useI18n } from '@/src/lib/I18nProvider';
import { systemCategoryLabel } from '@/src/lib/categories';

const CAT_COLORS = ['#287565', '#D69A57', '#527C8A', '#7C9A6A', '#B86C20', '#8B7763', '#70807A', '#B64A4A'];

export default function Reports() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const cur = user?.currency || 'USD';

  const { period, setPeriod } = useReportPeriod();
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const fromDate = selectedPeriod.fromDate;
  const toDate = selectedPeriod.toDate;
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
      setError(t('reports.loadError'));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>{t('reports')}</H2>
          </View>
          <TouchableOpacity testID="reports-export-btn" accessibilityRole="button" accessibilityLabel={t('reports.export')} onPress={() => router.push('/export-report' as any)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="share-outline" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <ReportPeriodPicker
            fromDate={fromDate}
            toDate={toDate}
            onChange={({ from, to }) => {
              const label = `${from} – ${to}`;
              const isThisMonth = from.slice(0, 7) === new Date().toISOString().slice(0, 7) && from.endsWith('-01');
              const next = { fromDate: from, toDate: to, kind: isThisMonth ? 'this_month' as const : 'custom' as const, label };
              setSelectedPeriod(next);
              setPeriod(next);
            }}
          />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 60 }}>
          {loading ? (
            <Card><Body>{t('reports.updating')}</Body></Card>
          ) : error ? (
            <Card>
              <Body style={{ color: colors.error }}>{error}</Body>
              <TouchableOpacity onPress={load} style={{ marginTop: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: 8, alignSelf: 'flex-start' }}>
                <Body style={{ color: colors.onBrand, fontFamily: font.textBold }}>{t('reports.tryAgain')}</Body>
              </TouchableOpacity>
            </Card>
          ) : summary?.transaction_count === 0 ? (
            <Card><Body>{t('reports.empty')}</Body></Card>
          ) : (
            <>
              {/* Summary — Net cash flow is NOT Net Worth, privacy-aware */}
              <Card style={{ backgroundColor: colors.inverse, borderColor: 'transparent', borderRadius: radius.lg }}>
                <Label style={{ color: colors.onInverse, opacity: 0.6 }}>{t('reports.netCashFlow')}</Label>
                <MoneyValue value={netFlow} currency={cur} style={{ color: colors.onInverse, fontFamily: font.textBold, fontSize: 34, letterSpacing: -0.5, marginTop: 6 }} />
                <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Body style={{ color: colors.onInverse, fontSize: 12, opacity: 0.7 }}>{t('income')}</Body>
                    <MoneyValue value={income} currency={cur} compact style={{ color: colors.onInverse, fontFamily: font.textBold, fontSize: 16, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Body style={{ color: colors.onInverse, fontSize: 12, opacity: 0.7 }}>{t('expense')}</Body>
                    <MoneyValue value={expense} currency={cur} compact style={{ color: colors.onInverse, fontFamily: font.textBold, fontSize: 16, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Body style={{ color: colors.onInverse, fontSize: 12, opacity: 0.7 }}>{t('transactions')}</Body>
                    <Body numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: colors.onInverse, fontFamily: font.textBold, fontSize: 16, marginTop: 2 }}>{String(summary?.transaction_count ?? 0)}</Body>
                  </View>
                </View>
              </Card>

              {/* Category breakdown */}
              <Card>
                <Label>{t('reports.spendingCategory')}</Label>
                {categoryBreakdown.length === 0 ? (
                  <Body muted style={{ marginTop: spacing.md }}>{t('reports.noExpenses')}</Body>
                ) : (
              <>
                <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                  <DonutChart data={categoryBreakdown} total={expense} />
                </View>
                <View style={{ marginTop: spacing.md, gap: 8 }}>
                  {categoryBreakdown.map((c, i) => (
                    <View key={c.category} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CAT_COLORS[i % CAT_COLORS.length], marginRight: 8 }} />
                      <Body style={{ flex: 1 }}>{systemCategoryLabel(c.category, t)}</Body>
                       <MoneyValue value={c.amount} currency={cur} compact privacy="balance" style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 14 }} />
                    </View>
                  ))}
                </View>
              </>
            )}
          </Card>

          {/* Ratios */}
          <Card>
            <Label>{t('reports.ratios')}</Label>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
              <MiniStat label={t('reports.incomeExpense')} value={income > 0 ? `${Math.round((expense / income) * 100)}%` : '-'} />
              <MiniStat label={t('saving.rate')} value={income > 0 ? `${Math.round((netFlow / income) * 100)}%` : '-'} />
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
    <View style={{ flex: 1, minWidth: 0 }}>
      <Body style={{ color: colors.muted, fontSize: 12 }}>{label}</Body>
      <Body numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: color || colors.onSurface, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>{value}</Body>
    </View>
  );
}

function DonutChart({ data, total }: any) {
  const { colors } = useTheme();
  const size = 180; const r = 70; const stroke = 24;
  const c = 2 * Math.PI * r;
  let accum = 0;
  if (total <= 0) return null;
  return (
    <Svg width={size} height={size}>
      <G transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
        <SvgCircle r={r} cx={0} cy={0} fill="none" stroke={colors.surface3} strokeWidth={stroke} />
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
