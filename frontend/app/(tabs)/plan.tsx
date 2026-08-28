import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, ProgressRing, ProgressBar, EmptyState, Button } from '@/src/components/ui';
import { computeInvestmentMetrics, kindLabel, quantitySummary } from '@/src/lib/investmentKinds';
import { FinancialHubSwitcher, type FinancialModuleKey } from '@/src/components/finance/FinancialHubSwitcher';
import { FinancialHubSheet } from '@/src/components/finance/FinancialHubSheet';
import { PlanCard } from '@/src/components/plans/PlanCard';
import { PlanTemplateCard } from '@/src/components/plans/PlanTemplateCard';
import { MoneyValue } from '@/src/components/MoneyValue';
import { t } from '@/src/lib/i18n';
import { SkeletonCard } from '@/src/components/Skeleton';
import { useI18n } from '@/src/lib/I18nProvider';
import { systemCategoryLabel } from '@/src/lib/categories';

type Section = FinancialModuleKey;

export default function PlanScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { t: translate } = useI18n();
  const [section, setSection] = useState<Section>('plans');
  const [hubOpen, setHubOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [b, g, p, d, a, i] = await Promise.all([
        api.budgets(), api.goals(), api.plans(), api.debts(), api.assets(), api.investments(),
      ]);
      setBudgets(b.budgets || []);
      setGoals(g.goals || []);
      setPlans(p.plans || []);
      setDebts(d.debts || []);
      setAssets(a.assets || []);
      setInvestments(i.investments || []);
    } catch (cause) {
      console.error('[Plan] failed to load financial modules', cause);
      setLoadError(translate('data.loadError'));
    } finally {
      setLoaded(true);
    }
  }, [translate]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const cur = user?.currency || 'USD';

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md }}>
          <H1>{translate('plans')}</H1>
          <Body muted style={{ marginTop: 4 }}>{translate('hub.subtitle')}</Body>
          <View style={{ marginTop: spacing.md }}><FinancialHubSwitcher current={section} onPress={() => setHubOpen(true)} /></View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          {!loaded && <SkeletonCard />}
          {loaded && loadError && (
            <Card testID="plan-error">
              <Body style={{ color: colors.error }}>{loadError}</Body>
              <Button testID="plan-retry" label={translate('common.retry')} onPress={load} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />
            </Card>
          )}
          {loaded && !loadError && section === 'budgets' && (
            <BudgetsSection budgets={budgets} currency={cur} onAdd={() => router.push('/budget/new')} onReload={load} />
          )}
          {loaded && !loadError && section === 'goals' && (
            <GoalsSection goals={goals} currency={cur} onAdd={() => router.push('/goal/new')} onOpen={(id: string) => router.push({ pathname: '/goal/[id]', params: { id } })} onReload={load} />
          )}
          {loaded && !loadError && section === 'plans' && (
            <PlansSection plans={plans} currency={cur} onAdd={(kind: string) => router.push({ pathname: '/plan/new', params: { kind } })} onOpen={(id: string) => router.push({ pathname: '/plan/[id]', params: { id } })} />
          )}
          {loaded && !loadError && section === 'debts' && (
            <DebtsSection debts={debts} currency={cur} onAdd={() => router.push('/debt/new')} onReload={load} />
          )}
          {loaded && !loadError && section === 'assets' && (
            <AssetsSection assets={assets} currency={cur} onAdd={() => router.push('/asset/new')} onReload={load} />
          )}
          {loaded && !loadError && section === 'investments' && (
            <InvestmentsSection investments={investments} currency={cur} onAdd={() => router.push('/investment/new')} />
          )}
        </ScrollView>
        <FinancialHubSheet visible={hubOpen} current={section} onClose={() => setHubOpen(false)} onSelect={(next) => { setHubOpen(false); if (next === 'bills') router.push('/recurring'); else setSection(next); }} />
      </SafeAreaView>
    </Screen>
  );
}

export function budgetCategoryLabel(raw: string, translate = t): string {
  return systemCategoryLabel(raw, translate);
}

