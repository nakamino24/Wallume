import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface2: '#FFFFFF', onSurface: '#111111', onBrand: '#FFFFFF', brandPrimary: '#287565',
      success: '#247A57', error: '#B64A4A', brandSoft: '#E2F0EA', onBrandSoft: '#164B43',
      border: '#E0E6DF', muted: '#70807A',
    },
  }),
}));

const mockGetLocale = jest.fn(() => 'en');
jest.mock('@/src/lib/i18n', () => ({ getLocale: () => mockGetLocale() }));
jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({
  useBalancePrivacy: () => ({ isBalanceVisible: true, isPrivacyReady: true }),
}));

const { groupTransactionsByDate, transactionDayLabel, TransactionDayGroup } = require('@/src/components/transactions/TransactionDayGroup');

const tx = (id: string, date: string, over: any = {}) => ({ id, date, type: 'expense', category: 'Food', amount: 1000, ...over });

describe('groupTransactionsByDate', () => {
  it('groups by transaction.date preserving input order and does not mutate input', () => {
    const input = [tx('a', '2026-08-25'), tx('b', '2026-08-25'), tx('c', '2026-08-24'), tx('d', '2026-08-24')];
    const snapshot = JSON.parse(JSON.stringify(input));
    const groups = groupTransactionsByDate(input);
    expect(groups.map((g: any) => g.key)).toEqual(['2026-08-25', '2026-08-24']);
    expect(groups[0].transactions.map((t: any) => t.id)).toEqual(['a', 'b']);
    expect(groups[1].transactions.map((t: any) => t.id)).toEqual(['c', 'd']);
    expect(input).toEqual(snapshot);
  });

  it('keeps chronological order of the source list', () => {
    const input = [tx('x', '2026-08-20'), tx('y', '2026-08-22'), tx('z', '2026-08-21')];
    const groups = groupTransactionsByDate(input);
    expect(groups.map((g: any) => g.key)).toEqual(['2026-08-20', '2026-08-22', '2026-08-21']);
  });
});

describe('transactionDayLabel', () => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  it('renders Today / Yesterday / weekday in English', () => {
    expect(transactionDayLabel(today, 'en')).toBe('Today');
    expect(transactionDayLabel(yesterday, 'en')).toBe('Yesterday');
    expect(transactionDayLabel(new Date(2026, 0, 5), 'en')).toBe('Monday');
  });

  it('renders Hari ini / Kemarin in Indonesian', () => {
    mockGetLocale.mockReturnValue('id');
    expect(transactionDayLabel(today, 'id')).toBe('Hari ini');
    expect(transactionDayLabel(yesterday, 'id')).toBe('Kemarin');
    mockGetLocale.mockReturnValue('en');
  });
});

describe('TransactionDayGroup', () => {
  const group = {
    key: '2026-08-25',
    date: new Date('2026-08-25T00:00:00'),
    transactions: [tx('a', '2026-08-25', { category: 'Food', note: 'Lunch', wallet_name: 'BCA' })],
  };

  it('places a date header above the rows and does not repeat the full date inside rows', () => {
    const { getByTestId, getByText, queryByText } = render(
      <TransactionDayGroup group={group} currency="IDR" onOpen={jest.fn()} onRemove={jest.fn()} />,
    );
    expect(getByTestId('transaction-day-2026-08-25')).toBeTruthy();
    expect(getByText('Food')).toBeTruthy();
    expect(getByText('Lunch')).toBeTruthy();
    expect(queryByText('2026-08-25')).toBeNull();
  });

  it('opens the transaction when the row is pressed', () => {
    const onOpen = jest.fn();
    const { getByText } = render(
      <TransactionDayGroup group={group} currency="IDR" onOpen={onOpen} onRemove={jest.fn()} />,
    );
    fireEvent.press(getByText('Food'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });
});
