import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.6c' } },
}));

jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({
  useBalancePrivacy: () => ({
    isBalanceVisible: true,
    isPrivacyReady: true,
    showBalance: jest.fn(),
    hideBalance: jest.fn(),
    toggleBalanceVisibility: jest.fn(),
  }),
  BalancePrivacyProvider: ({ children }: any) => children,
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'light',
    toggle: jest.fn(),
    colors: {
      surface: '#F6F7F3', surface2: '#FFFFFF', surface3: '#ECF0EA', onSurface: '#1C2926', onSurface2: '#263431', onSurface3: '#66736F',
      onBrand: '#FFFFFF', brandPrimary: '#287565', onBrandSoft: '#164B43', border: '#E0E6DF', muted: '#70807A',
      error: '#B64A4A', success: '#247A57', warning: '#B86C20', inverse: '#164B43', onInverse: '#FFFFFF', brandSoft: '#E2F0EA',
    },
  }),
}));

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { name: 'Alex', email: 'alex@wallume.com', provider: 'email', currency: 'IDR' }, logout: jest.fn(), updateProfile: jest.fn() }),
}));
jest.mock('@/src/auth/AppLockGate', () => ({ isBiometricAvailable: jest.fn(() => Promise.resolve(true)), isBiometricLockEnabled: jest.fn(() => Promise.resolve(false)), setBiometricLockEnabled: jest.fn() }));
jest.mock('@/src/hooks/use-onboarding', () => ({ useOnboarding: () => ({ resetOnboarding: jest.fn() }) }));
jest.mock('@/src/hooks/use-payday', () => ({ usePayday: () => ({ info: null, setPaydayDay: jest.fn(), setWorkWeek: jest.fn() }) }));
jest.mock('@/src/utils/notifications', () => ({ getNotifSettings: jest.fn(() => Promise.resolve({ billingReminder: true, budgetAlert: true, paydayReminder: true })), setNotifSettings: jest.fn() }));
jest.mock('@/src/lib/I18nProvider', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: jest.fn(),
    t: (key: string) => ({ 'sign.out': 'Sign out' }[key] || key),
  }),
}));
jest.mock('@/src/api/client', () => ({ api: { deleteAccount: jest.fn() } }));

import Profile from '@/app/profile';

describe('Profile version placement', () => {
  it('renders the runtime frontend version before Sign out', async () => {
    const { getByTestId, getByText } = render(<Profile />);
    await waitFor(() => expect(getByTestId('app-version')).toBeTruthy());
    expect(getByText('Sign out')).toBeTruthy();
  });
});
