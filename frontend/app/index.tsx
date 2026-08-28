import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useOnboarding } from '@/src/hooks/use-onboarding';
import { font, radius, spacing } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { WallumeMark } from '@/src/components/WallumeMark';
import { useI18n } from '@/src/lib/I18nProvider';

export default function Index() {
  const { user, loading } = useAuth();
  const { done: onboardingDone, checking: onboardingChecking } = useOnboarding();
  const { colors } = useTheme();
  const { t } = useI18n();

  if (loading || onboardingChecking) {
    return (
      <View style={[styles.gradient, { backgroundColor: colors.surface }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.shell}>
            <View style={[styles.logoWrap, { backgroundColor: colors.brandPrimary }]}>
              <WallumeMark size={36} />
            </View>
            <Text style={[styles.title, { color: colors.onSurface, fontFamily: font.displayBold }]}>Wallume</Text>
            <Text style={[styles.subtitle, { color: colors.muted, fontFamily: font.text }]}>{t('app.tagline')}</Text>
            <ActivityIndicator size="small" color={colors.brandPrimary} style={{ marginTop: spacing.xxl }} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!user) return <Redirect href={'/(auth)/login' as any} />;
  if (!onboardingDone) return <Redirect href={'/(auth)/onboarding' as any} />;
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  shell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: scale(24),
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: font.sizes.base,
    textAlign: 'center',
  },
});
