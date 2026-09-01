import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { api } from '@/src/api/client';
import { beginPasswordRecovery } from '@/src/auth/password-recovery-state';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { Body, Button, Input, Screen } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { font, spacing } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';

export default function ForgotPassword() {
  const router = useRouter();
  const { colors } = useTheme();
  const { locale, t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setError(t('auth.reset.validation.email'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.requestPasswordReset({ email: normalized, locale });
      beginPasswordRecovery(normalized, result.request_id);
      router.push('/(auth)/verify-reset-code');
    } catch {
      setError(t('auth.reset.error.request'));
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
              {t('auth.forgot.title')}
            </Body>
            <Body muted style={{ marginTop: spacing.sm }}>{t('auth.forgot.description')}</Body>
          </View>
          <Input
            testID="forgot-password-email"
            label={t('email')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email.placeholder')}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {!!error && <Body testID="forgot-password-error" style={{ color: colors.error, marginBottom: spacing.md }}>{error}</Body>}
          <Button testID="forgot-password-submit" label={t('auth.forgot.send')} onPress={submit} loading={loading} />
          <TouchableOpacity
            testID="forgot-password-back"
            accessibilityRole="button"
            onPress={() => router.replace('/(auth)/login')}
            style={{ alignSelf: 'center', marginTop: spacing.xl }}
          >
            <Body style={{ color: colors.brandPrimary }}>{t('auth.reset.backToLogin')}</Body>
          </TouchableOpacity>
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
