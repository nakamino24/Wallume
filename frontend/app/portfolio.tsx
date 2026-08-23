import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle, G } from 'react-native-svg';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, font, formatMoney } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H2, Body, Label, DisplayNumber } from '@/src/components/ui';
import { computeInvestmentMetrics, kindLabel, quantitySummary, type InvestmentDoc } from '@/src/lib/investmentKinds';

const TYPE_COLORS: Record<string, string> = {
  stock: '#10B981', etf: '#34D399', mutual_fund: '#059669',
  bond: '#F59E0B', crypto: '#F87171', gold: '#FBBF24',
  cash: '#A1A1AA', other: '#6B7280',
};

const ICONS: Record<string, any> = {
  stock: 'trending-up', etf: 'layers', mutual_fund: 'briefcase',
  bond: 'link', crypto: 'logo-bitcoin', gold: 'diamond',
  cash: 'cash', other: 'ellipsis-horizontal',
};

export default function Portfolio() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const cur = user?.currency || 'USD';
  const [investments, setInvestments] = useState<InvestmentDoc[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.investments();
      setInvestments(r.investments || []);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { totalValue, totalCost, totalPl, returnPct, byKind } = useMemo(() => {
    let val = 0, cost = 0;
    const kinds: Record<string, { value: number; cost: number; count: number }> = {};
    for (const iv of investments) {
      const m = computeInvestmentMetrics(iv);
      val += m.value; cost += m.cost;
      const k = iv.kind || 'other';
      if (!kinds[k]) kinds[k] = { value: 0, cost: 0, count: 0 };
      kinds[k].value += m.value;
      kinds[k].cost += m.cost;
      kinds[k].count += 1;
    }
    const pnl = val - cost;
    const ret = cost > 0 ? (pnl / cost) * 100 : 0;
    return { totalValue: val, totalCost: cost, totalPl: pnl, returnPct: ret, byKind: kinds };
  }, [investments]);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md }}>Portfolio</H2>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 60 }}>
          {/* Hero */}
          <Card style={{ backgroundColor: colors.inverse }}>
            <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Total portfolio value</Label>
            <DisplayNumber size={36} color={colors.onInverse} style={{ marginTop: 6 }}>
              {formatMoney(totalValue, cur)}
            </DisplayNumber>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
              <View>
                <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Total invested</Label>
                <Body style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                  {formatMoney(totalCost, cur)}
                </Body>
              </View>
              <View>
                <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Return</Label>
                <Body style={{ color: totalPl >= 0 ? colors.success : colors.error, fontFamily: font.displayBold, fontSize: 16, marginTop: 2 }}>
                  {totalPl >= 0 ? '+' : ''}{formatMoney(totalPl, cur)} ({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%)
                </Body>
              </View>
            </View>
          </Card>

          {/* Allocation */}
          {Object.keys(byKind).length > 1 && (
            <Card>
              <Label>Allocation by type</Label>
              <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                <DonutChart data={Object.entries(byKind).map(([k, v]) => ({ kind: k, value: v.value }))} />
              </View>
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {Object.entries(byKind)
                  .sort(([, a], [, b]) => b.value - a.value)
                  .map(([k, v]) => {
                    const pct = totalValue > 0 ? (v.value / totalValue) * 100 : 0;
                    return (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: TYPE_COLORS[k] || TYPE_COLORS.other, marginRight: 8 }} />
                        <Body style={{ flex: 1, textTransform: 'capitalize' }}>{k.replace('_', ' ')}</Body>
                        <Body style={{ fontFamily: font.textMedium, marginRight: spacing.md }}>{pct.toFixed(1)}%</Body>
                        <Body style={{ fontFamily: font.displayBold }}>{formatMoney(v.value, cur)}</Body>
                      </View>
                    );
                  })}
              </View>
            </Card>
          )}

          {/* Holdings */}
          <Label>Holdings ({investments.length})</Label>
          {investments.length === 0 ? (
            <Body muted style={{ textAlign: 'center', marginTop: spacing.md }}>No investments yet.</Body>
          ) : investments.map((iv) => {
            const { value, pl, returnPct: rp } = computeInvestmentMetrics(iv);
            const plColor = pl >= 0 ? colors.success : colors.error;
            return (
              <Card key={iv.id} onPress={() => router.push(`/investment/${iv.id}` as any)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (TYPE_COLORS[iv.kind] || colors.surface3) + '22', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                    <Ionicons name={ICONS[iv.kind] || 'ellipsis-horizontal'} size={18} color={TYPE_COLORS[iv.kind] || colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{iv.name}</Body>
                    <Body muted style={{ fontSize: 12, marginTop: 2 }}>
                      {kindLabel(iv.kind)} · {quantitySummary(iv)}
                    </Body>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Body style={{ fontFamily: font.displayBold }}>{formatMoney(value, cur)}</Body>
                    <Body style={{ marginTop: 2, color: plColor, fontFamily: font.textMedium, fontSize: 12 }}>
                      {pl >= 0 ? '+' : ''}{formatMoney(pl, cur)} ({rp >= 0 ? '+' : ''}{rp.toFixed(1)}%)
                    </Body>
                  </View>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function DonutChart({ data }: { data: { kind: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 160;
  const r = 60;
  const stroke = 20;
  const c = 2 * Math.PI * r;
  let accum = 0;
  if (total <= 0) return null;
  return (
    <Svg width={size} height={size}>
      <G transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
        <SvgCircle r={r} cx={0} cy={0} fill="none" stroke="#27272A" strokeWidth={stroke} />
        {data.map((d) => {
          const frac = d.value / total;
          const dash = frac * c;
          const el = (
            <SvgCircle
              key={d.kind}
              r={r} cx={0} cy={0}
              fill="none"
              stroke={TYPE_COLORS[d.kind] || TYPE_COLORS.other}
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