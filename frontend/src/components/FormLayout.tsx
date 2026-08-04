import React, { type ReactNode } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { Screen, H2 } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';

/**
 * Shared safe-area + keyboard + scroll-aware layout for every form screen.
 * Centralizes: SafeAreaView, KeyboardAvoidingView, ScrollView, header/back,
 * and scroll-to-focused-input. Screens using this have no local keyboard or
 * scroll handling of their own.
 */
export function FormLayout({
  children, title, onBack, footer, headerRight, editable = true,
}: {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
  footer?: ReactNode;
  headerRight?: ReactNode;
  editable?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {title && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            {onBack && (
              <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            )}
            <H2 style={{ marginLeft: spacing.md, flex: 1 }}>{title}</H2>
            {headerRight}
          </View>
        )}
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, paddingBottom: footer ? spacing.xxxl : spacing.xxl }}>
          {children}
        </KeyboardAwareContainer>
        {footer}
      </SafeAreaView>
    </Screen>
  );
}