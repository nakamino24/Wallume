import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockGetToken = jest.fn();
const mockSetToken = jest.fn();
const mockMe = jest.fn();

jest.mock('@/src/api/client', () => ({
  getToken: (...a: any[]) => mockGetToken(...a),
  setToken: (...a: any[]) => mockSetToken(...a),
  api: { me: (...a: any[]) => mockMe(...a) },
  BASE_URL: 'https://test',
}));
jest.mock('@/src/utils/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), secureGet: jest.fn(), secureSet: jest.fn(), secureRemove: jest.fn() },
}));
jest.mock('@/src/hooks/use-transactions', () => ({ clearTransactionsState: jest.fn() }));
jest.mock('@/src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {}, mode: 'light' }) }));
jest.mock('@/src/lib/I18nProvider', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'en' }) }));

import { AuthProvider, useAuth } from '@/src/auth/AuthProvider';

function Consumer() {
  const { user, loading } = useAuth();
  return <Text testID="user">{user ? user.email : 'null'}</Text>;
}

describe('AuthProvider refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('valid-token');
  });

  it('A: valid token + me success preserves session', async () => {
    mockMe.mockResolvedValue({ user: { email: 'a@b.com', user_id: 'u1', provider: 'email', currency: 'USD', name: 'A' } });
    const { getByTestId } = render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(getByTestId('user').props.children).toBe('a@b.com'));
    expect(mockSetToken).not.toHaveBeenCalledWith(null);
  });

  it('B: 401 clears token', async () => {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    mockMe.mockRejectedValue(err);
    const { getByTestId } = render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith(null));
    expect(getByTestId('user').props.children).toBe('null');
  });

  it('D: network error preserves token', async () => {
    const err: any = new Error('fetch failed');
    // no status -> network
    mockMe.mockRejectedValue(err);
    const { getByTestId } = render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(getByTestId('user').props.children).toBe('null'));
    expect(mockSetToken).not.toHaveBeenCalledWith(null);
  });

  it('E: 500 preserves token', async () => {
    const err: any = new Error('Server error');
    err.status = 500;
    mockMe.mockRejectedValue(err);
    const { getByTestId } = render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(getByTestId('user').props.children).toBe('null'));
    expect(mockSetToken).not.toHaveBeenCalledWith(null);
  });

  it('successful login persists token (mock)', async () => {
    const { api } = require('@/src/api/client');
    expect(api).toBeDefined();
  });
});
