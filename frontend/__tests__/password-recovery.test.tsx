import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  beginPasswordRecovery,
  clearPasswordRecovery,
  getPasswordResetToken,
  storePasswordResetToken,
} from '@/src/auth/password-recovery-state';
import { EN_EXPORT, ID_EXPORT } from '@/src/lib/i18n';


const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRequest = jest.fn();
const mockResend = jest.fn();
const mockVerify = jest.fn();
const mockConfirm = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

jest.mock('@/src/api/client', () => ({
  api: {
    requestPasswordReset: (...args: unknown[]) => mockRequest(...args),
    resendPasswordReset: (...args: unknown[]) => mockResend(...args),
    verifyPasswordReset: (...args: unknown[]) => mockVerify(...args),
    confirmPasswordReset: (...args: unknown[]) => mockConfirm(...args),
  },
}));

jest.mock('@/src/lib/I18nProvider', () => {
  const i18n = jest.requireActual('@/src/lib/i18n');
  return { useI18n: () => ({ locale: 'en', t: i18n.t }) };
});

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#09090B', surface2: '#18181B', surface3: '#27272A',
      onSurface: '#FAFAFA', onSurface2: '#F4F4F5', onSurface3: '#D4D4D8',
      brand: '#10B981', brandPrimary: '#10B981', onBrand: '#000000',
      border: '#27272A', muted: '#A1A1AA', error: '#F87171', success: '#34D399',
    },
  }),
}));

