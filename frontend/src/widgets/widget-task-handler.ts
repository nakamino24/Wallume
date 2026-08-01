import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NetWorthWidget, NetWorthWidgetData } from './NetWorthWidged';
import { getToken } from '@/src/api/client';
import { formatMoney } from '@/src/theme/tokens';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

const SMALL_HEIGHT_DP = 150;

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

async function fetchWidgetData(): Promise<NetWorthWidgetData> {
  const token = await getToken();
  if (!token) return { signedOut: true, netWorth: '', cashFlow: '', cashFlowPositive: true, updatedAt: '', chartUri: undefined };

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${BASE}/api/analytics/summary`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();

    // Chart image for the large variant — fetched with auth headers, then
    // converted to a base64 data URI so the native ImageWidget can render it
    // without sending the token in a URL query string.
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

    const netWorth = formatMoney(s.net_worth ?? 0, 'USD').replace('$', '');
    const cashFlow = formatMoney(Math.abs(s.cash_flow ?? 0), 'USD').replace('$', '');
    const now = new Date();
    return {
      netWorth,
      cashFlow: `${(s.cash_flow ?? 0) >= 0 ? '+' : '-'}${cashFlow}`,
      cashFlowPositive: (s.cash_flow ?? 0) >= 0,
      updatedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      chartUri,
    };
  } catch {
    return { netWorth: '—', cashFlow: '', cashFlowPositive: true, updatedAt: 'offline', chartUri: undefined };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const data = await fetchWidgetData();
  const isLarge = (props.widgetInfo?.height ?? SMALL_HEIGHT_DP) > SMALL_HEIGHT_DP;
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