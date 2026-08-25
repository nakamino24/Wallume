import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockRefresh = jest.fn();
const mockRouterPush = jest.fn();
const mockUser = { name: 'Alex', currency: 'USD', email: 'alex@wallume.com' };
const mockUseTransactions = jest.fn();
const mockUseWallets = jest.fn();

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#09090B', surface2: '#18181B', surface3: '#27272A',
      onSurface: '#FAFAFA', onSurface2: '#F4F4F5', onSurface3: '#D4D4D8',
      onBrand: '#000000', brandPrimary: '#10B981',
      onBrandSoft: '#D1FAE5', border: '#27272A', muted: '#A1A1AA',
      error: '#F87171', success: '#34D399', warning: '#FBBF24',
      inverse: '#FAFAFA', onInverse: '#09090B', brandSoft: '#065F46',
    },
    mode: 'dark',
  }),
}));

jest.mock('@/src/api/client', () => ({
  api: {
    summary: jest.fn(() => Promise.resolve({
      net_worth: 25000, month_income: 5000, month_expense: 3200,
      cash_flow: 1800, health_score: 72, saving_rate: 36, debt_ratio: 15,
      category_breakdown: [{ category: 'Food', amount: 600 }],
      trend: [{ month: 'Jan', income: 4800, expense: 3100 }],
      spending_alerts: [],
      counts: { wallets: 2, debts: 0, investments: 0, assets: 0 },
    })),
    transactions: jest.fn(() => Promise.resolve({ transactions: [] })),
    wallets: jest.fn(() => Promise.resolve({
      wallets: [
        { id: 'wal1', name: 'Cash', balance: 250, currency: 'USD' },
        { id: 'wal2', name: 'Main Bank', balance: 3200, currency: 'USD' },
      ],
    })),
  },
  getToken: jest.fn(() => Promise.resolve('mock-token')),
  BASE_URL: 'http://localhost:8001',
}));

