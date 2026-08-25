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

  // On edge-to-edge Android, insets.bottom is the system nav bar overlay
  // (gesture pill ~24dp, 3-button ~48dp). Some OEMs (Samsung One UI) can report 0
  // here while still drawing an opaque/contrast nav bar over the app, which
  // leaves the tab bar sitting under it. Use the OS value when present, else
  // fall back to the standard Android nav-bar height so the bar is never covered
  // on any device/nav mode. iOS uses the real inset / home-indicator value.
  const navBarBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 48) : insets.bottom;
  const clearGap = Platform.OS === 'ios' ? 18 : 6;

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
        tabBarLabelStyle: { fontFamily: font.textMedium, fontSize: 11, marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 5 },
        tabBarStyle: {
          backgroundColor: colors.surface2,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          // 'relative' keeps the bar in normal flow so screens and floating
          // buttons (e.g. the Home "+") never scroll under / overlap it.
          position: 'relative',
          height: (Platform.OS === 'ios' ? 60 : 56) + navBarBottom + clearGap,
          paddingBottom: navBarBottom + clearGap,
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
