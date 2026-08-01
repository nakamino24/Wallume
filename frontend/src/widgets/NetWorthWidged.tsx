import React from 'react';
import { FlexWidget, TextWidget, ImageWidget, type HexColor } from 'react-native-android-widget';

// Colors are hardcoded here (no React context in widget headless render).
const BG = '#0B0B0F';
const CARD = '#17171C';
const TEAL = '#3FA796';
const ORANGE = '#F4A261';
const RED = '#D32F2F';
const GREEN = '#2E7D32';
const NAVY = '#16213E';
const AMBER = '#ED6C02';
const GRAY = '#9CA3AF';
const MUTED = '#9CA3AF';
const WHITE = '#FFFFFF';

const PIE_COLORS = [TEAL, ORANGE, RED, GREEN, NAVY, AMBER, GRAY, '#222222'] as const;

export type WidgetCategory = { label: string; amount: number };

export type NetWorthWidgetData = {
  netWorth: string;      // pre-formatted, home currency, no symbol
  income: string;        // pre-formatted period income, no symbol
  healthScore: number;   // 0..100
  chartUri?: string;     // base64 PNG pie chart
  categories: WidgetCategory[];
  updatedAt: string;     // e.g. "09:41"
  signedOut?: boolean;
};

function LegendDot({ color }: { color: HexColor }) {
  return <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export function NetWorthWidget({ data, large }: { data: NetWorthWidgetData; large?: boolean }) {
  if (data.signedOut) {
    return (
      <FlexWidget
        style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 16, padding: 16, justifyContent: 'center', alignItems: 'center' }}
        clickAction="OPEN_APP"
      >
        <TextWidget text="Open Wallume to sign in" style={{ color: MUTED, fontSize: 13 }} />
      </FlexWidget>
    );
  }

  const legend = data.categories.length
    ? data.categories.map((c, i) => (
        <FlexWidget key={c.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <LegendDot color={PIE_COLORS[i % PIE_COLORS.length]} />
          <TextWidget text={` ${c.label}`} style={{ color: MUTED, fontSize: large ? 12 : 10 }} maxLines={1} />
        </FlexWidget>
      ))
    : <TextWidget text="No spending yet" style={{ color: MUTED, fontSize: 11 }} />;

  return (
    <FlexWidget
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 16, padding: large ? 16 : 12, justifyContent: 'space-between' }}
      clickAction="OPEN_APP"
    >
      {/* Header row: label + time */}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="WALLUME" style={{ color: MUTED, fontSize: 10, letterSpacing: 1 }} />
        <TextWidget text={data.updatedAt} style={{ color: MUTED, fontSize: 10 }} />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
        {/* Left: net worth + income (+ health for large) */}
        <FlexWidget style={{ flex: 1, justifyContent: 'center' }}>
          <TextWidget text="Net worth" style={{ color: MUTED, fontSize: 11 }} />
          <TextWidget text={data.netWorth} style={{ color: WHITE, fontSize: large ? 22 : 16, fontWeight: '700' }} maxLines={1} />
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: large ? 8 : 4 }}>
            <TextWidget text="Income" style={{ color: MUTED, fontSize: large ? 12 : 10 }} />
            <TextWidget text={`  ${data.income}`} style={{ color: TEAL, fontSize: large ? 13 : 11, fontWeight: '600' }} />
          </FlexWidget>
          {large && (
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <TextWidget text="Financial Health  " style={{ color: MUTED, fontSize: 12 }} />
              <TextWidget text={`${data.healthScore}%`} style={{ color: ORANGE, fontSize: 14, fontWeight: '700' }} />
            </FlexWidget>
          )}
        </FlexWidget>

        {/* Right: mini pie chart + legend */}
        <FlexWidget style={{ alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
          {data.chartUri ? (
            <ImageWidget
              image={data.chartUri as `data:image${string}`}
              imageWidth={large ? 120 : 84}
              imageHeight={large ? 120 : 84}
              resizeMode="contain"
            />
          ) : (
            <FlexWidget style={{ width: large ? 80 : 56, height: large ? 80 : 56, borderRadius: large ? 40 : 28, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <TextWidget text="—" style={{ color: MUTED, fontSize: 14 }} />
            </FlexWidget>
          )}
          {legend}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}