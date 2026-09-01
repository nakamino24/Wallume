import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { api } from '@/src/api/client';
import {
  getPasswordRecoveryRequest,
  storePasswordResetToken,
} from '@/src/auth/password-recovery-state';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { Body, Button, Input, Screen } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { font, spacing } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';

const RESEND_SECONDS = 60;

export default function VerifyResetCode() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const recovery = getPasswordRecoveryRequest();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (!recovery.requestId) {
      router.replace('/(auth)/forgot-password');
      return;
    }
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [recovery.requestId, router, seconds]);

  const submit = async () => {
    if (!/^\d{6}$/.test(code) || !recovery.requestId) {
      setError(t('auth.reset.validation.code'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.verifyPasswordReset({
        request_id: recovery.requestId,
        code,
      });
      storePasswordResetToken(result.reset_token);
      router.push('/(auth)/reset-password');
    } catch {
      setError(t('auth.reset.error.code'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!recovery.requestId || seconds > 0) return;
    setResendLoading(true);
    setError('');
    try {
      await api.resendPasswordReset({ request_id: recovery.requestId });
      setSeconds(RESEND_SECONDS);
    } catch {
      setError(t('auth.reset.error.request'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ marginBottom: spacing.xxl }}>
            <Body style={{ fontFamily: font.displayBold, fontSize: scale(24), color: colors.onSurface, fontWeight: '600' }}>
              {t('auth.verify.title')}
            </Body>
            <Body muted style={{ marginTop: spacing.sm }}>{t('auth.verify.description')}</Body>
          </View>
          <Input
            testID="reset-code"
            label={t('auth.verify.code')}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {!!error && <Body testID="reset-code-error" style={{ color: colors.error, marginBottom: spacing.md }}>{error}</Body>}
          <Button testID="reset-code-submit" label={t('auth.verify.action')} onPress={submit} loading={loading} />
          <Button
            testID="reset-code-resend"
            variant="ghost"
            label={seconds > 0 ? t('auth.verify.resendIn', { seconds }) : t('auth.verify.resend')}
            onPress={resend}
            loading={resendLoading}
            disabled={seconds > 0}
            style={{ marginTop: spacing.md }}
          />
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
