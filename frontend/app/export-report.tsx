import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, formatMoneyFull } from '@/src/theme/tokens';
import { api, type ReportSummary } from '@/src/api/client';
import { Screen, Card, H2, Body, Label, Button } from '@/src/components/ui';
import { MoneyValue } from '@/src/components/MoneyValue';
import { useReportPeriod } from '@/src/hooks/use-report-period';
import { useI18n } from '@/src/lib/I18nProvider';

function buildReportHTML(opts: {
  userName: string; currency: string; period: string;
  report: ReportSummary; netWorth: number; healthScore: number; wallets: any[]; txs: any[];
  translate: (key: string, params?: Record<string, string | number>) => string;
}) {
  const { userName, currency, period, report, netWorth, healthScore, wallets, txs, translate } = opts;
  const fmt = (n: number) => formatMoneyFull(n, currency);

  const catRows = (report.expense_by_category || []).map((c: any) => `
    <tr><td>${c.category}</td><td style="text-align:right">${fmt(c.amount)}</td></tr>
  `).join('');

  const txRows = txs.slice(0, 40).map((t: any) => `
    <tr>
      <td>${/^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ? new Date(`${t.date}T00:00:00`).toLocaleDateString() : new Date(t.date).toLocaleDateString()}</td>
      <td>${t.category}</td>
      <td>${t.note || ''}</td>
      <td style="text-align:right;color:${t.type === 'income' ? '#059669' : t.type === 'expense' ? '#DC2626' : '#111'}">
        ${t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}${fmt(t.amount)}
      </td>
    </tr>
  `).join('');

  const walletRows = wallets.map((w: any) => `
    <tr><td>${w.name}</td><td>${translate(`wallet.type.${w.type}`)}</td><td style="text-align:right">${fmt(w.balance)}</td></tr>
  `).join('');

  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { font-family: -apple-system, Helvetica, Arial, sans-serif; box-sizing: border-box; }
      body { padding: 32px; color: #111; }
      h1 { font-size: 22px; margin-bottom: 2px; }
      .muted { color: #6B7280; font-size: 12px; }
      .hero { background: #0B0B0F; color: #fff; border-radius: 16px; padding: 24px; margin: 20px 0; }
      .hero .label { color: #9CA3AF; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
      .hero .value { font-size: 30px; font-weight: 700; margin-top: 4px; }
      .row { display: flex; gap: 24px; margin-top: 16px; }
      .row .col { flex: 1; }
      .row .col .label { color: #9CA3AF; font-size: 11px; }
      .row .col .value { font-size: 15px; font-weight: 700; margin-top: 2px; }
      h2 { font-size: 15px; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      td { padding: 6px 4px; border-bottom: 1px solid #F3F4F6; }
      .footer { margin-top: 40px; font-size: 10px; color: #9CA3AF; text-align: center; }
    </style>
  </head>
  <body>
    <h1>${translate('export.financialReport')} — ${userName}</h1>
    <div class="muted">${period} · ${translate('export.generatedBy')}</div>

    <div class="hero">
      <div class="label">${translate('export.netWorth')}</div>
      <div class="value">${fmt(netWorth)}</div>
      <div class="row">
        <div class="col"><div class="label">${translate('export.income')}</div><div class="value" style="color:#34D399">+${fmt(report.income_total ?? 0)}</div></div>
        <div class="col"><div class="label">${translate('export.expense')}</div><div class="value" style="color:#F87171">-${fmt(report.expense_total ?? 0)}</div></div>
        <div class="col"><div class="label">${translate('export.cashFlow')}</div><div class="value">${fmt(report.net_total ?? 0)}</div></div>
        <div class="col"><div class="label">${translate('export.healthScore')}</div><div class="value">${healthScore}/100</div></div>
      </div>
    </div>

    <h2>${translate('export.wallets')}</h2>
    <table>${walletRows || `<tr><td class="muted">${translate('export.noWallets')}</td></tr>`}</table>

    <h2>${translate('export.spendingCategory')}</h2>
    <table>${catRows || `<tr><td class="muted">${translate('export.noExpenses')}</td></tr>`}</table>

    <h2>${translate('export.recentTransactions')}</h2>
    <table>${txRows || `<tr><td class="muted">${translate('export.noTransactions')}</td></tr>`}</table>

    <div class="footer">${translate('export.footer')}</div>
  </body>
  </html>`;
}

export default function ExportReport() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { period } = useReportPeriod();
  const [generating, setGenerating] = useState(false);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cur = user?.currency || 'USD';

  const periodLabel = period.label || `${period.fromDate} – ${period.toDate}`;
  const isMonthly = period.kind === 'this_month' || period.kind === 'monthly';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a] = await Promise.all([
        api.reports.getSummary({ from_date: period.fromDate, to_date: period.toDate }),
        api.summary(),
      ]);
      setReportSummary(r);
      setAnalyticsSummary(a);
    } catch (e: any) {
      setError(t('export.loadError'));
    } finally {
      setLoading(false);
    }
  }, [period.fromDate, period.toDate, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const generate = async () => {
    if (loading || !reportSummary) return;
    setGenerating(true);
    try {
      const [walletRes, txRes] = await Promise.all([
        api.wallets(),
        api.transactions(undefined, undefined, undefined, period.fromDate, period.toDate),
      ]);
      // Reuse the same reportSummary already fetched for preview — preview = PDF
      const html = buildReportHTML({
        userName: user?.name || 'User',
        currency: cur,
        period: periodLabel,
        report: reportSummary,
        netWorth: analyticsSummary?.net_worth ?? 0,
        healthScore: analyticsSummary?.health_score ?? 0,
        wallets: walletRes.wallets || [],
        txs: txRes.transactions || [],
        translate: t,
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('export.pdfTitle') });
      } else {
        Alert.alert(t('export.ready'), t('export.savedTo', { path: uri }));
      }
    } catch (e: any) {
      Alert.alert(t('export.error'), t('export.tryAgain'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity testID="export-back" accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md }}>{t('export.title')}</H2>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.error + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="document-text" size={22} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: font.textBold }}>{isMonthly ? t('export.monthlyReport', { period: periodLabel }) : t('export.financialReport')}</Body>
                {!isMonthly && <Body muted style={{ fontSize: 12, marginTop: 2 }}>{periodLabel}</Body>}
                <Body muted style={{ fontSize: 12, marginTop: 2 }}>
                  {t('export.summary')}
                </Body>
              </View>
            </View>
          </Card>

          {loading ? (
            <Card style={{ marginTop: spacing.md }}><Body>{t('export.previewLoading')}</Body></Card>
          ) : error ? (
            <Card style={{ marginTop: spacing.md }}>
              <Body style={{ color: colors.error }}>{error}</Body>
              <Button label={t('common.retry')} onPress={load} style={{ marginTop: spacing.md }} />
            </Card>
          ) : reportSummary ? (
            <Card style={{ marginTop: spacing.md }}>
              <Label>{t('export.preview')}</Label>
              <Body muted style={{ fontSize: 12, marginTop: 2 }}>{periodLabel}</Body>
              <View style={{ marginTop: spacing.md, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body style={{ color: colors.muted, fontSize: 12 }}>{t('export.netWorth')}</Body>
                  <MoneyValue value={analyticsSummary?.net_worth ?? 0} currency={cur} style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 14, fontVariant: ['tabular-nums'] }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body style={{ color: colors.muted, fontSize: 12 }}>{t('export.income')}</Body>
                  <MoneyValue value={reportSummary.income_total ?? 0} currency={cur} style={{ color: colors.success, fontFamily: font.textBold, fontSize: 14, fontVariant: ['tabular-nums'] }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body style={{ color: colors.muted, fontSize: 12 }}>{t('export.expense')}</Body>
                  <MoneyValue value={-(reportSummary.expense_total ?? 0)} currency={cur} style={{ color: colors.error, fontFamily: font.textBold, fontSize: 14, fontVariant: ['tabular-nums'] }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body style={{ color: colors.muted, fontSize: 12 }}>{t('export.netCashFlow')}</Body>
                  <MoneyValue value={reportSummary.net_total ?? 0} currency={cur} style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 14, fontVariant: ['tabular-nums'] }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body style={{ color: colors.muted, fontSize: 12 }}>{t('export.transactions')}</Body>
                  <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 14 }}>{reportSummary.transaction_count ?? 0}</Body>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: 4 }}>
                  <Body style={{ color: colors.muted, fontSize: 12 }}>{t('export.healthScore')}</Body>
                  <Body style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 14 }}>{analyticsSummary?.health_score ?? 0}/100</Body>
                </View>
              </View>
            </Card>
          ) : null}

          <Button
            testID="export-generate-btn"
            label={generating ? t('export.generating') : t('export.generateShare')}
            onPress={generate}
            loading={generating}
            disabled={loading || !reportSummary}
            style={{ marginTop: spacing.xl, opacity: loading || !reportSummary ? 0.5 : 1 }}
          />
          <Body muted style={{ fontSize: 11, marginTop: spacing.md, textAlign: 'center' }}>
            {t('export.previewPrivacy')}
          </Body>
          <Body muted style={{ fontSize: 11, marginTop: 4, textAlign: 'center' }}>
            {t('export.localOnly')}
          </Body>
        </View>
      </SafeAreaView>
    </Screen>
  );
}
