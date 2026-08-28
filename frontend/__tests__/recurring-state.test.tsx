import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRecurring = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]),
}));

jest.mock('@/src/api/client', () => ({
  api: {
    recurring: mockRecurring,
    markRecurringPaid: jest.fn(),
  },
}));

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { currency: 'IDR' } }),
}));

jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({
  useBalancePrivacy: () => ({ isBalanceVisible: true, isPrivacyReady: true }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff', surface2: '#fff', surface3: '#eee', onSurface: '#111', onSurface2: '#222',
      onSurface3: '#333', muted: '#666', border: '#ddd', brandPrimary: '#287565', onBrand: '#fff',
      inverse: '#164B43', onInverse: '#fff', error: '#b00', warning: '#a60', success: '#070',
    },
  }),
}));

describe('Recurring data states', () => {
  beforeEach(() => mockRecurring.mockReset());

  it('renders data after a successful request', async () => {
    mockRecurring.mockResolvedValue({ recurring: [{ id: 'r1', name: 'Netflix', amount: 120000, active: true, type: 'expense', frequency: 'monthly', category: 'Bills', days_until: 2 }] });
    const Recurring = require('@/app/recurring').default;
    const { getByText, queryByTestId } = render(<Recurring />);
    await waitFor(() => expect(getByText('Netflix')).toBeTruthy());
    expect(queryByTestId('recurring-empty')).toBeNull();
    expect(queryByTestId('recurring-error')).toBeNull();
  });

  it('renders a genuine empty state only after successful empty data', async () => {
    mockRecurring.mockResolvedValue({ recurring: [] });
    const Recurring = require('@/app/recurring').default;
    const { getByTestId, queryByTestId } = render(<Recurring />);
    await waitFor(() => expect(getByTestId('recurring-empty')).toBeTruthy());
    expect(queryByTestId('recurring-error')).toBeNull();
  });

  it('renders error rather than empty and retries the request', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRecurring.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ recurring: [] });
    const Recurring = require('@/app/recurring').default;
    const { getByTestId, queryByTestId } = render(<Recurring />);
    await waitFor(() => expect(getByTestId('recurring-error')).toBeTruthy());
    expect(queryByTestId('recurring-empty')).toBeNull();

    fireEvent.press(getByTestId('recurring-retry'));
    await waitFor(() => expect(getByTestId('recurring-empty')).toBeTruthy());
    expect(mockRecurring).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
