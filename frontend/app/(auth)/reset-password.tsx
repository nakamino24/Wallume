import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { api } from '@/src/api/client';
import {
  completePasswordRecovery,
  getPasswordResetToken,
} from '@/src/auth/password-recovery-state';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { Body, Button, Input, Screen } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { font, radius, spacing } from '@/src/theme/tokens';
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
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!resetToken && feedback !== 'success') router.replace('/(auth)/forgot-password');
  }, [feedback, resetToken, router]);

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
      setFeedback('success');
    } catch {
      setFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const closeFeedback = () => {
    if (feedback === 'success') {
      router.replace('/(auth)/login');
      return;
    }
    setFeedback(null);
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
      <Modal
        visible={feedback !== null}
        transparent
        animationType="fade"
        onRequestClose={closeFeedback}
      >
        <View
          testID="reset-password-feedback-modal"
          accessibilityViewIsModal
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.48)',
            justifyContent: 'center',
            padding: spacing.xl,
          }}
        >
          <View style={{
            backgroundColor: colors.surface2,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            alignItems: 'center',
          }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
              backgroundColor: feedback === 'success' ? colors.brandSoft : colors.surface3,
            }}>
              <Ionicons
                testID={feedback === 'success' ? 'reset-password-success-icon' : 'reset-password-error-icon'}
                name={feedback === 'success' ? 'checkmark-circle' : 'close-circle'}
                size={42}
                color={feedback === 'success' ? colors.success : colors.error}
              />
            </View>
            <Body
              testID="reset-password-feedback-title"
              style={{
                color: colors.onSurface,
                fontFamily: font.displayBold,
                fontSize: scale(20),
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {t(feedback === 'success' ? 'auth.reset.feedback.successTitle' : 'auth.reset.feedback.errorTitle')}
            </Body>
            <Body muted style={{ marginTop: spacing.sm, marginBottom: spacing.xl, textAlign: 'center' }}>
              {t(feedback === 'success' ? 'auth.reset.feedback.successMessage' : 'auth.reset.feedback.errorMessage')}
            </Body>
            <Button
              testID="reset-password-feedback-action"
              label={t(feedback === 'success' ? 'auth.reset.feedback.login' : 'auth.reset.feedback.retry')}
              onPress={closeFeedback}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
