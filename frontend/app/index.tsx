import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useOnboarding } from '@/src/hooks/use-onboarding';
import { font, radius, spacing } from '@/src/theme/tokens';

export default function Index() {
  const { user, loading } = useAuth();
  const { done: onboardingDone, checking: onboardingChecking } = useOnboarding();
  const { colors, mode } = useTheme();

  if (loading || onboardingChecking) {
    return (
      <LinearGradient
        colors={[colors.brandPrimary, mode === 'dark' ? '#0f172a' : '#f8fafc']}
        style={styles.gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.shell}>
            <View style={[styles.heroCard, { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)', borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)' }]}>
              <View style={[styles.logoWrap, { backgroundColor: mode === 'dark' ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.25)' }]}>
                <Text style={styles.logoText}>W</Text>
              </View>

              <Text style={[styles.title, { color: mode === 'dark' ? colors.onSurface : '#111827', fontFamily: font.displayBold }]}>Wallume</Text>
              <Text style={[styles.subtitle, { color: mode === 'dark' ? colors.onSurface3 : '#4b5563', fontFamily: font.text }]}>Organize your money with clarity.</Text>

              <View style={[styles.loaderWrap, { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(16,185,129,0.15)' }]}>
                <ActivityIndicator size="large" color={mode === 'dark' ? colors.onSurface : colors.brandPrimary} />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!onboardingDone) return <Redirect href="/(auth)/onboarding" />;
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
    paddingVertical: spacing.xxxl,
  },
  heroCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    borderWidth: 1,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logoText: {
    fontSize: 40,
    fontFamily: font.displayBold,
    color: '#10B981',
    letterSpacing: -2,
  },
  title: {
    fontSize: 32,
    letterSpacing: 0.3,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loaderWrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
});
