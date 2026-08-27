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
  const data = { balance: 'Rp12.450.000', income: 'Rp4,5 jt', expense: 'Rp2,1 jt', cashFlow: 'Rp2,4 jt', healthScore: 78, categories: [], updatedAt: '09:41' };
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
});
