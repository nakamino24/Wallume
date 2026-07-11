import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Circle as SvgCircle, Path, G, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoney, formatMoneyFull } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, DisplayNumber, EmptyState } from '@/src/components/ui';

const CAT_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#34D399', '#FBBF24', '#F87171', '#A7F3D0', '#065F46'];

export default function Reports() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(async () => {
    try { setSummary(await api.summary()); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cur = user?.currency || 'USD';

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md }}>Reports</H2>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 60 }}>
          <Card style={{ backgroundColor: colors.inverse }}>
            <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Net worth</Label>
            <DisplayNumber size={34} color={colors.onInverse} style={{ marginTop: 6 }}>
              {formatMoneyFull(summary?.net_worth ?? 0, cur)}
            </DisplayNumber>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.md }}>
              <MiniStat label="Wallets" value={formatMoney(summary?.wallet_total ?? 0, cur)} light />
              <MiniStat label="Investments" value={formatMoney(summary?.investment_total ?? 0, cur)} light />
              <MiniStat label="Assets" value={formatMoney(summary?.asset_total ?? 0, cur)} light />
              <MiniStat label="Debts" value={formatMoney(summary?.debt_total ?? 0, cur)} light negative />
            </View>
          </Card>

          <Card>
            <Label>Income vs Expense · last 6 months</Label>
            <View style={{ marginTop: spacing.md }}>
              <BarChart trend={summary?.trend || []} />
            </View>
          </Card>

          <Card>
            <Label>Expense breakdown · this month</Label>
            {(!summary?.category_breakdown || summary.category_breakdown.length === 0) ? (
              <Body muted style={{ marginTop: spacing.md }}>Add expenses to see the breakdown.</Body>
            ) : (
              <>
                <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                  <DonutChart data={summary.category_breakdown} />
                </View>
                <View style={{ marginTop: spacing.md, gap: 8 }}>
                  {summary.category_breakdown.map((c: any, i: number) => (
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

          <Card>
            <Label>Ratios</Label>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.md }}>
              <MiniStat label="Saving rate" value={`${summary?.saving_rate ?? 0}%`} />
              <MiniStat label="Debt ratio" value={`${summary?.debt_ratio ?? 0}%`} />
              <MiniStat label="Health score" value={`${summary?.health_score ?? 0}/100`} />
              <MiniStat label="Cash flow" value={formatMoney(summary?.cash_flow ?? 0, cur)} />
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function MiniStat({ label, value, light, negative }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ minWidth: 100 }}>
      <Body style={{ color: light ? colors.onInverse : colors.muted, opacity: light ? 0.6 : 1, fontSize: 12 }}>{label}</Body>
      <Body style={{ color: light ? colors.onInverse : negative ? colors.error : colors.onSurface, fontFamily: font.displayBold, fontSize: 18, marginTop: 2 }}>{value}</Body>
    </View>
  );
}

function BarChart({ trend }: any) {
  const { colors } = useTheme();
  const width = Dimensions.get('window').width - spacing.xl * 2 - spacing.lg * 2;
  const height = 160;
  const pad = 24;
  const max = Math.max(1, ...trend.map((t: any) => Math.max(t.income, t.expense)));
  const bw = trend.length ? (width - pad * 2) / trend.length / 3 : 10;

  return (
    <Svg width={width} height={height}>
      {trend.map((t: any, i: number) => {
        const xBase = pad + i * ((width - pad * 2) / trend.length);
        const incH = (t.income / max) * (height - 40);
        const expH = (t.expense / max) * (height - 40);
        return (
          <G key={i}>
            <Rect x={xBase} y={height - 20 - incH} width={bw} height={incH} fill={colors.success} rx={3} />
            <Rect x={xBase + bw + 4} y={height - 20 - expH} width={bw} height={expH} fill={colors.error} rx={3} />
            <SvgText x={xBase + bw} y={height - 4} fontSize="10" fill={colors.muted} textAnchor="middle">{t.month}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function DonutChart({ data }: any) {
  const total = data.reduce((s: number, d: any) => s + d.amount, 0);
  const size = 180;
  const r = 70; const stroke = 24;
  const c = 2 * Math.PI * r;
  let accum = 0;
  return (
    <Svg width={size} height={size}>
      <G transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
        <SvgCircle r={r} cx={0} cy={0} fill="none" stroke="#33333322" strokeWidth={stroke} />
        {data.map((d: any, i: number) => {
          const frac = total > 0 ? d.amount / total : 0;
          const dash = frac * c;
          const el = (
            <SvgCircle
              key={d.category}
              r={r} cx={0} cy={0}
              fill="none"
              stroke={CAT_COLORS[i % CAT_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-accum}
            />
          );
          accum += dash;
          return el;
        })}
      </G>
    </Svg>
  );
}
