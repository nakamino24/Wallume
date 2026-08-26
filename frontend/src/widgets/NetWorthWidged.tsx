import React from 'react';
import { FlexWidget, TextWidget, ImageWidget, IconWidget, type HexColor } from 'react-native-android-widget';

// Theme-aware colors — widget is headless, so we read theme from storage and apply the same
// graphite/midnight + teal-accent system as the app. No solid green background.
const DARK_BG = '#11131A';
const DARK_MUTED = '#A7AEC0';
const DARK_WHITE = '#F2F3F8';
const DARK_TEAL = '#70C8B1';
const DARK_GREEN = '#83D2AA';
const DARK_RED = '#F19B9D';

const LIGHT_BG = '#F6F7F3';
const LIGHT_MUTED = '#70807A';
const LIGHT_CHARCOAL = '#1C2926';
const LIGHT_TEAL = '#287565';
const LIGHT_GREEN = '#247A57';
const LIGHT_RED = '#B64A4A';

const PIE_COLORS_DARK = [DARK_TEAL, '#DAB572', DARK_RED, DARK_GREEN, '#89B6C4', '#C89A79', DARK_MUTED, '#5F7770'] as const;
const PIE_COLORS_LIGHT = [LIGHT_TEAL, '#D69A57', LIGHT_RED, LIGHT_GREEN, '#527C8A', '#8B7763', LIGHT_MUTED, '#70807A'] as const;

export type WidgetCategory = { label: string; amount: number };

export type NetWorthWidgetData = {
  balance: string;
  income: string;
  expense: string;
  cashFlow: string;
  healthScore: number;   // 0..100
  chartUri?: string;     // base64 PNG pie chart
  categories: WidgetCategory[];
  updatedAt: string;     // e.g. "Diperbarui 20.45" / "Updated 8:45 PM"
  signedOut?: boolean;
  locale?: 'en' | 'id';
  theme?: 'light' | 'dark';
  isBalanceVisible?: boolean;
};

function LegendDot({ color }: { color: HexColor }) {
  return <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export function NetWorthWidget({ data, large, small }: { data: NetWorthWidgetData; large?: boolean; small?: boolean }) {
  const id = data.locale === 'id';
  const isDark = data.theme !== 'light';
  const BG = isDark ? DARK_BG : LIGHT_BG;
  const MUTED = isDark ? DARK_MUTED : LIGHT_MUTED;
  const WHITE = isDark ? DARK_WHITE : LIGHT_CHARCOAL;
  const TEAL = isDark ? DARK_TEAL : LIGHT_TEAL;
  const GREEN = isDark ? DARK_GREEN : LIGHT_GREEN;
  const RED = isDark ? DARK_RED : LIGHT_RED;
  const PIE_COLORS = isDark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT;
  const baseLabels = widgetLabels(data.locale);
  const labels = {
    ...baseLabels,
    offline: id ? 'Buka Wallume untuk masuk' : 'Open Wallume to sign in',
    toggleBalance: data.isBalanceVisible === true ? (id ? 'Sembunyikan' : 'Hide') : (id ? 'Tampilkan' : 'Show'),
  };
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
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 16, padding: large ? 14 : 12, justifyContent: 'space-between' }}
      clickAction="OPEN_APP"
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="W  WALLUME" style={{ color: TEAL, fontSize: 10, letterSpacing: 1, fontWeight: '700' }} />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text={data.updatedAt} style={{ color: MUTED, fontSize: 9 }} maxLines={1} />
          <IconWidget icon={data.isBalanceVisible === true ? 'eye-outline' : 'eye-off-outline'} font="Ionicons" size={16} style={{ color: WHITE, marginLeft: 8 }} clickAction="TOGGLE_WIDGET_BALANCE" accessibilityLabel={id ? 'Tampilkan atau sembunyikan saldo widget' : 'Show or hide widget balance'} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', marginTop: 4 }}>
        <TextWidget text={labels.balance} style={{ color: isDark ? '#C3C8D4' : '#50605C', fontSize: 11 }} />
        <TextWidget text={data.balance} style={{ color: WHITE, fontSize: large ? 24 : 20, fontWeight: '700' }} maxLines={1} />
        <TextWidget text={labels.month} style={{ color: isDark ? '#B6BDCB' : '#5E6C68', fontSize: 10, marginTop: 1 }} />
      </FlexWidget>

      {!small && (
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', marginTop: 4 }}>
          <Metric label={labels.income} value={data.income} color={GREEN} mutedColor={MUTED} isIncome />
          <Metric label={labels.expense} value={data.expense} color={RED} mutedColor={MUTED} isExpense />
          <Metric label={labels.cashFlow} value={data.cashFlow} color={data.cashFlow.includes('•') ? MUTED : data.cashFlow.trim().startsWith('-') || data.cashFlow.trim().startsWith('−') ? RED : TEAL} mutedColor={MUTED} />
        </FlexWidget>
      )}

      {large && (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 4 }}>
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={id ? 'Kesehatan finansial' : 'Financial Health'} style={{ color: MUTED, fontSize: 11 }} />
            <TextWidget text={`${data.healthScore}%`} style={{ color: TEAL, fontSize: 15, fontWeight: '700', marginTop: 2 }} />
          </FlexWidget>
          <FlexWidget style={{ alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
            {data.chartUri ? <ImageWidget image={data.chartUri as `data:image${string}`} imageWidth={68} imageHeight={68} resizeMode="contain" /> : legend}
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

function Metric({ label, value, color, mutedColor, isIncome, isExpense }: { label: string; value: string; color: HexColor; mutedColor?: HexColor; isIncome?: boolean; isExpense?: boolean }) {
  const muted = mutedColor ?? '#A7AEC0';
  const display = value.includes('•') ? (isIncome ? `+${value}` : isExpense ? `-${value}` : value) : (isIncome ? `+${value}` : isExpense ? `-${value}` : value);
  const labelColor = muted;
  return (
    <FlexWidget style={{ flex: 1, alignItems: 'center' }}>
      <TextWidget text={label} style={{ color: labelColor, fontSize: 10 }} maxLines={1} />
      <TextWidget text={display} style={{ color, fontSize: 11, fontWeight: '600', marginTop: 2 }} maxLines={1} />
    </FlexWidget>
  );
}
