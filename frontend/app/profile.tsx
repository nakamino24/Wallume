import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { isBiometricLockEnabled, setBiometricLockEnabled, isBiometricAvailable } from '@/src/auth/AppLockGate';
import { useOnboarding } from '@/src/hooks/use-onboarding';
import { usePayday } from '@/src/hooks/use-payday';
import { api } from '@/src/api/client';
import { t, setLocale } from '@/src/lib/i18n';
import { getNotifSettings, setNotifSettings, requestNotificationPermission, type NotifSettings } from '@/src/utils/notifications';
import { spacing, radius, font, CURRENCIES } from '@/src/theme/tokens';
import { Screen, Card, H1, H2, Body, Label, Button, Chip } from '@/src/components/ui';

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const { user, logout, updateProfile } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { info: payday } = usePayday(user?.payday_day);
  const router = useRouter();
  const [notif, setNotifState] = useState<NotifSettings>({ billingReminder: true, budgetAlert: true, paydayReminder: true });
  const [lang, setLangState] = useState<'en' | 'id'>('en');
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(true);

  useEffect(() => {
    (async () => {
      setBioAvailable(await isBiometricAvailable());
      setBioEnabled(await isBiometricLockEnabled());
      setNotifState(await getNotifSettings());
      const { initLocale } = await import('@/src/lib/i18n');
      setLangState(await initLocale());
    })();
  }, []);

  const onToggleBiometric = async (value: boolean) => {
    if (value) {
      const available = await isBiometricAvailable();
      if (!available) {
        Alert.alert('Not available', 'Set up Face ID, fingerprint, or a screen lock on your device first.');
        return;
      }
    }
    await setBiometricLockEnabled(value);
    setBioEnabled(value);
  };

  const doLogout = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  const doDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'All your wallets, transactions, budgets, and goals will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: async () => {
          try {
            await api.deleteAccount();
            await logout();
            router.replace('/(auth)/login');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not delete account');
          }
        }},
      ],
    );
  };

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <TouchableOpacity testID="profile-back" onPress={onBack}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Label>Security</Label>
                <Body style={{ marginTop: 4, fontFamily: font.textBold }}>Face ID / Fingerprint lock</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>
                  {bioAvailable ? 'Require biometrics to open Wallume' : 'Not available on this device'}
                </Body>
              </View>
              <Switch testID="profile-biometric-toggle" value={bioEnabled} onValueChange={onToggleBiometric}
                disabled={!bioAvailable} trackColor={{ true: colors.brandPrimary }} />
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

          <Card>
            <Label>Payday</Label>
            <Body muted style={{ fontSize: 12, marginTop: 2 }}>
              {payday ? `Next: ${payday.nextDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Set your payday date'}
            </Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {[5, 10, 15, 20, 25, 28, 31].map((d) => (
                <Chip
                  key={d}
                  testID={`profile-payday-${d}`}
                  label={`Every ${d}th`}
                  active={user?.payday_day === d}
                  onPress={() => updateProfile({ payday_day: d })}
                />
              ))}
            </View>
          </Card>

          {/* Language */}
          <Card>
            <Label>{t('language')}</Label>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              {(['en', 'id'] as const).map((l) => (
                <Chip key={l} testID={`profile-lang-${l}`} label={l === 'en' ? 'English' : 'Indonesia'}
                  active={lang === l} onPress={async () => { setLangState(l); await setLocale(l); }} />
              ))}
            </View>
          </Card>

          {/* Notifications */}
          <Card>
            <Label>{t('notifications')}</Label>
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <NotifRow label={t('notif.billing')} value={notif.billingReminder} onChange={async (v) => { const n = { ...notif, billingReminder: v }; setNotifState(n); await setNotifSettings(n); }} colors={colors} />
              <NotifRow label={t('notif.budget')} value={notif.budgetAlert} onChange={async (v) => { const n = { ...notif, budgetAlert: v }; setNotifState(n); await setNotifSettings(n); }} colors={colors} />
              <NotifRow label={t('notif.payday')} value={notif.paydayReminder} onChange={async (v) => { const n = { ...notif, paydayReminder: v }; setNotifState(n); await setNotifSettings(n); }} colors={colors} />
            </View>
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

          <Card onPress={() => { resetOnboarding(); router.push('/(auth)/onboarding' as any); }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>Onboarding tour</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>Replay the intro walkthrough</Body>
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

          <Card onPress={() => router.push('/privacy' as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>Privacy Policy</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>How your data is handled</Body>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>

          <Button testID="profile-signout" label="Sign out" variant="danger" onPress={doLogout} style={{ marginTop: spacing.md }} />

          <TouchableOpacity testID="profile-delete-account" onPress={doDeleteAccount}
            style={{ alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm }}>
            <Body muted style={{ fontSize: 12 }}>Delete account & all data</Body>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function NotifRow({ label, value, onChange, colors }: { label: string; value: boolean; onChange: (v: boolean) => void; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Body style={{ fontSize: 13 }}>{label}</Body>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brandPrimary }} />
    </View>
  );
}
