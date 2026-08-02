import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { NetWorthWidget } from './NetWorthWidged';
import { fetchWidgetData, widgetIsLarge } from './widget-task-handler';

const WIDGET_NAME = 'NetWorth';

// Force the home-screen widget to re-render with fresh data. Android only
// auto-updates widgets every 30 minutes (platform minimum), so we call this
// from the app whenever the user sees fresh financial data — making the widget
// sync immediately instead of waiting for the next periodic update or a resize.
export async function refreshNetWorthWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const data = await fetchWidgetData();
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: async (widgetInfo) =>
        React.createElement(NetWorthWidget, { data, large: widgetIsLarge(widgetInfo?.height) }),
    });
  } catch {
    // no widget on home screen, or refresh failed — silent
  }
}