jest.mock('@/src/utils/storage', () => ({
  storage: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve(true)),
    secureGet: jest.fn(() => Promise.resolve(null)),
    secureSet: jest.fn(() => Promise.resolve(true)),
    secureRemove: jest.fn(() => Promise.resolve(true)),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn() }),
  // Expo invokes focus callbacks from an effect. Calling the callback during
  // render turns Home's state update into an artificial render loop.
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('@/src/widgets/refresh-widget', () => ({ refreshNetWorthWidget: jest.fn() }));
jest.mock('@/src/hooks/use-transactions', () => ({ useTransactions: mockUseTransactions }));
jest.mock('@/src/hooks/use-wallets', () => ({ useWallets: mockUseWallets }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: any) => {
    const React = require('react');
    return React.createElement('View', { style }, children);
  },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('Home Screen', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockUseTransactions.mockReturnValue({ transactions: [], loading: false, error: '', refresh: mockRefresh });
    mockUseWallets.mockReturnValue({
      wallets: [
        { id: 'wal1', name: 'Cash', balance: 250, currency: 'USD' },
        { id: 'wal2', name: 'Main Bank', balance: 3200, currency: 'USD' },
      ],
      loading: false, error: '', refresh: mockRefresh,
    });
  });

  it('renders welcome message with user name', async () => {
    const Home = require('@/app/(tabs)/home').default;
    const { getByText } = render(<Home />);

    await waitFor(() => {
      expect(getByText(/Welcome back/i)).toBeTruthy();
    });
  });

  it('renders quick action buttons', async () => {
    const Home = require('@/app/(tabs)/home').default;
    const { getByTestId } = render(<Home />);

    await waitFor(() => {
      expect(getByTestId('home-add-income')).toBeTruthy();
      expect(getByTestId('home-add-expense')).toBeTruthy();
      expect(getByTestId('home-add-transfer')).toBeTruthy();
      expect(getByTestId('home-reports')).toBeTruthy();
    });
  });

  it('renders filter chips', async () => {
    const Home = require('@/app/(tabs)/home').default;
    const { getByTestId } = render(<Home />);

    await waitFor(() => {
      expect(getByTestId('home-filter-all')).toBeTruthy();
      expect(getByTestId('home-filter-income')).toBeTruthy();
      expect(getByTestId('home-filter-expense')).toBeTruthy();
      expect(getByTestId('home-filter-transfer')).toBeTruthy();
    });
  });

  it('renders health score section', async () => {
    const Home = require('@/app/(tabs)/home').default;
    const { getByText } = render(<Home />);

    await waitFor(() => {
      expect(getByText(/Financial Health Score/i)).toBeTruthy();
    });
  });

  it('renders compact supporting Net Worth metrics', async () => {
    mockUser.currency = 'IDR';
    const Home = require('@/app/(tabs)/home').default;
    const { getByText, getByTestId } = render(<Home />);

    await waitFor(() => {
      expect(getByText('Income (mo)')).toBeTruthy();
      expect(getByText('Expense (mo)')).toBeTruthy();
      expect(getByText('Cash flow')).toBeTruthy();
      expect(getByText('+Rp5,0K')).toBeTruthy();
      expect(getByText('-Rp3,2K')).toBeTruthy();
      expect(getByText('Rp1,8K')).toBeTruthy();
      expect(getByTestId('net-worth-income').props.numberOfLines).toBe(1);
      expect(getByTestId('net-worth-expense').props.numberOfLines).toBe(1);
      expect(getByTestId('net-worth-cash-flow').props.numberOfLines).toBe(1);
    });
    mockUser.currency = 'USD';
  });

  it('navigates to transaction new on FAB press', async () => {
    const Home = require('@/app/(tabs)/home').default;
    const { getByTestId } = render(<Home />);

    await waitFor(() => {
      fireEvent.press(getByTestId('home-fab'));
      expect(mockRouterPush).toHaveBeenCalledWith('/transaction/new');
    });
  });

  it('navigates to profile on profile button press', async () => {
    const Home = require('@/app/(tabs)/home').default;
    const { getByTestId } = render(<Home />);

    await waitFor(() => {
      fireEvent.press(getByTestId('home-profile-btn'));
      expect(mockRouterPush).toHaveBeenCalledWith('/profile');
    });
  });

  it('renders smart insights section', async () => {
    const Home = require('@/app/(tabs)/home').default;
    const { getByText } = render(<Home />);

    await waitFor(() => {
      expect(getByText('Smart insights')).toBeTruthy();
    });
  });

  it('shows empty state when no transactions exist', async () => {
    mockUseWallets.mockReturnValue({ wallets: [], loading: false, error: '', refresh: mockRefresh });
    const Home = require('@/app/(tabs)/home').default;
    const { getByTestId } = render(<Home />);
    await waitFor(() => expect(getByTestId('home-tx-empty')).toBeTruthy());
  });

  it('displays Total Balance from wallet_total, not mislabeled Net Worth', async () => {
    mockUser.currency = 'IDR';
    const api = require('@/src/api/client').api;
    api.summary.mockResolvedValueOnce({
      wallet_total: 42000, net_worth: 999999, month_income: 0, month_expense: 0, cash_flow: 0,
      health_score: 0, saving_rate: 0, debt_ratio: 0,
      category_breakdown: [], trend: [], spending_alerts: [], counts: {},
    });
    const Home = require('@/app/(tabs)/home').default;
    const { getByText, queryByText } = render(<Home />);
    await waitFor(() => expect(getByText('Rp42.000')).toBeTruthy());
    // Net Worth must not be used as hero; wallet_total is authoritative for Total Balance
    expect(queryByText('Rp999.999')).toBeNull();
    expect(queryByText('Net worth')).toBeNull();
    mockUser.currency = 'USD';
  });

  it('supports negative Net Worth via authoritative summary (not wallet total)', async () => {
    mockUser.currency = 'IDR';
    const api = require('@/src/api/client').api;
    // Even if wallet_total is positive, net_worth can be negative when debts > assets
    api.summary.mockResolvedValueOnce({
      wallet_total: 5000, net_worth: -7500, month_income: 0, month_expense: 0, cash_flow: 0,
      health_score: 0, saving_rate: 0, debt_ratio: 0,
      category_breakdown: [], trend: [], spending_alerts: [], counts: {},
    });
    const Home = require('@/app/(tabs)/home').default;
    const { getByText } = render(<Home />);
    // Home hero is Total Balance, so it shows wallet_total 5000, not negative net_worth
    await waitFor(() => expect(getByText('Rp5.000')).toBeTruthy());
    mockUser.currency = 'USD';
  });
});
