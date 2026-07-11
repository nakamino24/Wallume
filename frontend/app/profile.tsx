import React from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, CURRENCIES } from '@/src/theme/tokens';
import { Screen, Card, H1, H2, Body, Label, Button, Chip } from '@/src/components/ui';

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  const doLogout = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity testID="profile-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md }}>Profile</H2>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 60 }}>
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <Body style={{ color: colors.onBrand, fontFamily: font.displayBold, fontSize: 28 }}>{(user?.name || 'M')[0].toUpperCase()}</Body>
            </View>
            <H1 style={{ marginTop: spacing.md }}>{user?.name}</H1>
            <Body muted>{user?.email}</Body>
            <Body muted style={{ fontSize: 12, marginTop: 4 }}>via {user?.provider}</Body>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Label>Appearance</Label>
                <Body style={{ marginTop: 4, fontFamily: font.textBold }}>{mode === 'dark' ? 'Dark mode' : 'Light mode'}</Body>
              </View>
              <Switch testID="profile-dark-toggle" value={mode === 'dark'} onValueChange={toggle} trackColor={{ true: colors.brandPrimary }} />
            </View>
          </Card>

          <Card>
            <Label>Currency</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {CURRENCIES.map((c) => (
                <Chip
                  key={c.code}
                  testID={`profile-cur-${c.code}`}
                  label={`${c.symbol} ${c.code}`}
                  active={user?.currency === c.code}
                  onPress={() => updateProfile({ currency: c.code })}
                />
              ))}
            </ScrollView>
          </Card>

          <Card onPress={() => router.push('/reports')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>Reports</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>Charts, trends and category breakdown</Body>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>

          <Card onPress={() => router.push('/transactions')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>All transactions</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>Full history with filters</Body>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>

          <Button testID="profile-signout" label="Sign out" variant="danger" onPress={doLogout} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
