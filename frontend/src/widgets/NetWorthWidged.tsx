import React from 'react';
import { FlexWidget, TextWidget, ImageWidget, type HexColor } from 'react-native-android-widget';

// Colors are hardcoded here (no React context in widget headless render).
const BG = '#164B43';
const TEAL = '#9BDBC6';
const RED = '#F0A0A0';
const GREEN = '#94D2B4';
const MUTED = '#C5D8D1';
const WHITE = '#FFFFFF';

const PIE_COLORS = [TEAL, '#DAB572', RED, GREEN, '#89B6C4', '#C89A79', MUTED, '#5F7770'] as const;

export type WidgetCategory = { label: string; amount: number };

export type NetWorthWidgetData = {
  balance: string;
  income: string;
  expense: string;
  cashFlow: string;
  healthScore: number;   // 0..100
  chartUri?: string;     // base64 PNG pie chart
  categories: WidgetCategory[];
  updatedAt: string;     // e.g. "09:41"
  signedOut?: boolean;
  locale?: 'en' | 'id';
};

function LegendDot({ color }: { color: HexColor }) {
  return <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export function NetWorthWidget({ data, large }: { data: NetWorthWidgetData; large?: boolean }) {
  const id = data.locale === 'id';
  const baseLabels = widgetLabels(data.locale);
  const labels = { ...baseLabels, offline: id ? 'Buka Wallume untuk masuk' : 'Open Wallume to sign in' };
  if (data.signedOut) {
    return (
      <FlexWidget
        style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 16, padding: 16, justifyContent: 'center', alignItems: 'center' }}
        clickAction="OPEN_APP"
      >
        <TextWidget text={labels.offline} style={{ color: MUTED, fontSize: 13 }} />
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
    : <TextWidget text={id ? 'Belum ada pengeluaran' : 'No spending yet'} style={{ color: MUTED, fontSize: 11 }} />;

  return (
    <FlexWidget
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 16, padding: large ? 16 : 12, justifyContent: 'space-between' }}
      clickAction="OPEN_APP"
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="W  WALLUME" style={{ color: MUTED, fontSize: 10, letterSpacing: 1 }} />
        <TextWidget text={data.updatedAt} style={{ color: MUTED, fontSize: 10 }} />
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent' }}>
        <TextWidget text={labels.balance} style={{ color: MUTED, fontSize: 11 }} />
        <TextWidget text={data.balance} style={{ color: WHITE, fontSize: large ? 26 : 21, fontWeight: '700' }} maxLines={1} />
        <TextWidget text={labels.month} style={{ color: MUTED, fontSize: 10, marginTop: 2 }} />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
        <Metric label={labels.income} value={`+${data.income}`} color={GREEN} />
        <Metric label={labels.expense} value={`-${data.expense}`} color={RED} />
        <Metric label={labels.cashFlow} value={data.cashFlow} color={data.cashFlow.startsWith('-') ? RED : TEAL} />
      </FlexWidget>

      {large && (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 2 }}>
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={id ? 'Kesehatan finansial' : 'Financial Health'} style={{ color: MUTED, fontSize: 11 }} />
            <TextWidget text={`${data.healthScore}%`} style={{ color: TEAL, fontSize: 16, fontWeight: '700', marginTop: 2 }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
            {data.chartUri ? <ImageWidget image={data.chartUri as `data:image${string}`} imageWidth={72} imageHeight={72} resizeMode="contain" /> : legend}
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

export function widgetLabels(locale: 'en' | 'id' = 'en') {
  return locale === 'id'
    ? { balance: 'Total Saldo', income: 'Pemasukan', expense: 'Pengeluaran', cashFlow: 'Arus Kas', month: 'Bulan ini' }
    : { balance: 'Your Balance', income: 'Income', expense: 'Expense', cashFlow: 'Cash Flow', month: 'This month' };
}

function Metric({ label, value, color }: { label: string; value: string; color: HexColor }) {
  return (
    <FlexWidget style={{ flex: 1 }}>
      <TextWidget text={label} style={{ color: MUTED, fontSize: 10 }} maxLines={1} />
      <TextWidget text={value} style={{ color, fontSize: 12, fontWeight: '600', marginTop: 2 }} maxLines={1} />
    </FlexWidget>
  );
}
