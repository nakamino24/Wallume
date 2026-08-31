import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockUseAuth = jest.fn();
const mockUseOnboarding = jest.fn();
const mockT = jest.fn((k: string) => k);

jest.mock('@/src/auth/AuthProvider', () => ({ useAuth: (...a: any[]) => mockUseAuth(...a) }));
jest.mock('@/src/hooks/use-onboarding', () => ({ useOnboarding: (...a: any[]) => mockUseOnboarding(...a) }));
jest.mock('@/src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { surface: '#fff', brandPrimary: '#000', onSurface: '#000', muted: '#666' } }) }));
jest.mock('@/src/lib/I18nProvider', () => ({ useI18n: () => ({ t: mockT }) }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Redirect: ({ href }: any) => React.createElement(View, { testID: 'redirect', accessibilityLabel: String(href) }) };
});

import Index from '@/app/index';

describe('Root routing with AuthStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockT.mockImplementation((k: string) => k);
    mockUseOnboarding.mockReturnValue({ done: true, checking: false });
  });

  it('temporarily-unavailable does NOT redirect to login', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, status: 'temporarily-unavailable', refresh: jest.fn() });
    const { queryByTestId, getByText } = render(<Index />);
    expect(queryByTestId('redirect')).toBeNull();
    expect(getByText('auth.session.unavailable.title')).toBeTruthy();
    expect(getByText('auth.session.retry')).toBeTruthy();
  });

  it('unauthenticated redirects to login', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, status: 'unauthenticated', refresh: jest.fn() });
    const { getByTestId } = render(<Index />);
    expect(getByTestId('redirect').props.accessibilityLabel).toContain('/(auth)/login');
  });

  it('authenticated goes to home', () => {
    mockUseAuth.mockReturnValue({ user: { email: 'a@b.com' }, loading: false, status: 'authenticated', refresh: jest.fn() });
    const { getByTestId } = render(<Index />);
    expect(getByTestId('redirect').props.accessibilityLabel).toContain('/(tabs)/home');
  });

  it('initializing shows loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, status: 'initializing', refresh: jest.fn() });
    const { queryByTestId } = render(<Index />);
    expect(queryByTestId('redirect')).toBeNull();
  });
});
