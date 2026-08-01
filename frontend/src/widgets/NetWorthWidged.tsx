import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';

// Colors are hardcoded here (not pulled from ThemeProvider) because widgets render
// in a separate headless JS context outside the app's React tree/theme provider.
const BG = '#0B0B0F';
const CARD = '#17171C';
const GREEN = '#34D399';
const RED = '#F87171';
const MUTED = '#9CA3AF';
const WHITE = '#FFFFFF';

export type NetWorthWidgetData = {
  netWorth: string;      // pre-formatted, e.g. "Rp12.500.000"
  cashFlow: string;      // pre-formatted with sign, e.g. "+Rp850.000"
  cashFlowPositive: boolean;
  updatedAt: string;     // e.g. "09:41"
  signedOut?: boolean;
  chartUri?: string;     // base64 PNG data URI for the large variant
};

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

  return (
    <FlexWidget
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 16, padding: 16, justifyContent: 'space-between' }}
      clickAction="OPEN_APP"
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="NET WORTH" style={{ color: MUTED, fontSize: 11, letterSpacing: 1 }} />
        <TextWidget text={data.updatedAt} style={{ color: MUTED, fontSize: 10 }} />
      </FlexWidget>

      <TextWidget text={data.netWorth} style={{ color: WHITE, fontSize: large ? 22 : 26, fontWeight: '700' }} />

      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 }}>
        <TextWidget
          text={data.cashFlow}
          style={{ color: data.cashFlowPositive ? GREEN : RED, fontSize: 13, fontWeight: '600' }}
        />
        <TextWidget text=" this month" style={{ color: MUTED, fontSize: 12 }} />
      </FlexWidget>

      {large && data.chartUri && (
        <ImageWidget
          image={data.chartUri as `data:image${string}`}
          imageWidth={400}
          imageHeight={160}
          style={{ width: 'match_parent' }}
          resizeMode="contain"
        />
      )}
    </FlexWidget>
  );
}