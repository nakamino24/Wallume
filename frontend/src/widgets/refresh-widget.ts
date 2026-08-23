import React from 'react';
import { isWidgetSupported } from './expo-env';
import type { NetWorthWidgetData } from './NetWorthWidged';

const WIDGET_NAME = 'NetWorth';

// Force the home-screen widget to re-render with fresh data. Android only
// auto-updates widgets every 30 minutes (platform minimum), so we call this
// from the app whenever the user sees fresh financial data — making the widget
// sync immediately instead of waiting for the next periodic update or a resize.
//
// Everything that pulls in react-native-android-widget is required LAZILY inside
// this function (never at module scope). On Expo Go the native module doesn't
// exist, so a static import would throw during bundle evaluation and blank the
// whole app. The guard keeps the home screen safe while a real dev/client build
// still gets live widget updates.
export async function refreshNetWorthWidget(): Promise<void> {
  if (!isWidgetSupported) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestWidgetUpdate } = require('react-native-android-widget');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NetWorthWidget } = require('./NetWorthWidged');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchWidgetData, widgetIsLarge } = require('./widget-task-handler');
    const data: NetWorthWidgetData = await fetchWidgetData();
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: async (widgetInfo: { height?: number }) =>
        React.createElement(NetWorthWidget, { data, large: widgetIsLarge(widgetInfo?.height) }),
    });
  } catch {
    // no widget on home screen, or refresh failed — silent
  }
}