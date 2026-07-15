import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthProvider';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing } from '@/src/theme/tokens';

const splashImage = require('../assets/images/splash-image.png');

export default function Index() {
  const { user, loading } = useAuth();
  const { colors, mode } = useTheme();

  if (loading) {
    return (
      <LinearGradient
        colors={[colors.brandPrimary, mode === 'dark' ? '#0f172a' : '#f8fafc']}
        style={styles.gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.shell}>
            <View style={styles.heroCard}>
              <View style={[styles.iconWrap, { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)' }] }>
                <Image source={splashImage} style={styles.icon} resizeMode="contain" />
              </View>

              <Text style={[styles.title, { color: mode === 'dark' ? colors.onSurface : '#111827' }]}>Wallume</Text>
              <Text style={[styles.subtitle, { color: mode === 'dark' ? colors.onSurface2 : '#4b5563' }]}>Organize your money with clarity.</Text>

              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={mode === 'dark' ? colors.onSurface : colors.brandPrimary} />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return <Redirect href={user ? '/(tabs)/home' : '/(auth)/login'} />;
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
