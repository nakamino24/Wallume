import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, spacing, radius } from '@/src/theme/tokens';
import { useI18n } from '@/src/lib/I18nProvider';

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
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="warning" size={40} color="#10B981" />
      </View>
      <Text style={styles.title}>{t('error.boundary.title')}</Text>
      <Text style={styles.subtitle}>
        {t('error.boundary.subtitle')}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.buttonText}>{t('error.boundary.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#09090B',
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
    fontFamily: font.displayBold, fontSize: 22, color: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: font.text, fontSize: 14, color: '#A1A1AA',
    textAlign: 'center', lineHeight: 20,
    marginBottom: spacing.xl, maxWidth: 280,
  },
  button: {
    backgroundColor: '#10B981',
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  buttonText: {
    fontFamily: font.textBold, fontSize: 15, color: '#000000',
  },
});
