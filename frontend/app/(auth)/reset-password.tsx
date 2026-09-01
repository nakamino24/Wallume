import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { api } from '@/src/api/client';
import {
  completePasswordRecovery,
  getPasswordResetToken,
} from '@/src/auth/password-recovery-state';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { Body, Button, Input, Screen } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { font, spacing } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';

export default function ResetPassword() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const resetToken = getPasswordResetToken();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resetToken) router.replace('/(auth)/forgot-password');
  }, [resetToken, router]);

  const submit = async () => {
    if (password.length < 8) { setError(t('auth.validation.passwordLength')); return; }
    if (!/[A-Z]/.test(password)) { setError(t('auth.validation.passwordUppercase')); return; }
    if (!/[0-9]/.test(password)) { setError(t('auth.validation.passwordNumber')); return; }
    if (password !== confirmation) { setError(t('auth.reset.validation.mismatch')); return; }
    if (!resetToken) { setError(t('auth.reset.error.confirm')); return; }

    setLoading(true);
    setError('');
    try {
      await api.confirmPasswordReset({
        reset_token: resetToken,
        new_password: password,
        confirm_password: confirmation,
      });
      completePasswordRecovery();
      router.replace('/(auth)/login');
    } catch {
      setError(t('auth.reset.error.confirm'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ marginBottom: spacing.xxl }}>
            <Body style={{ fontFamily: font.displayBold, fontSize: scale(24), color: colors.onSurface, fontWeight: '600' }}>
              {t('auth.reset.title')}
            </Body>
            <Body muted style={{ marginTop: spacing.sm }}>{t('auth.reset.description')}</Body>
          </View>
          <Input
            testID="reset-password-new"
            label={t('auth.reset.newPassword')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoComplete="new-password"
          />
          <Input
            testID="reset-password-confirm"
            label={t('auth.reset.confirmPassword')}
            secureTextEntry
            value={confirmation}
            onChangeText={setConfirmation}
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {!!error && <Body testID="reset-password-error" style={{ color: colors.error, marginBottom: spacing.md }}>{error}</Body>}
          <Button testID="reset-password-submit" label={t('auth.reset.action')} onPress={submit} loading={loading} />
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
