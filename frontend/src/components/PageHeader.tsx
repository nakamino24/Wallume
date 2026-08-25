import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { H1, Body } from '@/src/components/ui';
import { spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/ThemeProvider';

export function PageHeader({ title, subtitle, onBack, action }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md }}>
      {onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <H1>{title}</H1>
        {subtitle && <Body muted style={{ marginTop: 2, fontSize: 13 }}>{subtitle}</Body>}
      </View>
      {action}
    </View>
  );
}
