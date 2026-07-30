import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { Body } from '@/src/components/ui';

export function ErrorBanner({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      backgroundColor: colors.error + '12',
      borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.error + '30',
      padding: spacing.md, marginBottom: spacing.md,
    }}>
      <Ionicons name="alert-circle" size={18} color={colors.error} />
      <Body style={{ flex: 1, fontSize: 13, color: colors.error }}>
        {message || 'Something went wrong'}
      </Body>
      {onRetry && (
        <TouchableOpacity testID="error-retry-btn" onPress={onRetry} activeOpacity={0.7}
          style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.error }}>
          <Body style={{ fontSize: 12, color: colors.error, fontFamily: font.textMedium }}>Retry</Body>
        </TouchableOpacity>
      )}
    </View>
  );
}