import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';

import { spacing, radius, font, formatMoneyCompact } from '@/src/theme/tokens';
import { Body } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useI18n } from '@/src/lib/I18nProvider';

export type NetWorthPoint = { date: string; net_worth: number };

/**
 * Minimal sparkline for recorded net-worth points.
 *
 * History starts when the app first records a point, so a fresh account shows
 * the explanatory empty state rather than an empty box.
 */
export function NetWorthTrend({
  points,
  currency,
  height = 120,
}: {
  points: NetWorthPoint[];
  currency: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (!points || points.length < 2) {
    return (
      <View style={{ paddingVertical: spacing.lg }}>
        <Body muted style={{ fontSize: 12 }}>{t('reports.trendEmpty')}</Body>
      </View>
    );
  }

  const values = points.map((p) => Number(p.net_worth) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 300;
  const pad = 6;

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const normalized = ((Number(point.net_worth) || 0) - min) / span;
    const y = pad + (1 - normalized) * (height - pad * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  const first = values[0];
  const last = values[values.length - 1];
  const changePct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const rising = last >= first;
  const stroke = rising ? colors.success : colors.error;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View>
          <Body muted style={{ fontSize: 11 }}>{points[0].date}</Body>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Body style={{ fontFamily: font.textBold, fontSize: 13, color: stroke }}>
            {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
          </Body>
          <Body muted style={{ fontSize: 11 }}>{points[points.length - 1].date}</Body>
        </View>
      </View>

      <View style={{ height, borderRadius: radius.md, backgroundColor: colors.surface3, overflow: 'hidden' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Line x1="0" y1={height - pad} x2={width} y2={height - pad} stroke={colors.border} strokeWidth="1" />
          <Polyline
            points={coords}
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Body muted style={{ fontSize: 11 }}>{formatMoneyCompact(min, currency)}</Body>
        <Body muted style={{ fontSize: 11 }}>{formatMoneyCompact(max, currency)}</Body>
      </View>
    </View>
  );
}