/* --------------------- BUDGETS --------------------- */
export function BudgetsSection({ budgets, currency, onAdd, onReload }: any) {
  const { colors } = useTheme();
  const { t: translate } = useI18n();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>{t('budgets.monthly')}</H2>
        <TouchableOpacity testID="budget-add-btn" onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {budgets.length === 0 ? (
        <EmptyState testID="budgets-empty" title={t('budgets.empty.title')} subtitle={t('budgets.empty.subtitle')} actionLabel={t('budgets.empty.action')} onAction={onAdd} />
      ) : (
        budgets.map((b: any) => {
          const spent = cv(b, 'spent');
          const amount = cv(b, 'amount');
          const usagePercent = amount > 0 ? (spent / amount) * 100 : 0;
          const ringProgress = Math.min(1, usagePercent / 100);
          const displayPercent = Math.round(usagePercent);
          const over = spent > amount;
          const warn = usagePercent >= 80 && !over;
          const color = over ? colors.error : warn ? colors.warning : colors.brandPrimary;
          const remaining = Math.max(0, amount - spent);
          const overspent = Math.max(0, spent - amount);
          const statusLabel = over ? t('budgets.over') : t('budgets.remaining');
          const statusAmount = over ? overspent : remaining;
          return (
            <Card key={b.id} testID={`budget-card-${b.id}`} onPress={() => confirmDialog(t('budget.delete.title'), async () => { await api.deleteBudget(b.id); onReload(); })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flexShrink: 0 }}>
                  <ProgressRing progress={ringProgress} color={color} size={54} stroke={7}>
                    <Body testID={`budget-pct-${b.id}`} style={{ fontFamily: font.displayBold, fontSize: 11 }}>{displayPercent}%</Body>
                  </ProgressRing>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body numberOfLines={1} style={{ fontFamily: font.textBold, fontSize: 15 }}>{budgetCategoryLabel(b.category, translate)}</Body>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2, gap: 4 }}>
                    <MoneyValue value={spent} currency={currency} style={{ color: colors.muted, fontSize: 14, lineHeight: 18 }} />
                    <Body muted style={{ fontSize: 14, lineHeight: 18 }}> {t('budgets.of')} </Body>
                    <MoneyValue value={amount} currency={currency} style={{ color: colors.muted, fontSize: 14, lineHeight: 18 }} />
                  </View>
                </View>
                <View style={{ minWidth: 92, maxWidth: 110, alignItems: 'flex-end', flexShrink: 0 }}>
                  <Body numberOfLines={1} style={{ fontFamily: font.textBold, fontSize: 12, color, textAlign: 'right' }}>{statusLabel}</Body>
                  <MoneyValue testID={`budget-status-${b.id}`} value={statusAmount} currency={currency} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: font.displayBold, color, fontSize: 13, marginTop: 2, textAlign: 'right' }} />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </>
  );
}

/* --------------------- GOALS --------------------- */
function GoalsSection({ goals, currency, onAdd, onOpen, onReload }: any) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>{t('goals.heading')}</H2>
        <TouchableOpacity testID="goal-add-btn" onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {goals.length === 0 ? (
        <EmptyState testID="goals-empty" title={t('goals.empty.title')} subtitle={t('goals.empty.subtitle')} actionLabel={t('goals.empty.action')} onAction={onAdd} />
      ) : (
        goals.map((g: any) => {
          const saved = cv(g, 'saved_amount');
          const target = cv(g, 'target_amount');
          const p = target > 0 ? Math.min(1, saved / target) : 0;
          return (
            <Card key={g.id} onPress={() => onOpen(g.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (g.color || colors.brandSoft), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={goalIcon(g.kind)} size={20} color={colors.onBrand} />
                </View>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{g.name}</Body>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <MoneyValue value={saved} currency={currency} style={{ color: colors.muted, fontSize: 15 }} />
                    <Body muted> / </Body>
                    <MoneyValue value={target} currency={currency} style={{ color: colors.muted, fontSize: 15 }} />
                  </View>
                </View>
                <Body style={{ fontFamily: font.displayBold, color: colors.brandPrimary }}>{Math.round(p * 100)}%</Body>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <ProgressBar progress={p} />
              </View>
            </Card>
          );
        })
      )}
    </>
  );
}

function goalIcon(kind: string): any {
  switch (kind) {
    case 'emergency': return 'shield-checkmark';
    case 'car': return 'car-sport';
    case 'vacation': return 'airplane';
    case 'education': return 'school';
    case 'gadget': return 'phone-portrait';
    case 'business': return 'briefcase';
    default: return 'flag';
  }
}

