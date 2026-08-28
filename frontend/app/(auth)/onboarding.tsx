import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { useOnboarding } from '@/src/hooks/use-onboarding';
import { font, spacing, radius } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { Button, Body, Chip } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';

const { width } = Dimensions.get('window');

const STEPS = [
  {
    icon: 'wallet' as const,
    titleKey: 'onboarding.track.title',
    subtitleKey: 'onboarding.track.subtitle',
  },
  {
    icon: 'sparkles' as const,
    titleKey: 'onboarding.coach.title',
    subtitleKey: 'onboarding.coach.subtitle',
    highlight: true,
  },
  {
    icon: 'trending-down' as const,
    titleKey: 'onboarding.debt.title',
    subtitleKey: 'onboarding.debt.subtitle',
  },
  {
    icon: 'stats-chart' as const,
    titleKey: 'onboarding.insights.title',
    subtitleKey: 'onboarding.insights.subtitle',
  },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const { markDone } = useOnboarding();
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [paydayDay, setPaydayDay] = useState<number>(user?.payday_day || 25);
  const [workWeek, setWorkWeek] = useState<number>(user?.work_week || 5);
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<any>(null);

  const isPaydayStep = step === STEPS.length;
  const isLast = isPaydayStep;

  const next = async () => {
    if (isPaydayStep) {
      if (paydayDay >= 1 && paydayDay <= 31) {
        try { await updateProfile({ payday_day: paydayDay, work_week: workWeek }); } catch {}
      }
      await markDone();
      router.replace('/(tabs)/home');
    } else {
      scrollRef.current?.scrollTo({ x: width * (step + 1), animated: true });
      setStep((p) => p + 1);
    }
  };

  const skip = async () => {
    await markDone();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Skip */}
        <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          {!isPaydayStep && (
            <Button testID="onboarding-skip" variant="ghost" label={t('onboarding.skip')} onPress={skip} />
          )}
        </View>

        {isPaydayStep ? (
          /* Payday setup step */
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <LinearGradient colors={[colors.brandPrimary + '30', colors.surface]} style={styles.iconShell}>
                <View style={[styles.iconBadge, { backgroundColor: colors.brandPrimary }]}>
                  <Ionicons name="calendar" size={36} color={colors.onBrand} />
                </View>
              </LinearGradient>
              <Text style={[styles.title, { color: colors.onSurface, fontFamily: font.displayBold }]}>
                {t('onboarding.payday.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted, fontFamily: font.text }]}>
                {t('onboarding.payday.subtitle')}
              </Text>

              <TouchableOpacity testID="onboarding-payday-picker" onPress={() => setShowPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, marginTop: spacing.xl }}>
                <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
                <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>{t('every.nth', { day: paydayDay })}</Body>
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker
                  testID="onboarding-payday-datepicker"
                  value={new Date(new Date().getFullYear(), 0, Math.min(paydayDay, 31))}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    if (Platform.OS === 'android') setShowPicker(false);
                    if (event.type === 'set' && date) setPaydayDay(date.getDate());
                  }}
                />
              )}

              <Text style={[styles.title, { color: colors.onSurface, fontFamily: font.displayBold, fontSize: 22, marginTop: spacing.xxl }]}>
                {t('onboarding.work.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted, fontFamily: font.text }]}>
                {t('onboarding.work.subtitle')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg }}>
                {([5, 6, 7] as const).map((w) => (
                  <Chip key={w} testID={`onboarding-workweek-${w}`} label={t('onboarding.work.week', { days: w })}
                    active={workWeek === w} onPress={() => setWorkWeek(w)} />
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          /* Marketing steps */
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
            <LinearGradient
              colors={STEPS[step].highlight
                ? [colors.brandPrimary + '30', colors.surface]
                : [colors.surface3, colors.surface]}
              style={styles.iconShell}
            >
              <View style={[styles.iconBadge, STEPS[step].highlight && { backgroundColor: colors.brandPrimary }]}>
                <Ionicons name={STEPS[step].icon} size={36} color={STEPS[step].highlight ? colors.onBrand : colors.brandPrimary} />
              </View>
            </LinearGradient>
            <Text style={[styles.title, { color: colors.onSurface, fontFamily: font.displayBold }]}>
              {t(STEPS[step].titleKey)}
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted, fontFamily: font.text }]}>
              {t(STEPS[step].subtitleKey)}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xl }}>
            {[...STEPS.map((_, idx) => idx), STEPS.length].map((idx) => (
              <View
                key={idx}
                style={{
                  width: idx === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: idx === step ? colors.brandPrimary : colors.surface3,
                }}
              />
            ))}
          </View>

          <Button
            testID="onboarding-next"
            label={isLast ? t('onboarding.start') : t('onboarding.continue')}
            onPress={next}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconShell: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    alignSelf: 'center',
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: scale(28),
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    alignSelf: 'center',
  },
});
