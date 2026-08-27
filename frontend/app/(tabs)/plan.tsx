import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, ProgressRing, ProgressBar, EmptyState } from '@/src/components/ui';
import { computeInvestmentMetrics, kindLabel, quantitySummary } from '@/src/lib/investmentKinds';
import { FinancialHubSwitcher, type FinancialModuleKey } from '@/src/components/finance/FinancialHubSwitcher';
import { FinancialHubSheet } from '@/src/components/finance/FinancialHubSheet';
import { PlanCard } from '@/src/components/plans/PlanCard';
import { PlanTemplateCard } from '@/src/components/plans/PlanTemplateCard';
import { MoneyValue } from '@/src/components/MoneyValue';
import { t } from '@/src/lib/i18n';
import { SkeletonCard } from '@/src/components/Skeleton';

type Section = FinancialModuleKey;

export default function PlanScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
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

  const load = useCallback(async () => {
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
    } catch {
    } finally {
      setLoaded(true);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const cur = user?.currency || 'USD';

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md }}>
          <H1>{t('plans')}</H1>
          <Body muted style={{ marginTop: 4 }}>{t('hub.subtitle')}</Body>
          <View style={{ marginTop: spacing.md }}><FinancialHubSwitcher current={section} onPress={() => setHubOpen(true)} /></View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          {!loaded && <SkeletonCard />}
          {loaded && section === 'budgets' && (
            <BudgetsSection budgets={budgets} currency={cur} onAdd={() => router.push('/budget/new')} onReload={load} />
          )}
          {loaded && section === 'goals' && (
            <GoalsSection goals={goals} currency={cur} onAdd={() => router.push('/goal/new')} onOpen={(id: string) => router.push({ pathname: '/goal/[id]', params: { id } })} onReload={load} />
          )}
          {loaded && section === 'plans' && (
            <PlansSection plans={plans} currency={cur} onAdd={(kind: string) => router.push({ pathname: '/plan/new', params: { kind } })} onOpen={(id: string) => router.push({ pathname: '/plan/[id]', params: { id } })} />
          )}
          {loaded && section === 'debts' && (
            <DebtsSection debts={debts} currency={cur} onAdd={() => router.push('/debt/new')} onReload={load} />
          )}
          {loaded && section === 'assets' && (
            <AssetsSection assets={assets} currency={cur} onAdd={() => router.push('/asset/new')} onReload={load} />
          )}
          {loaded && section === 'investments' && (
            <InvestmentsSection investments={investments} currency={cur} onAdd={() => router.push('/investment/new')} />
          )}
        </ScrollView>
        <FinancialHubSheet visible={hubOpen} current={section} onClose={() => setHubOpen(false)} onSelect={(next) => { setHubOpen(false); if (next === 'bills') router.push('/recurring'); else setSection(next); }} />
      </SafeAreaView>
    </Screen>
  );
}

export function budgetCategoryLabel(raw: string): string {
  if (!raw) return raw;
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  const translated = t(`budgets.category.${key}`);
  if (translated !== `budgets.category.${key}`) return translated;
  // Fallback: Title Case original
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/* --------------------- BUDGETS --------------------- */
export function BudgetsSection({ budgets, currency, onAdd, onReload }: any) {
  const { colors } = useTheme();
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
            <Card key={b.id} testID={`budget-card-${b.id}`} onPress={() => confirmDialog('Delete budget?', async () => { await api.deleteBudget(b.id); onReload(); })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flexShrink: 0 }}>
                  <ProgressRing progress={ringProgress} color={color} size={54} stroke={7}>
                    <Body testID={`budget-pct-${b.id}`} style={{ fontFamily: font.displayBold, fontSize: 11 }}>{displayPercent}%</Body>
                  </ProgressRing>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body numberOfLines={1} style={{ fontFamily: font.textBold, fontSize: 15 }}>{budgetCategoryLabel(b.category)}</Body>
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
      { text: 'Cancel', style: 'cancel' },
      {
        text: d.remaining > 0 ? 'Mark as paid' : 'Delete',
        style: d.remaining > 0 ? 'default' : 'destructive',
        onPress: async () => {
          try {
            if (d.remaining > 0) {
              const r = await api.updateDebt(d.id, { remaining: 0 });
              if (r.celebrate) {
                Alert.alert(
                  '🎉 Debt paid off!',
                  `Congratulations! ${d.name} is fully paid off. You're one step closer to financial freedom.`,
                );
              }
            } else {
              await api.deleteDebt(d.id);
            }
            onReload();
          } catch {}
        },
      },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteDebt(d.id); onReload(); } },
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
          <Body style={{ flex: 1, fontFamily: font.textMedium, color: colors.onBrandSoft }}>See your payoff plan</Body>
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
                <Body muted style={{ marginTop: 2 }}>{d.kind.replace('_', ' ')} · {d.interest_rate}% APR</Body>
              </View>
              <MoneyValue value={remaining} currency={currency} style={{ fontFamily: font.displayBold, color: colors.error }} />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar progress={p} color={colors.warning} />
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                <Body muted style={{ fontSize: 12 }}>Paid </Body>
                <MoneyValue value={paid} currency={currency} style={{ color: colors.muted, fontSize: 12 }} />
                <Body muted style={{ fontSize: 12 }}> of </Body>
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
              <Body muted style={{ marginTop: 2 }}>{a.kind.replace('_', ' ')}</Body>
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
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { onOk(); } },
  ]);
}