describe('password recovery', () => {
  beforeEach(() => {
    clearPasswordRecovery();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockRequest.mockReset();
    mockResend.mockReset();
    mockVerify.mockReset();
    mockConfirm.mockReset();
  });

  it('validates email, requests a generic challenge, and moves to verification', async () => {
    const ForgotPassword = require('@/app/(auth)/forgot-password').default;
    const screen = render(<ForgotPassword />);

    fireEvent.press(screen.getByTestId('forgot-password-submit'));
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled();

    mockRequest.mockResolvedValueOnce({ request_id: 'request_1', message: 'generic' });
    fireEvent.changeText(screen.getByTestId('forgot-password-email'), ' USER@EXAMPLE.COM ');
    fireEvent.press(screen.getByTestId('forgot-password-submit'));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith({ email: 'user@example.com', locale: 'en' });
      expect(mockPush).toHaveBeenCalledWith('/(auth)/verify-reset-code');
    });
  });

  it.each([
    ['rate limit', { status: 429, detail: 'raw rate-limit detail' }, 'Too many requests. Please wait a few minutes and try again.'],
    ['server failure', { status: 500, detail: 'raw server detail' }, 'Wallume is temporarily unavailable. Please try again.'],
    ['network failure', new TypeError('Network request failed with private transport detail'), 'Could not reach Wallume. Check your connection and try again.'],
    ['missing route', { status: 404, detail: 'raw route detail' }, 'Password recovery is temporarily unavailable.'],
  ])('classifies a %s without exposing backend detail', async (_case, rejection, expected) => {
    const ForgotPassword = require('@/app/(auth)/forgot-password').default;
    mockRequest.mockRejectedValueOnce(rejection);
    const screen = render(<ForgotPassword />);

    fireEvent.changeText(screen.getByTestId('forgot-password-email'), 'user@example.com');
    fireEvent.press(screen.getByTestId('forgot-password-submit'));

    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
    expect(screen.queryByText(/raw|private transport detail/i)).toBeNull();
  });

  it('requires six digits and shows a safe error for an invalid code', async () => {
    beginPasswordRecovery('user@example.com', 'request_1');
    const VerifyResetCode = require('@/app/(auth)/verify-reset-code').default;
    const screen = render(<VerifyResetCode />);

    fireEvent.changeText(screen.getByTestId('reset-code'), '12abc');
    fireEvent.press(screen.getByTestId('reset-code-submit'));
    expect(screen.getByText('Enter the 6-digit verification code')).toBeTruthy();

    mockVerify.mockRejectedValueOnce(new Error('backend detail must not be exposed'));
    fireEvent.changeText(screen.getByTestId('reset-code'), '123456');
    fireEvent.press(screen.getByTestId('reset-code-submit'));
    await waitFor(() => {
      expect(screen.getByText(/invalid or expired/i)).toBeTruthy();
      expect(screen.queryByText(/backend detail/i)).toBeNull();
    });
  });

  it('keeps the reset token in memory and navigates without route parameters', async () => {
    beginPasswordRecovery('user@example.com', 'request_1');
    mockVerify.mockResolvedValueOnce({ reset_token: 'opaque_token', expires_in: 600 });
    const VerifyResetCode = require('@/app/(auth)/verify-reset-code').default;
    const screen = render(<VerifyResetCode />);

    fireEvent.changeText(screen.getByTestId('reset-code'), '123456');
    fireEvent.press(screen.getByTestId('reset-code-submit'));

    await waitFor(() => {
      expect(getPasswordResetToken()).toBe('opaque_token');
      expect(mockPush).toHaveBeenCalledWith('/(auth)/reset-password');
    });
    expect(JSON.stringify(mockPush.mock.calls)).not.toContain('opaque_token');
  });

  it('blocks mismatched passwords and shows success feedback before returning to login', async () => {
    storePasswordResetToken('opaque_token');
    const ResetPassword = require('@/app/(auth)/reset-password').default;
    const screen = render(<ResetPassword />);

    fireEvent.changeText(screen.getByTestId('reset-password-new'), 'NewPassword456');
    fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'Different456');
    fireEvent.press(screen.getByTestId('reset-password-submit'));
    expect(screen.getByText('Password confirmation does not match')).toBeTruthy();
    expect(mockConfirm).not.toHaveBeenCalled();

    mockConfirm.mockResolvedValueOnce({ message: 'ok' });
    fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'NewPassword456');
    fireEvent.press(screen.getByTestId('reset-password-submit'));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith({
        reset_token: 'opaque_token',
        new_password: 'NewPassword456',
        confirm_password: 'NewPassword456',
      });
      expect(screen.getByText('Password updated')).toBeTruthy();
      expect(screen.getByTestId('reset-password-success-icon')).toBeTruthy();
    });
    expect(getPasswordResetToken()).toBeNull();
    expect(mockReplace).not.toHaveBeenCalledWith('/(auth)/login');

    fireEvent.press(screen.getByTestId('reset-password-feedback-action'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('shows failure feedback and preserves both passwords for retry', async () => {
    storePasswordResetToken('opaque_token');
    mockConfirm.mockRejectedValueOnce(new Error('private backend failure'));
    const ResetPassword = require('@/app/(auth)/reset-password').default;
    const screen = render(<ResetPassword />);

    fireEvent.changeText(screen.getByTestId('reset-password-new'), 'NewPassword456');
    fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'NewPassword456');
    fireEvent.press(screen.getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(screen.getByText('Password update failed')).toBeTruthy();
      expect(screen.getByTestId('reset-password-error-icon')).toBeTruthy();
    });
    expect(screen.queryByText(/private backend failure/i)).toBeNull();
    expect(screen.getByTestId('reset-password-new').props.value).toBe('NewPassword456');
    expect(screen.getByTestId('reset-password-confirm').props.value).toBe('NewPassword456');
    expect(getPasswordResetToken()).toBe('opaque_token');

    fireEvent.press(screen.getByTestId('reset-password-feedback-action'));
    expect(screen.queryByText('Password update failed')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalledWith('/(auth)/login');
  });

  it('has complete English and Indonesian recovery copy', () => {
    const keys = Object.keys(EN_EXPORT).filter((key) =>
      key.startsWith('auth.forgot.') || key.startsWith('auth.verify.') || key.startsWith('auth.reset.'),
    );
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) expect(ID_EXPORT[key]).toBeTruthy();
    expect(EN_EXPORT['auth.forgot.link']).toBe('Forgot password?');
    expect(ID_EXPORT['auth.forgot.link']).toBe('Lupa kata sandi?');
    expect(ID_EXPORT['auth.reset.success']).toContain('Kata sandi diperbarui');
  });

  it('does not persist or expose recovery credentials', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'auth', 'password-recovery-state.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/AsyncStorage|SecureStore|storage\.|setItem|secureSet/);
    expect(source).not.toMatch(/router|searchParams|useLocalSearchParams/);
  });
});
