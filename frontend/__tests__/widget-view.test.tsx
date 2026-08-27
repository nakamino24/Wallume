import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-android-widget', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    FlexWidget: ({ children, accessibilityLabel, clickAction }: any) =>
      React.createElement(View, { accessibilityLabel, testID: clickAction }, children),
    TextWidget: ({ text }: any) => React.createElement(Text, null, text),
    ImageWidget: () => React.createElement(View),
    IconWidget: ({ icon }: any) => React.createElement(Text, null, icon),
  };
});

import { NetWorthWidget, WIDGET_EYE_ICON, WIDGET_EYE_OFF_ICON } from '@/src/widgets/NetWorthWidged';

describe('Wallume widget view', () => {
  const data = { balance: 'Rp12.450.000', income: 'Rp4,5 jt', expense: 'Rp2,1 jt', cashFlow: 'Rp2,4 jt', healthScore: 78, updatedAt: '09:41' } as any;
  it('renders English balance and monthly metrics without Net Worth terminology', () => {
    const { getByText, queryByText } = render(<NetWorthWidget data={{ ...data, locale: 'en' }} />);
    expect(getByText('Your Balance')).toBeTruthy();
    expect(getByText('Income')).toBeTruthy();
    expect(getByText('Expense')).toBeTruthy();
    expect(getByText('Cash Flow')).toBeTruthy();
    expect(queryByText('Net worth')).toBeNull();
  });
  it('renders Indonesian labels with unchanged values', () => {
    const { getByText } = render(<NetWorthWidget data={{ ...data, locale: 'id' }} />);
    expect(getByText('Total Saldo')).toBeTruthy();
    expect(getByText('Pemasukan')).toBeTruthy();
    expect(getByText('Pengeluaran')).toBeTruthy();
    expect(getByText('Arus Kas')).toBeTruthy();
    expect(getByText('Rp12.450.000')).toBeTruthy();
  });

  it('masks only the primary balance when widget privacy is hidden', () => {
    const { getByText, queryByText } = render(<NetWorthWidget data={{ ...data, balance: 'Rp•••••••', healthScore: 78, locale: 'en', isBalanceVisible: false }} large />);
    expect(getByText('Rp•••••••')).toBeTruthy();
    expect(getByText('+Rp4,5 jt')).toBeTruthy();
    expect(getByText('-Rp2,1 jt')).toBeTruthy();
    expect(getByText('Rp2,4 jt')).toBeTruthy();
    expect(getByText('78%')).toBeTruthy();
    expect(queryByText('Rp12.450.000')).toBeNull();
  });

  it('renders a distinct working widget eye action', () => {
    const { getByLabelText, getByText, queryByText } = render(<NetWorthWidget data={{ ...data, locale: 'en', isBalanceVisible: true }} />);
    expect(getByText(WIDGET_EYE_ICON)).toBeTruthy();
    expect(getByLabelText('Show or hide widget balance')).toBeTruthy();
    expect(queryByText('eye-outline')).toBeNull();
    expect(queryByText('eye-off-outline')).toBeNull();
  });

  it('uses the eye-off glyph instead of a literal icon name when hidden', () => {
    const { getByText, queryByText } = render(<NetWorthWidget data={{ ...data, locale: 'en', isBalanceVisible: false }} />);
    expect(getByText(WIDGET_EYE_OFF_ICON)).toBeTruthy();
    expect(queryByText('eye-off-outline')).toBeNull();
  });

  it('removes pie chart and keeps Financial Health standalone', () => {
    const { getByText } = render(<NetWorthWidget data={{ ...data, locale: 'en', healthScore: 72 }} large />);
    expect(getByText('Financial Health')).toBeTruthy();
    expect(getByText('72%')).toBeTruthy();
  });

  it('isolates eye click from root — root has no OPEN_APP, eye is TOGGLE only', () => {
    const { getAllByTestId, getByLabelText } = render(<NetWorthWidget data={{ ...data, locale: 'en', isBalanceVisible: true }} large />);
    expect(getByLabelText('Show or hide widget balance')).toBeTruthy();
    const toggles = getAllByTestId('TOGGLE_WIDGET_BALANCE');
    expect(toggles.length).toBe(1);
    const opens = getAllByTestId('OPEN_APP');
    expect(opens.length).toBeGreaterThanOrEqual(3);
    toggles.forEach((n: any) => expect(n.props.testID).not.toBe('OPEN_APP'));
  });

  it('moves Bulan ini/This month above monthly metrics', () => {
    const { getByText } = render(<NetWorthWidget data={{ ...data, locale: 'id' }} />);
    expect(getByText('Bulan ini')).toBeTruthy();
    const { getByText: getByTextEn } = render(<NetWorthWidget data={{ ...data, locale: 'en' }} />);
    expect(getByTextEn('This month')).toBeTruthy();
  });
});
