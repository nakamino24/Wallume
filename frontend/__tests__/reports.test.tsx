import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Circle as SvgCircle } from 'react-native-svg';

const mockGetSummary = jest.fn();
const mockTransactions = jest.fn();

const lightColors = {
  surface: '#F6F7F3', surface2: '#FFFFFF', onSurface: '#1C2926', onBrand: '#FFFFFF',
  brandPrimary: '#287565', error: '#B64A4A', success: '#247A57', inverse: '#164B43',
  onInverse: '#FFFFFF', muted: '#70807A', border: '#E0E6DF', surface3: '#ECF0EA',
};
const darkColors = {
  surface: '#11131A', surface2: '#191D28', onSurface: '#F2F3F8', onBrand: '#10221F',
  brandPrimary: '#70C8B1', error: '#F19B9D', success: '#83D2AA', inverse: '#20283A',
  onInverse: '#F7F8FC', muted: '#A7AEC0', border: '#303647', surface3: '#242938',
};
const mockUseTheme = jest.fn(() => ({ colors: lightColors, mode: 'light' }));

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { currency: 'IDR' } }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('@/src/api/client', () => ({
  api: {
    reports: { getSummary: mockGetSummary },
    transactions: mockTransactions,
  },
}));

jest.mock('@/src/components/DateField', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    DateField: ({ label, value, onChange, testID }: any) => React.createElement(
      TouchableOpacity,
      { testID, onPress: () => onChange(label === 'From' ? '2026-07-01' : '2026-08-26') },
      React.createElement(Text, { testID: `${testID}-value` }, `${label}:${value}`),
    ),
  };
});

jest.mock('@/src/components/ReportPeriodPicker', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    ReportPeriodPicker: ({ fromDate, toDate, onChange }: any) => React.createElement(
      TouchableOpacity,
      { testID: 'report-period-picker', onPress: () => onChange({ from: '2026-07-01', to: toDate }) },
      React.createElement(Text, { testID: 'report-period-value' }, `${fromDate}:${toDate}`),
    ),
  };
});

const summary = {
  from_date: '2026-08-01',
  to_date: '2026-08-24',
  transaction_count: 3,
  income_total: 300000,
  expense_total: 100000,
  net_total: 200000,
  expense_by_category: [
    { category: 'Food', amount: 75000 },
    { category: 'Travel', amount: 25000 },
  ],
};

describe('Reports screen', () => {
  beforeEach(() => {
    mockGetSummary.mockReset();
    mockTransactions.mockReset();
    mockGetSummary.mockResolvedValue(summary);
  });

  it('loads and renders the server summary without a raw transaction request', async () => {
    const Reports = require('@/app/reports').default;
    const { getByText, UNSAFE_getAllByType } = render(<Reports />);

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1));
    expect(mockGetSummary).toHaveBeenCalledWith(expect.objectContaining({ from_date: expect.any(String), to_date: expect.any(String) }));
    expect(mockTransactions).not.toHaveBeenCalled();
    expect(getByText('Rp200.000')).toBeTruthy();
    expect(getByText('Rp300,0K')).toBeTruthy();
    expect(getByText('Rp100,0K')).toBeTruthy();
    expect(getByText('Food')).toBeTruthy();
    expect(getByText('Travel')).toBeTruthy();
    expect(getByText('Rp75,0K')).toBeTruthy();
    expect(getByText('Rp25,0K')).toBeTruthy();
    const circles = UNSAFE_getAllByType(SvgCircle);
    const circumference = 2 * Math.PI * 70;
    expect(Number(circles[1].props.strokeDasharray.split(' ')[0]) / circumference).toBeCloseTo(0.75);
    expect(Number(circles[2].props.strokeDasharray.split(' ')[0]) / circumference).toBeCloseTo(0.25);
  });

  it('refetches the summary when the selected range changes', async () => {
    const Reports = require('@/app/reports').default;
    const { getByTestId } = render(<Reports />);

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1));
    fireEvent.press(getByTestId('report-period-picker'));
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(2));
    expect(mockGetSummary.mock.calls[1][0]).toEqual(expect.objectContaining({ from_date: '2026-07-01' }));
  });

  it('preserves an exact earlier From boundary when refetching', async () => {
    const Reports = require('@/app/reports').default;
    const { getByTestId } = render(<Reports />);

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1));
    fireEvent.press(getByTestId('report-period-picker'));

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledWith(expect.objectContaining({ from_date: '2026-07-01' })));
    expect(getByTestId('report-period-value').props.children).toMatch(/^2026-07-01:/);
  });

  it('keeps the loading state separate from an API failure', async () => {
    let rejectSummary!: (error: Error) => void;
    mockGetSummary.mockReturnValue(new Promise((_, reject) => { rejectSummary = reject; }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const Reports = require('@/app/reports').default;
    const { getByText, queryByText } = render(<Reports />);

    expect(getByText('Updating report...')).toBeTruthy();
    rejectSummary(new Error('offline'));
    await waitFor(() => expect(getByText('Unable to load this period. Try again.')).toBeTruthy());
    expect(queryByText('No transactions in this period.')).toBeNull();
    expect(queryByText('Rp0')).toBeNull();
    errorSpy.mockRestore();
  });

  it('renders the successful empty state separately from an API failure', async () => {
    mockGetSummary.mockResolvedValue({ ...summary, transaction_count: 0, income_total: 0, expense_total: 0, net_total: 0, expense_by_category: [] });
    const Reports = require('@/app/reports').default;
    const { getByText, queryByText } = render(<Reports />);

    await waitFor(() => expect(getByText('No transactions in this period.')).toBeTruthy());
    expect(queryByText('Unable to load this period. Try again.')).toBeNull();
  });
});

