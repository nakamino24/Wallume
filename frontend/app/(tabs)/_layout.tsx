import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { font } from '@/src/theme/tokens';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && !user) router.replace('/(auth)/login');
  }, [user, loading, router]);

  if (loading || !user) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  // Minimum clearance between the tab bar's icon+label content and the bottom
  // of the screen (system navigation bar area), ON TOP of the reported inset.
  // 3-button navigation reports a bigger insets.bottom than gesture nav, so the
  // total padding scales with the device while this constant guarantees a
  // comfortable gap for both. The earlier +6 Android clearance was too tight.
  const BOTTOM_CLEARANCE = Platform.OS === 'ios' ? 18 : 20;

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: font.textMedium, fontSize: 11 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          backgroundColor: colors.surface2,
          borderTopColor: colors.border,
          // 'relative' keeps the bar in normal flow so screens and floating
          // buttons (e.g. the Home "+") never scroll under / overlap it.
          position: 'relative',
          // Height must grow by the same clearance as the bottom padding so the
          // icon+label area keeps its size while everything lifts above the
          // system nav bar instead of being squeezed against it.
          height: (Platform.OS === 'ios' ? 60 : 56) + insets.bottom + BOTTOM_CLEARANCE,
          paddingBottom: insets.bottom + BOTTOM_CLEARANCE,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          title: 'Wallets',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
