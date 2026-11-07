import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, spacing, radius } from '@/src/theme/tokens';
import { useI18n } from '@/src/lib/I18nProvider';
import { useTheme } from '@/src/theme/ThemeProvider';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  // The palette is theme-driven: the previous hardcoded dark colours left the
  // crash screen unreadable for users on the light theme.
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="warning" size={40} color={colors.brandPrimary} />
      </View>
      <Text style={[styles.title, { color: colors.onSurface }]}>{t('error.boundary.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        {t('error.boundary.subtitle')}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.brandPrimary }]}
        onPress={onRetry}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('error.boundary.retry')}
      >
        <Text style={[styles.buttonText, { color: colors.onBrand }]}>{t('error.boundary.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: font.displayBold, fontSize: 22,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: font.text, fontSize: 14,
    textAlign: 'center', lineHeight: 20,
    marginBottom: spacing.xl, maxWidth: 280,
  },
  button: {
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  buttonText: {
    fontFamily: font.textBold, fontSize: 15,
  },
});
