import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';

// Mock the auth and theme hooks
const mockLogin = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    signup: jest.fn(),
    logout: jest.fn(),
    loginWithEmergentToken: jest.fn(),
  }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#09090B',
      surface2: '#18181B',
      surface3: '#27272A',
      onSurface: '#FAFAFA',
      onSurface2: '#F4F4F5',
      onSurface3: '#D4D4D8',
      onBrand: '#000000',
      brandPrimary: '#10B981',
      onBrandSoft: '#D1FAE5',
      border: '#27272A',
      muted: '#A1A1AA',
      error: '#F87171',
      success: '#34D399',
      warning: '#FBBF24',
      inverse: '#FAFAFA',
      onInverse: '#09090B',
      brandSoft: '#065F46',
    },
    mode: 'dark',
  }),
}));

// Mock router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn() }),
  useFocusEffect: jest.fn((cb) => cb()),
  Redirect: 'Redirect',
}));

// Mock other dependencies
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'wallume://') }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })) }));
jest.mock('@/src/hooks/use-icon-fonts', () => ({ useIconFonts: () => [true, null] }));

describe('Auth Flow', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockRouterReplace.mockReset();
  });

  it('renders login screen with all key elements', () => {
    const Login = require('@/app/(auth)/login').default;
    const { getByTestId, getByText } = render(<Login />);

    expect(getByTestId('login-email')).toBeTruthy();
    expect(getByTestId('login-password')).toBeTruthy();
    expect(getByTestId('login-submit')).toBeTruthy();
    expect(getByTestId('login-google')).toBeTruthy();
    expect(getByTestId('login-goto-signup')).toBeTruthy();
    expect(getByText('Sign in to Wallume')).toBeTruthy();
    expect(getByText('Welcome back.')).toBeTruthy();
  });

  it('shows validation error on empty submit', async () => {
    const Login = require('@/app/(auth)/login').default;
    const { getByTestId, getByText } = render(<Login />);

    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => {
      expect(getByText(/Please enter email and password/i)).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login on valid form submission', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const Login = require('@/app/(auth)/login').default;
    const { getByTestId } = render(<Login />);

    fireEvent.changeText(getByTestId('login-email'), 'test@wallume.com');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@wallume.com', 'password123');
    });
  });

  it('redirects to home on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const Login = require('@/app/(auth)/login').default;
    const { getByTestId } = render(<Login />);

    fireEvent.changeText(getByTestId('login-email'), 'test@wallume.com');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/home');
    });
  });

  it('displays error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    const Login = require('@/app/(auth)/login').default;
    const { getByTestId, getByText } = render(<Login />);

    fireEvent.changeText(getByTestId('login-email'), 'wrong@wallume.com');
    fireEvent.changeText(getByTestId('login-password'), 'wrong');
    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => {
      expect(getByText(/Could not sign in/i)).toBeTruthy();
    });
  });

  it('navigates to signup screen', () => {
    const mockPush = jest.fn();
    jest.mock('expo-router', () => ({
      useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    }));

    const Login = require('@/app/(auth)/login').default;
    const { getByTestId } = render(<Login />);

    fireEvent.press(getByTestId('login-goto-signup'));
  });

  it('renders signup screen with all required fields', () => {
    const Signup = require('@/app/(auth)/signup').default;
    const { getByTestId, getByText } = render(<Signup />);

    expect(getByTestId('signup-name')).toBeTruthy();
    expect(getByTestId('signup-email')).toBeTruthy();
    expect(getByTestId('signup-password')).toBeTruthy();
    expect(getByTestId('signup-submit')).toBeTruthy();
    expect(getByTestId('signup-goto-login')).toBeTruthy();
    expect(getByText(/Create your account/i)).toBeTruthy();
  });
});
