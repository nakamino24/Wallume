import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/src/theme/ThemeProvider';

export function AppBackground({ children }: { children: React.ReactNode }) {
  const { colors, mode } = useTheme();
  if (mode !== 'dark') return <View style={{ flex: 1, backgroundColor: colors.surface }}>{children}</View>;
  return (
    <LinearGradient colors={['#11131A', '#171B29', '#211C31']} locations={[0, 0.6, 1]} style={{ flex: 1 }}>
      {children}
    </LinearGradient>
  );
}
