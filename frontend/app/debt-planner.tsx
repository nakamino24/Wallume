import React, { useCallback, useRef, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, Input, EmptyState } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { MoneyValue } from '@/src/components/MoneyValue';
import { useI18n } from '@/src/lib/I18nProvider';

type Strategy = 'avalanche' | 'snowball';

export default function DebtPlanner() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const cur = user?.currency || 'USD';

  const [extra, setExtra] = useState('0');
  const [plan, setPlan] = useState<any>(null);
  const [active, setActive] = useState<Strategy>('avalanche');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);

  const load = useCallback(async (extraAmt: number) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.payoffPlan(extraAmt);
      setPlan(r);
      loadedRef.current = true;
    } catch (e: any) {
      setError(t('planner.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(parseFloat(extra) || 0); }, [load, extra]));

  const applyExtra = () => load(parseFloat(extra) || 0);

  const result = plan?.[active];

  if (loading && !loadedRef.current) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Body muted style={{ marginTop: spacing.md }}>{t('planner.calculating')}</Body>
          </View>
        </SafeAreaView>
      </Screen>
    );
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingTop: spacing.md }}>
            <TouchableOpacity testID="planner-back" accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>{t('planner.title')}</H2>
          </View>
          {plan && !plan.has_debts ? (
            <EmptyState testID="planner-empty" title={t('planner.emptyTitle')} subtitle={t('planner.emptySubtitle')}
              actionLabel={t('planner.emptyAction')} onAction={() => router.push('/debt/new')} />
          ) : (
            <>
              {!!error && (
                <View style={{ backgroundColor: colors.error + '1A', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
                  <Body style={{ color: colors.error }}>{error}</Body>
                </View>
              )}

              {/* Extra payment input */}
              <Card>
                <Label>{t('planner.extraPayment')}</Label>
                <Body muted style={{ fontSize: 12, marginTop: 2 }}>
                  {t('planner.extraHelp')}
                </Body>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm }}>
                  <Body style={{ fontSize: 18, fontFamily: font.displayBold }}>{currencySymbol(cur)}</Body>
                  <Input testID="planner-extra" keyboardType="decimal-pad" value={extra} onChangeText={setExtra}
                    placeholder="0" style={{ flex: 1 }} onEndEditing={applyExtra} onSubmitEditing={applyExtra} />
                </View>
                {loading && <ActivityIndicator size="small" color={colors.brandPrimary} style={{ marginTop: spacing.sm }} />}
              </Card>

              {/* Strategy switch */}
              <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginTop: spacing.lg }}>
                {(['avalanche', 'snowball'] as Strategy[]).map((s) => (
                  <TouchableOpacity key={s} testID={`planner-strategy-${s}`} onPress={() => setActive(s)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', backgroundColor: active === s ? colors.brandPrimary : 'transparent' }}>
                    <Body style={{ color: active === s ? colors.onBrand : colors.onSurface2, fontFamily: font.textBold }}>{t(`planner.strategy.${s}`)}</Body>
                  </TouchableOpacity>
                ))}
              </View>
              <Body muted style={{ fontSize: 12, marginTop: spacing.sm, textAlign: 'center' }}>
                {active === 'avalanche'
                  ? t('planner.strategy.avalancheHelp')
                  : t('planner.strategy.snowballHelp')}
              </Body>

              {!!result && (
                <>
                  <Card style={{ marginTop: spacing.lg, backgroundColor: colors.inverse }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Label style={{ color: colors.onInverse, opacity: 0.6 }}>{t('planner.debtFreeIn')}</Label>
                        <H1 style={{ color: colors.onInverse, marginTop: 4 }}>
                          {result.months ? t('planner.months', { value: result.months }) : t('planner.years50')}
                        </H1>
                        {!!result.debt_free_date && (
                          <Body style={{ color: colors.onInverse, opacity: 0.6, marginTop: 2 }}>≈ {result.debt_free_date}</Body>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Label style={{ color: colors.onInverse, opacity: 0.6 }}>{t('planner.totalInterest')}</Label>
                        <MoneyValue value={result.total_interest} currency={cur} style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 26, marginTop: 4 }} />
                      </View>
                    </View>
                  </Card>

                  {!!plan.interest_saved_with_avalanche && plan.interest_saved_with_avalanche > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.success + '1A', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
                      <Ionicons name="trending-down" size={18} color={colors.success} />
                      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}><Body style={{ fontSize: 13 }}>{t('planner.avalanchePrefix')} </Body><MoneyValue value={plan.interest_saved_with_avalanche} currency={cur} style={{ fontFamily: font.textBold, fontSize: 13, color: colors.success }} /><Body style={{ fontSize: 13 }}> {t('planner.avalancheSuffix')}</Body></View>
                    </View>
                  )}

                  <Label style={{ marginTop: spacing.xl }}>{t('planner.payoffOrder')}</Label>
                  <Card style={{ padding: 0, marginTop: spacing.sm }}>
                    {[...result.debts].sort((a: any, b: any) => (a.payoff_month ?? 999) - (b.payoff_month ?? 999)).map((d: any, idx: number) => (
                      <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: idx === result.debts.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                          <Body style={{ fontSize: 12, fontFamily: font.textBold, color: colors.onBrandSoft }}>{idx + 1}</Body>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Body style={{ fontFamily: font.textMedium }}>{d.name}</Body>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}><Body muted style={{ fontSize: 12 }}>{d.payoff_month ? t('planner.paidMonth', { month: d.payoff_month }) : t('planner.horizon')} · </Body><MoneyValue value={d.interest_paid} currency={cur} style={{ color: colors.muted, fontSize: 12 }} /><Body muted style={{ fontSize: 12 }}> {t('planner.interest')}</Body></View>
                        </View>
                      </View>
                    ))}
                  </Card>
                </>
              )}
            </>
          )}
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
