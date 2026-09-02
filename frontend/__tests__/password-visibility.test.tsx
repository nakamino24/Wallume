import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { Input } from '@/src/components/ui';
import { storePasswordResetToken } from '@/src/auth/password-recovery-state';

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ login: jest.fn(), signup: jest.fn(), loginWithEmergentToken: jest.fn() }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFFFFF', surface2: '#FFFFFF', surface3: '#F1F5F9',
      onSurface: '#111827', onSurface2: '#1F2937', onSurface3: '#4B5563',
      brand: '#10B981', brandPrimary: '#10B981', brandSoft: '#D1FAE5',
      onBrand: '#FFFFFF', border: '#D1D5DB', muted: '#6B7280',
      error: '#DC2626', success: '#059669',
    },
  }),
}));

function PasswordHarness() {
  const [value, setValue] = useState('SecretPassword1');
  return (
    <Input
      testID="password-field"
      label="Password"
      secureTextEntry
      value={value}
      onChangeText={setValue}
    />
  );
}

describe('password visibility', () => {
  it('starts hidden, toggles visibility, preserves the value, and exposes a 44dp accessible control', () => {
    const screen = render(<PasswordHarness />);
    const input = () => screen.getByTestId('password-field');
    const toggle = screen.getByTestId('password-field-visibility-toggle');

    expect(input().props.secureTextEntry).toBe(true);
    expect(input().props.value).toBe('SecretPassword1');
    expect(toggle.props.accessibilityRole).toBe('button');
    expect(toggle.props.accessibilityLabel).toBe('Show password');
    expect(toggle).toHaveStyle({ width: 44, minHeight: 44 });

    fireEvent.press(toggle);
    expect(input().props.secureTextEntry).toBe(false);
    expect(input().props.value).toBe('SecretPassword1');
    expect(screen.getByTestId('password-field-visibility-toggle').props.accessibilityLabel).toBe('Hide password');

    fireEvent.press(screen.getByTestId('password-field-visibility-toggle'));
    expect(input().props.secureTextEntry).toBe(true);
    expect(input().props.value).toBe('SecretPassword1');
  });

  it('does not render a visibility control for non-password inputs', () => {
    const screen = render(<Input testID="email-field" label="Email" value="user@example.com" />);
    expect(screen.queryByTestId('email-field-visibility-toggle')).toBeNull();
  });

  it('adds the shared visibility control to login, signup, and both reset password fields', () => {
    const Login = require('@/app/(auth)/login').default;
    const login = render(<Login />);
    expect(login.getByTestId('login-password-visibility-toggle')).toBeTruthy();
    login.unmount();

    const Signup = require('@/app/(auth)/signup').default;
    const signup = render(<Signup />);
    expect(signup.getByTestId('signup-password-visibility-toggle')).toBeTruthy();
    signup.unmount();

    storePasswordResetToken('opaque-token');
    const ResetPassword = require('@/app/(auth)/reset-password').default;
    const reset = render(<ResetPassword />);
    expect(reset.getByTestId('reset-password-new-visibility-toggle')).toBeTruthy();
    expect(reset.getByTestId('reset-password-confirm-visibility-toggle')).toBeTruthy();
  });

  it('contains both English and Indonesian accessibility labels', () => {
    const { EN_EXPORT, ID_EXPORT } = require('@/src/lib/i18n');
    expect(EN_EXPORT['auth.password.show']).toBe('Show password');
    expect(EN_EXPORT['auth.password.hide']).toBe('Hide password');
    expect(ID_EXPORT['auth.password.show']).toBe('Tampilkan kata sandi');
    expect(ID_EXPORT['auth.password.hide']).toBe('Sembunyikan kata sandi');
  });
});