describe('Reports transaction count (RC1-RC10)', () => {
  const renderCount = async (count: number) => {
    mockGetSummary.mockResolvedValue({ ...summary, transaction_count: count });
    const Reports = require('@/app/reports').default;
    const utils = render(<Reports />);
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalled());
    return utils;
  };

  it('RC1 Last 7 days response count 4 renders 4', async () => {
    const { getByText } = await renderCount(4);
    expect(getByText('4')).toBeTruthy();
  });

  it('RC2 Last 30 days response count 15 renders 15', async () => {
    const { getByText } = await renderCount(15);
    expect(getByText('15')).toBeTruthy();
  });

  it('RC3 Last 90 days response count 62 renders 62', async () => {
    const { getByText } = await renderCount(62);
    expect(getByText('62')).toBeTruthy();
  });

  it('RC4 Custom range response count 23 renders 23', async () => {
    const { getByText } = await renderCount(23);
    expect(getByText('23')).toBeTruthy();
  });

  it('RC5 changing range replaces the previous count', async () => {
    mockGetSummary
      .mockResolvedValueOnce({ ...summary, transaction_count: 4 })
      .mockResolvedValueOnce({ ...summary, transaction_count: 15 });
    const Reports = require('@/app/reports').default;
    const { getByTestId, getByText, queryByText } = render(<Reports />);

    await waitFor(() => expect(getByText('4')).toBeTruthy());
    fireEvent.press(getByTestId('report-period-picker'));
    await waitFor(() => expect(getByText('15')).toBeTruthy());
    expect(queryByText('4')).toBeNull();
  });

  it('RC6 count 0 shows the empty period state', async () => {
    mockGetSummary.mockResolvedValue({ ...summary, transaction_count: 0, income_total: 0, expense_total: 0, net_total: 0, expense_by_category: [] });
    const Reports = require('@/app/reports').default;
    const { getByText } = render(<Reports />);
    await waitFor(() => expect(getByText('No transactions in this period.')).toBeTruthy());
  });

  it('RC7 transaction count value uses an explicit semantic text color', async () => {
    const { getByText } = await renderCount(7);
    const node = getByText('7');
    const style = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(style.color).toBe(lightColors.onInverse);
  });

  it('RC8 light theme count is visible with high-contrast color', async () => {
    mockUseTheme.mockReturnValue({ colors: lightColors, mode: 'light' });
    const { getByText } = await renderCount(9);
    const node = getByText('9');
    const style = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(style.color).not.toBe(lightColors.inverse);
  });

  it('RC9 dark theme count is visible with high-contrast onInverse color', async () => {
    mockUseTheme.mockReturnValue({ colors: darkColors, mode: 'dark' });
    const { getByText } = await renderCount(11);
    const node = getByText('11');
    const style = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(style.color).toBe(darkColors.onInverse);
  });

  it('RC10 API error does not display a false successful count', async () => {
    mockGetSummary.mockRejectedValue(new Error('offline'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const Reports = require('@/app/reports').default;
    const { getByText, queryByText } = render(<Reports />);
    await waitFor(() => expect(getByText('Unable to load this period. Try again.')).toBeTruthy());
    expect(queryByText('4')).toBeNull();
    expect(queryByText('0')).toBeNull();
    errorSpy.mockRestore();
  });
});
