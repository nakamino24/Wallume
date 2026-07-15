import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NetWorthWidget, type NetWorthWidgetData } from '@/src/widgets/NetWorthWidged';
import { getToken } from '@/src/api/client';
import { formatMoney } from '@/src/theme/tokens';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function fetchWidgetData(): Promise<NetWorthWidgetData> {
  const token = await getToken();
  if (!token) return { signedOut: true, netWorth: '', cashFlow: '', cashFlowPositive: true, updatedAt: '' };

  try {
    const res = await fetch(`${BASE}/api/analytics/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    // Currency isn't available here (no React context) — the API doesn't
    // return it either, so we fall back to a plain number format. If you
    // want the user's actual currency symbol, add it to /analytics/summary.
    const netWorth = formatMoney(s.net_worth ?? 0, 'USD').replace('$', '');
    const cashFlow = formatMoney(Math.abs(s.cash_flow ?? 0), 'USD').replace('$', '');
    const now = new Date();
    return {
      netWorth,
      cashFlow: `${(s.cash_flow ?? 0) >= 0 ? '+' : '-'}${cashFlow}`,
      cashFlowPositive: (s.cash_flow ?? 0) >= 0,
      updatedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { netWorth: '—', cashFlow: '', cashFlowPositive: true, updatedAt: 'offline' };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const data = await fetchWidgetData();
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<NetWorthWidget data={data} />);
      break;
    case 'WIDGET_DELETED':
      // nothing to clean up — we don't persist per-widget state
      break;
    case 'WIDGET_CLICK':
      props.renderWidget(<NetWorthWidget data={data} />);
      break;
    default:
      break;
  }
}
