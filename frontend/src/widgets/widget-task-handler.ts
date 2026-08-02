import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NetWorthWidget, NetWorthWidgetData } from './NetWorthWidged';
import { getToken } from '@/src/api/client';
import { formatMoney } from '@/src/theme/tokens';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

// 3x2 ≈ ~140dp tall, 6x4 ≈ ~280dp tall. Anything taller than this is the large variant.
export const LARGE_HEIGHT_DP = 170;

export function widgetIsLarge(height?: number): boolean {
  return (height ?? 0) > LARGE_HEIGHT_DP;
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? CHARS[b2 & 63] : '=';
  }
  return out;
}

export async function fetchWidgetData(): Promise<NetWorthWidgetData> {
  const token = await getToken();
  if (!token) return { signedOut: true, netWorth: '', income: '', healthScore: 0, chartUri: undefined, categories: [], updatedAt: '' };

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${BASE}/api/analytics/summary`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const s = raw && raw.success !== undefined && raw.data ? raw.data : raw;

    let chartUri: string | undefined;
    try {
      const chartRes = await fetch(`${BASE}/api/analytics/spending-chart`, { headers });
      if (chartRes.ok) {
        const buf = await chartRes.arrayBuffer();
        chartUri = `data:image/png;base64,${bytesToBase64(new Uint8Array(buf))}`;
      }
    } catch {
      chartUri = undefined;
    }

    const now = new Date();
    const categories = (s.category_breakdown || []).slice(0, 5).map((c: any) => ({ label: c.category, amount: c.amount }));
    return {
      netWorth: formatMoney(s.net_worth ?? 0, 'USD').replace('$', ''),
      income: formatMoney(s.month_income ?? 0, 'USD').replace('$', ''),
      healthScore: s.health_score ?? 0,
      chartUri,
      categories,
      updatedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { signedOut: false, netWorth: '—', income: '', healthScore: 0, chartUri: undefined, categories: [], updatedAt: 'offline' };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const data = await fetchWidgetData();
  const isLarge = widgetIsLarge(props.widgetInfo?.height);
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK':
      props.renderWidget(React.createElement(NetWorthWidget, { data, large: isLarge }));
      break;
    case 'WIDGET_DELETED':
      break;
    default:
      break;
  }
}