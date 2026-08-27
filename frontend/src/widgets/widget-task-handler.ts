import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NetWorthWidget, NetWorthWidgetData } from './NetWorthWidged';
import { getToken } from '@/src/api/client';
import { currencySymbol, formatMoney } from '@/src/theme/tokens';
import { initLocale } from '@/src/lib/i18n';
import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const WIDGET_BALANCE_VISIBILITY_KEY = 'wallume.widget.showBalance';

// 3x2 ≈ ~140dp tall, 6x4 ≈ ~280dp tall. Anything taller than this is the large variant.
export const LARGE_HEIGHT_DP = 170;

export function widgetIsLarge(height?: number): boolean {
  return (height ?? 0) > LARGE_HEIGHT_DP;
}

export async function toggleWidgetBalanceVisibility(): Promise<void> {
  const saved = await storage.getItem<boolean | null>(WIDGET_BALANCE_VISIBILITY_KEY, null);
  await storage.setItem(WIDGET_BALANCE_VISIBILITY_KEY, saved !== true);
}

export async function fetchWidgetData(): Promise<NetWorthWidgetData> {
  const token = await getToken();
  if (!token) return { signedOut: true, balance: '', income: '', expense: '', cashFlow: '', healthScore: 0, updatedAt: '', isBalanceVisible: false };

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${BASE}/api/analytics/summary`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const s = raw && raw.success !== undefined && raw.data ? raw.data : raw;

    const now = new Date();
    const locale = await initLocale();
    const currency = (await storage.getItem<string>('mf.widget.currency', 'USD')) || 'USD';
    const theme = (await storage.getItem<string | null>('mf.theme', null)) as 'light' | 'dark' | null;
    // Widget visibility is intentionally independent from the in-app balance preference.
    const showBalances = await storage.getItem<boolean | null>(WIDGET_BALANCE_VISIBILITY_KEY, null);
    const isVisible = showBalances === true;
    const mask = (cur: string) => {
      return `${currencySymbol(cur)}${cur === 'IDR' ? '•••••••' : '••••••'}`;
    };
    const timeStr = now.toLocaleTimeString(locale === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const updatedAt = locale === 'id' ? `Diperbarui ${timeStr}` : `Updated ${timeStr}`;
    return {
      balance: isVisible ? formatMoney(s.wallet_total ?? 0, currency) : mask(currency),
      income: formatMoney(s.month_income ?? 0, currency),
      expense: formatMoney(s.month_expense ?? 0, currency),
      cashFlow: formatMoney(s.cash_flow ?? 0, currency),
      healthScore: s.health_score ?? 0,
      updatedAt,
      locale,
      theme: theme === 'light' ? 'light' : 'dark',
      isBalanceVisible: isVisible,
    };
  } catch {
    return { signedOut: false, balance: '—', income: '', expense: '', cashFlow: '', healthScore: 0, updatedAt: 'offline', isBalanceVisible: false };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_CLICK' && props.clickAction === 'TOGGLE_WIDGET_BALANCE') {
    await toggleWidgetBalanceVisibility();
  }
  const data = await fetchWidgetData();
  const height = props.widgetInfo?.height;
  const isSmall = height != null && height < 120;
  const isLarge = widgetIsLarge(height);
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK':
      props.renderWidget(React.createElement(NetWorthWidget, { data, large: isLarge, small: isSmall } as any));
      break;
    case 'WIDGET_DELETED':
      break;
    default:
      break;
  }
}
