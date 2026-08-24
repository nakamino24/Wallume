import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Circle as SvgCircle } from 'react-native-svg';

const mockGetSummary = jest.fn();
const mockTransactions = jest.fn();

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { currency: 'IDR' } }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#09090B', surface2: '#18181B', onSurface: '#FAFAFA', onBrand: '#000000',
      brandPrimary: '#10B981', error: '#F87171', success: '#34D399', inverse: '#FAFAFA',
      onInverse: '#09090B', muted: '#A1A1AA', border: '#27272A', surface3: '#27272A',
    },
  }),
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
    DateField: ({ label, onChange, testID }: any) => React.createElement(
      TouchableOpacity,
      { testID, onPress: () => onChange(label === 'From' ? '2026-08-02' : '2026-08-26') },
      React.createElement(Text, null, label),
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
    expect(getByText('Rp300.000')).toBeTruthy();
    expect(getByText('Rp100.000')).toBeTruthy();
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
    fireEvent.press(getByTestId('report-to'));
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(2));
    expect(mockGetSummary.mock.calls[1][0]).toEqual(expect.objectContaining({ to_date: '2026-08-26' }));
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
