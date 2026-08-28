import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

let mockBalanceVisible = true;
const mockWallets = [
  { id: 'w1', name: 'Jago', type: 'bank', balance: 3137754, currency: 'IDR', home_currency: 'IDR' },
];
const mockTransactions = [
  { id: 't1', type: 'income', category: 'Transfer in', amount: 500000, date: '2026-08-27', wallet_name: 'Jago' },
];

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#11131A', surface2: '#191D28', surface3: '#242938', inverse: '#20283A',
      onSurface: '#F2F3F8', onSurface2: '#F2F3F8', onInverse: '#F7F8FC', onBrandSoft: '#D8F4EE',
      brandPrimary: '#70C8B1', brandSoft: '#163D38', border: '#303647', muted: '#A7AEC0',
      success: '#83D2AA', error: '#F19B9D',
    },
    mode: 'dark',
  }),
}));
jest.mock('@/src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { currency: 'IDR' } }) }));
jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({ useBalancePrivacy: () => ({ isBalanceVisible: mockBalanceVisible, isPrivacyReady: true }) }));
jest.mock('@/src/hooks/use-wallets', () => ({ useWallets: () => ({ wallets: mockWallets, loading: false, error: '', refresh: jest.fn() }) }));
jest.mock('@/src/api/client', () => ({ api: { wallets: jest.fn(() => Promise.resolve({ wallets: mockWallets })), transactions: jest.fn(() => Promise.resolve({ transactions: mockTransactions })), deleteTransaction: jest.fn() } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]), useLocalSearchParams: () => ({ id: 'w1' }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));

describe('Wallet balance privacy and contrast', () => {
  beforeEach(() => { mockBalanceVisible = true; });

  it('renders wallet list balance with explicit readable dark-theme foreground when visible', () => {
    const Wallets = require('@/app/(tabs)/wallets').default;
    const { getByTestId } = render(<Wallets />);
    const amount = getByTestId('wallet-balance-w1');
    const style = Array.isArray(amount.props.style) ? Object.assign({}, ...amount.props.style) : amount.props.style;
    expect(style.color).toBe('#F2F3F8');
  });

  it('masks wallet list balance when app balance privacy is hidden', () => {
    mockBalanceVisible = false;
    const Wallets = require('@/app/(tabs)/wallets').default;
    const { getByTestId, queryByText } = render(<Wallets />);
    expect(getByTestId('wallet-balance-w1').props.children).toBe('Rp•••••••');
    expect(queryByText('Rp3.137.754')).toBeNull();
  });

  it('masks wallet detail balance but keeps activity amount visible', async () => {
    mockBalanceVisible = false;
    const WalletDetail = require('@/app/wallet/[id]').default;
    const { getAllByText, getByText } = render(<WalletDetail />);
    await waitFor(() => expect(getByText('Transfer in')).toBeTruthy());
    expect(getAllByText('Rp•••••••').length).toBeGreaterThan(0);
    expect(getByText('Rp500.000')).toBeTruthy();
  });
});