/* --------------------- PLANS --------------------- */
function PlansSection({ plans, currency, onAdd, onOpen }: any) {
  const kinds: ('wedding' | 'house' | 'car' | 'vacation')[] = ['wedding', 'house', 'car', 'vacation'];
  return (
    <>
      <H2>{t('plans.active')}</H2>
      <Body muted style={{ marginTop: -6, marginBottom: spacing.sm }}>{t('plans.subtitle')}</Body>
      {plans.length > 0 ? plans.map((p: any) => <PlanCard key={p.id} plan={p} currency={currency} onPress={() => onOpen(p.id)} />) : (
        <View testID="plans-empty" style={{ paddingVertical: spacing.lg }}>
          <Body style={{ fontFamily: font.textMedium }}>{t('plans.empty')}</Body>
          <Body muted style={{ marginTop: 3 }}>{t('plans.empty.subtitle')}</Body>
        </View>
      )}

      <Label style={{ marginTop: spacing.lg }}>{t('plans.start')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {kinds.map((k) => <PlanTemplateCard key={k} kind={k} onPress={() => onAdd(k)} />)}
      </View>
    </>
  );
}

/* --------------------- DEBTS --------------------- */
function DebtsSection({ debts, currency, onAdd, onReload }: any) {
  const { colors } = useTheme();
  const router = useRouter();

  const onDebtAction = (d: any) => {
    Alert.alert(d.name, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: d.remaining > 0 ? t('debts.action.paid') : t('debts.action.delete'),
        style: d.remaining > 0 ? 'default' : 'destructive',
        onPress: async () => {
          try {
            if (d.remaining > 0) {
              const r = await api.updateDebt(d.id, { remaining: 0 });
              if (r.celebrate) {
                Alert.alert(
                  t('debts.paidTitle'),
                  t('debts.paidMessage', { name: d.name }),
                );
              }
            } else {
              await api.deleteDebt(d.id);
            }
            onReload();
          } catch {}
        },
      },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await api.deleteDebt(d.id); onReload(); } },
    ]);
  };
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>{t('debts.heading')}</H2>
        <TouchableOpacity testID="debt-add-btn" onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {debts.length > 0 && (
        <TouchableOpacity testID="debt-planner-link" onPress={() => router.push('/debt-planner')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandSoft, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
          <Ionicons name="trending-down" size={18} color={colors.onBrandSoft} />
          <Body style={{ flex: 1, fontFamily: font.textMedium, color: colors.onBrandSoft }}>{t('debts.payoffLink')}</Body>
          <Ionicons name="chevron-forward" size={16} color={colors.onBrandSoft} />
        </TouchableOpacity>
      )}
      {debts.length === 0 ? (
        <EmptyState testID="debts-empty" title={t('debts.empty.title')} subtitle={t('debts.empty.subtitle')} actionLabel={t('debts.empty.action')} onAction={onAdd} />
      ) : debts.map((d: any) => {
        const remaining = cv(d, 'remaining');
        const principal = cv(d, 'principal');
        const paid = principal - remaining;
        const p = principal > 0 ? Math.min(1, paid / principal) : 0;
        return (
          <Card key={d.id} onPress={() => onDebtAction(d)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{d.name}</Body>
                <Body muted style={{ marginTop: 2 }}>{t(`debt.kind.${d.kind}`)} · {d.interest_rate}% {t('debt.aprLabel')}</Body>
              </View>
              <MoneyValue value={remaining} currency={currency} style={{ fontFamily: font.displayBold, color: colors.error }} />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar progress={p} color={colors.warning} />
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                <Body muted style={{ fontSize: 12 }}>{t('debts.paid')} </Body>
                <MoneyValue value={paid} currency={currency} style={{ color: colors.muted, fontSize: 12 }} />
                <Body muted style={{ fontSize: 12 }}> {t('debts.of')} </Body>
                <MoneyValue value={principal} currency={currency} style={{ color: colors.muted, fontSize: 12 }} />
                <Body muted style={{ fontSize: 12 }}> ({Math.round(p * 100)}%)</Body>
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}

/* --------------------- ASSETS --------------------- */
export function AssetsSection({ assets, currency, onAdd, onReload }: any) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>{t('assets.heading')}</H2>
        <TouchableOpacity testID="asset-add-btn" onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {assets.length === 0 ? (
        <EmptyState testID="assets-empty" title={t('assets.empty.title')} subtitle={t('assets.empty.subtitle')} actionLabel={t('assets.empty.action')} onAction={onAdd} />
      ) : assets.map((a: any) => (
        <Card key={a.id} testID={`asset-card-${a.id}`} onPress={() => confirmDialog(t('assets.delete.title'), async () => { await api.deleteAsset(a.id); onReload(); })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{a.name}</Body>
              <Body muted style={{ marginTop: 2 }}>{t(`asset.kind.${a.kind}`)}</Body>
            </View>
            <MoneyValue value={cv(a, 'value')} currency={currency} style={{ fontFamily: font.displayBold }} />
          </View>
        </Card>
      ))}
    </>
  );
}

/* --------------------- INVESTMENTS --------------------- */
export function InvestmentsSection({ investments, currency, onAdd }: any) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>{t('investments.heading')}</H2>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexShrink: 0 }}>
          {investments.length > 0 && (
            <TouchableOpacity testID="inv-portfolio-btn" onPress={() => router.push('/portfolio' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pie-chart" size={15} color={colors.onBrandSoft} />
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="inv-add-btn" onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={16} color={colors.onBrand} />
          </TouchableOpacity>
        </View>
      </View>
      {investments.length === 0 ? (
        <EmptyState testID="inv-empty" title={t('investments.empty.title')} subtitle={t('investments.empty.subtitle')} actionLabel={t('investments.empty.action')} onAction={onAdd} />
      ) : investments.map((iv: any) => {
        const { value, pl } = computeInvestmentMetrics(iv);
        const plColor = pl >= 0 ? colors.success : colors.error;
        return (
          <Card key={iv.id} testID={`inv-card-${iv.id}`} onPress={() => router.push(`/investment/${iv.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{iv.name} {iv.ticker ? `· ${iv.ticker}` : ''}</Body>
                <Body muted style={{ marginTop: 2 }}>{kindLabel(iv.kind)} · {quantitySummary(iv)}</Body>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <MoneyValue value={value} currency={currency} style={{ fontFamily: font.displayBold }} />
                <MoneyValue value={pl} currency={currency} style={{ marginTop: 2, color: plColor, fontFamily: font.textMedium }} />
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}

function confirmDialog(msg: string, onOk: () => Promise<void>) {
  Alert.alert(msg, undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: () => { onOk(); } },
  ]);
}
