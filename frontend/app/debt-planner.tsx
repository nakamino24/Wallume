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

type Strategy = 'avalanche' | 'snowball';

export default function DebtPlanner() {
  const { colors } = useTheme();
  const { user } = useAuth();
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
      setError(e.message || 'Failed to load payoff plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(parseFloat(extra) || 0); }, [load, extra]));

  const applyExtra = () => load(parseFloat(extra) || 0);

  const result = plan?.[active];

  if (loading && !loadedRef.current) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Body muted style={{ marginTop: spacing.md }}>Calculating payoff plan…</Body>
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
            <TouchableOpacity testID="planner-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>Debt Payoff Planner</H2>
          </View>
          {plan && !plan.has_debts ? (
            <EmptyState testID="planner-empty" title="No debts to plan" subtitle="Add a debt first to see your payoff strategy."
              actionLabel="Add debt" onAction={() => router.push('/debt/new')} />
          ) : (
            <>
              {!!error && (
                <View style={{ backgroundColor: colors.error + '1A', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
                  <Body style={{ color: colors.error }}>{error}</Body>
                </View>
              )}

              {/* Extra payment input */}
              <Card>
                <Label>Extra monthly payment (optional)</Label>
                <Body muted style={{ fontSize: 12, marginTop: 2 }}>
                  Any amount beyond your minimums, put toward the priority debt each month.
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
                    <Body style={{ color: active === s ? colors.onBrand : colors.onSurface2, fontFamily: font.textBold, textTransform: 'capitalize' }}>{s}</Body>
                  </TouchableOpacity>
                ))}
              </View>
              <Body muted style={{ fontSize: 12, marginTop: spacing.sm, textAlign: 'center' }}>
                {active === 'avalanche'
                  ? 'Pays the highest-interest debt first — saves the most money overall.'
                  : 'Pays the smallest balance first — quick wins to keep you motivated.'}
              </Body>

              {!!result && (
                <>
                  <Card style={{ marginTop: spacing.lg, backgroundColor: colors.inverse }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Debt-free in</Label>
                        <H1 style={{ color: colors.onInverse, marginTop: 4 }}>
                          {result.months ? `${result.months} mo` : '50+ yrs'}
                        </H1>
                        {!!result.debt_free_date && (
                          <Body style={{ color: colors.onInverse, opacity: 0.6, marginTop: 2 }}>≈ {result.debt_free_date}</Body>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Total interest paid</Label>
                        <MoneyValue value={result.total_interest} currency={cur} style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 26, marginTop: 4 }} />
                      </View>
                    </View>
                  </Card>

                  {!!plan.interest_saved_with_avalanche && plan.interest_saved_with_avalanche > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.success + '1A', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
                      <Ionicons name="trending-down" size={18} color={colors.success} />
                      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}><Body style={{ fontSize: 13 }}>Avalanche saves you </Body><MoneyValue value={plan.interest_saved_with_avalanche} currency={cur} style={{ fontFamily: font.textBold, fontSize: 13, color: colors.success }} /><Body style={{ fontSize: 13 }}> in interest vs snowball.</Body></View>
                    </View>
                  )}

                  <Label style={{ marginTop: spacing.xl }}>Payoff order</Label>
                  <Card style={{ padding: 0, marginTop: spacing.sm }}>
                    {[...result.debts].sort((a: any, b: any) => (a.payoff_month ?? 999) - (b.payoff_month ?? 999)).map((d: any, idx: number) => (
                      <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: idx === result.debts.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                          <Body style={{ fontSize: 12, fontFamily: font.textBold, color: colors.onBrandSoft }}>{idx + 1}</Body>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Body style={{ fontFamily: font.textMedium }}>{d.name}</Body>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}><Body muted style={{ fontSize: 12 }}>{d.payoff_month ? `Paid off in month ${d.payoff_month}` : 'Beyond 50-year horizon'} · </Body><MoneyValue value={d.interest_paid} currency={cur} style={{ color: colors.muted, fontSize: 12 }} /><Body muted style={{ fontSize: 12 }}> interest</Body></View>
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
