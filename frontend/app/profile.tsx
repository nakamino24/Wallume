import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useBalancePrivacy } from '@/src/privacy/BalancePrivacyProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { isBiometricLockEnabled, setBiometricLockEnabled, isBiometricAvailable } from '@/src/auth/AppLockGate';
import { useOnboarding } from '@/src/hooks/use-onboarding';
import { usePayday } from '@/src/hooks/use-payday';
import { api } from '@/src/api/client';
import { useI18n } from '@/src/lib/I18nProvider';
import { getNotifSettings, setNotifSettings, type NotifSettings } from '@/src/utils/notifications';
import { spacing, radius, font, CURRENCIES } from '@/src/theme/tokens';
import { Screen, Card, H1, H2, Body, Label, Button, Chip } from '@/src/components/ui';
import { AppVersion } from '@/src/components/AppVersion';
import { WallumeMark } from '@/src/components/WallumeMark';
import { refreshNetWorthWidget } from '@/src/widgets/refresh-widget';

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const { isBalanceVisible, toggleBalanceVisibility } = useBalancePrivacy();
  const { user, logout, updateProfile } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { info: payday, setPaydayDay, setWorkWeek } = usePayday(user?.payday_day, user?.work_week);
  const router = useRouter();
  const { locale: lang, setLocale, t } = useI18n();
  const [notif, setNotifState] = useState<NotifSettings>({ billingReminder: true, budgetAlert: true, paydayReminder: true });
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    (async () => {
      setBioAvailable(await isBiometricAvailable());
      setBioEnabled(await isBiometricLockEnabled());
      setNotifState(await getNotifSettings());
    })();
  }, []);

  const onToggleBiometric = async (value: boolean) => {
    if (value) {
      const available = await isBiometricAvailable();
      if (!available) {
        Alert.alert(t('profile.biometricUnavailableTitle'), t('profile.biometricUnavailableMessage'));
        return;
      }
    }
    await setBiometricLockEnabled(value);
    setBioEnabled(value);
  };

  const doLogout = () => {
    Alert.alert(t('sign.out.question'), t('sign.out.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sign.out'), style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  const doDeleteAccount = () => {
    Alert.alert(
      t('delete.confirm'),
      t('delete.warning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('delete.everything'), style: 'destructive', onPress: async () => {
          try {
            await api.deleteAccount();
            await logout();
            router.replace('/(auth)/login');
          } catch (e: any) {
            Alert.alert(t('profile.errorTitle'), t('profile.deleteError'));
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
          <TouchableOpacity testID="profile-back" accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={onBack}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
          <H2 style={{ marginLeft: spacing.md }}>{t('profile')}</H2>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 60 }}>
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.brandSoft, borderColor: 'transparent', borderRadius: radius.lg }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <WallumeMark size={38} color={colors.onBrand} />
            </View>
            <H1 style={{ marginTop: spacing.md }}>{user?.name}</H1>
            <Body muted>{user?.email}</Body>
            <Body muted style={{ fontSize: 12, marginTop: 4 }}>{t('profile.provider', { provider: user?.provider || '' })}</Body>
          </Card>

          <Label style={{ marginTop: spacing.sm }}>{t('profile.preferences').toUpperCase()}</Label>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Label>{t('appearance')}</Label>
                <Body style={{ marginTop: 4, fontFamily: font.textBold }}>{mode === 'dark' ? t('dark.mode') : t('light.mode')}</Body>
              </View>
              <Switch testID="profile-dark-toggle" value={mode === 'dark'} onValueChange={toggle} trackColor={{ true: colors.brandPrimary }} />
            </View>
          </Card>

          <Label style={{ marginTop: spacing.sm }}>{t('profile.account').toUpperCase()}</Label>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Label>{t('security')}</Label>
                <Body style={{ marginTop: 4, fontFamily: font.textBold }}>{t('biometric.lock')}</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>
                  {bioAvailable ? t('biometric.desc') : t('profile.biometricUnavailable')}
                </Body>
              </View>
              <Switch testID="profile-biometric-toggle" value={bioEnabled} onValueChange={onToggleBiometric}
                disabled={!bioAvailable} trackColor={{ true: colors.brandPrimary }} />
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Label>{t('privacy.balance')}</Label>
                <Body style={{ marginTop: 4, fontFamily: font.textBold }}>{t('privacy.showAmounts')}</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>
                  {isBalanceVisible ? t('privacy.balancesVisible') : t('privacy.balancesHidden')}
                </Body>
              </View>
              <Switch testID="profile-privacy-toggle" value={isBalanceVisible} onValueChange={toggleBalanceVisibility} trackColor={{ true: colors.brandPrimary }} />
            </View>
          </Card>

          <Card>
            <Label>{t('profile.currency')}</Label>
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
            <Label>{t('payday')}</Label>
            <Body muted style={{ fontSize: 12, marginTop: 2 }}>
              {payday ? t('payday.next', { date: payday.nextDate.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }) }) : t('set.payday')}
            </Body>
            <TouchableOpacity testID="profile-payday-picker" onPress={() => setShowPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, marginTop: spacing.md }}>
              <Body style={{ fontFamily: font.textMedium }}>{t('every.nth', { day: user?.payday_day || 25 })}</Body>
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                testID="profile-payday-datepicker"
                // Use January (month 0, always 31 days) so a payday of e.g. the
                // 31st never rolls over to the 1st in a 30-day month.
                value={new Date(new Date().getFullYear(), 0, Math.min(user?.payday_day || 25, 31))}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  if (Platform.OS === 'android') setShowPicker(false);
                  if (event.type === 'set' && date) {
                    const day = date.getDate();
                    setPaydayDay(day);
                    updateProfile({ payday_day: day });
                  }
                }}
              />
            )}
            <Label style={{ marginTop: spacing.lg }}>{t('profile.workSchedule')}</Label>
            <Body muted style={{ fontSize: 12, marginTop: 2 }}>
              {t('profile.workScheduleDescription')}
            </Body>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              {([5, 6, 7] as const).map((w) => (
                <Chip key={w} testID={`profile-workweek-${w}`} label={t('profile.workDays', { days: w })}
                  active={(user?.work_week ?? 5) === w}
                  onPress={() => { setWorkWeek(w); updateProfile({ work_week: w }); }} />
              ))}
            </View>
          </Card>

          {/* Language */}
          <Label style={{ marginTop: spacing.sm }}>{t('profile.notificationsSection').toUpperCase()}</Label>
          <Card>
            <Label>{t('language')}</Label>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              {(['en', 'id'] as const).map((l) => (
                <Chip key={l} testID={`profile-lang-${l}`} label={l === 'en' ? 'English' : 'Indonesia'}
                  active={lang === l} onPress={async () => { await setLocale(l); await refreshNetWorthWidget(); }} />
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

          <Label style={{ marginTop: spacing.sm }}>{t('profile.dataAbout').toUpperCase()}</Label>
          <Card onPress={() => router.push('/reports')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>{t('reports')}</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>{t('profile.reportsDescription')}</Body>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>

          <Card onPress={() => { resetOnboarding(); router.push('/(auth)/onboarding' as any); }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>{t('onboarding.tour')}</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>{t('onboarding.desc')}</Body>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>

          <Card onPress={() => router.push('/transactions')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>{t('profile.allTransactions')}</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>{t('profile.allTransactionsDescription')}</Body>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>

          <Card onPress={() => router.push('/privacy' as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Body style={{ fontFamily: font.textBold }}>{t('privacy')}</Body>
                <Body muted style={{ marginTop: 2, fontSize: 12 }}>{t('privacy.desc')}</Body>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Card>

          <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
            <AppVersion />
          </View>
          <Button testID="profile-signout" label={t('sign.out')} variant="danger" onPress={doLogout} style={{ marginTop: spacing.md }} />

          <TouchableOpacity testID="profile-delete-account" onPress={doDeleteAccount}
            style={{ alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm }}>
            <Body muted style={{ fontSize: 12 }}>{t('delete.account')}</Body>
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
