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

const { width } = Dimensions.get('window');

const STEPS = [
  {
    icon: 'wallet' as const,
    title: 'Track Everything',
    subtitle: 'Wallets, transactions, budgets, and goals — all in one place.',
  },
  {
    icon: 'sparkles' as const,
    title: 'AI Coach',
    subtitle: 'Your personal finance assistant. Ask anything about your money and get instant, personalized advice.',
    highlight: true,
  },
  {
    icon: 'trending-down' as const,
    title: 'Debt Payoff Planner',
    subtitle: 'Compare avalanche vs snowball strategies. See exactly when you will be debt-free.',
  },
  {
    icon: 'stats-chart' as const,
    title: 'Smart Insights',
    subtitle: 'Spending alerts, financial health score, and category breakdowns that keep you on track.',
  },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const { markDone } = useOnboarding();
  const { user, updateProfile } = useAuth();
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
            <Button testID="onboarding-skip" variant="ghost" label="Skip" onPress={skip} />
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
                When is payday?
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted, fontFamily: font.text }]}>
                Pick the day you get paid each month. Wallume counts down to it and shifts it to the previous working day when it falls on a weekend or holiday.
              </Text>

              <TouchableOpacity testID="onboarding-payday-picker" onPress={() => setShowPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, marginTop: spacing.xl }}>
                <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
                <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>Every {paydayDay}th</Body>
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
                Your work schedule
              </Text>
              <Text style={[styles.subtitle, { color: colors.muted, fontFamily: font.text }]}>
                Do you work a 5-day, 6-day, or 7-day work week? This decides which days count as non-working for payday.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg }}>
                {([5, 6, 7] as const).map((w) => (
                  <Chip key={w} testID={`onboarding-workweek-${w}`} label={`${w}-day week`}
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
              {STEPS[step].title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted, fontFamily: font.text }]}>
              {STEPS[step].subtitle}
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
            label={isLast ? 'Start using Wallume' : 'Continue'}
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