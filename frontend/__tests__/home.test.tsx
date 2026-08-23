import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockRefresh = jest.fn();
const mockRouterPush = jest.fn();
const mockUser = { name: 'Alex', currency: 'USD', email: 'alex@wallume.com' };

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
  useFocusEffect: jest.fn((cb) => cb()),
}));

jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('@/src/widgets/refresh-widget', () => ({ refreshNetWorthWidget: jest.fn() }));
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
    // Empty state requires BOTH no transactions and no wallets; the shared
    // mock above returns two wallets, so override it for this scenario.
    // (persistent override, not Once: useFocusEffect triggers a second load
    // that would otherwise fall back to the two-wallet default)
    const { api } = require('@/src/api/client');
    const originalWalletsImpl = (api.wallets as jest.Mock).getMockImplementation();
    (api.wallets as jest.Mock).mockResolvedValue({ wallets: [] });
    try {
      const Home = require('@/app/(tabs)/home').default;
      const { getByTestId } = render(<Home />);

      await waitFor(() => {
        expect(getByTestId('home-tx-empty')).toBeTruthy();
      });
    } finally {
      // Restore, or later tests in this file would inherit the empty wallet
      // list if execution order ever changes.
      (api.wallets as jest.Mock).mockImplementation(originalWalletsImpl ?? undefined);
    }
  });
});