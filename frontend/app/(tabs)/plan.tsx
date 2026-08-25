import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoney, cv } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, ProgressRing, ProgressBar, EmptyState } from '@/src/components/ui';
import { computeInvestmentMetrics, kindLabel, quantitySummary } from '@/src/lib/investmentKinds';
import { FinancialHubSwitcher, type FinancialModuleKey } from '@/src/components/finance/FinancialHubSwitcher';
import { FinancialHubSheet } from '@/src/components/finance/FinancialHubSheet';
import { PlanCard } from '@/src/components/plans/PlanCard';
import { PlanTemplateCard } from '@/src/components/plans/PlanTemplateCard';
import { t } from '@/src/lib/i18n';

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
    } catch {}
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
          {section === 'budgets' && (
            <BudgetsSection budgets={budgets} currency={cur} onAdd={() => router.push('/budget/new')} onReload={load} />
          )}
          {section === 'goals' && (
            <GoalsSection goals={goals} currency={cur} onAdd={() => router.push('/goal/new')} onOpen={(id: string) => router.push({ pathname: '/goal/[id]', params: { id } })} onReload={load} />
          )}
          {section === 'plans' && (
            <PlansSection plans={plans} currency={cur} onAdd={(kind: string) => router.push({ pathname: '/plan/new', params: { kind } })} onOpen={(id: string) => router.push({ pathname: '/plan/[id]', params: { id } })} />
          )}
          {section === 'debts' && (
            <DebtsSection debts={debts} currency={cur} onAdd={() => router.push('/debt/new')} onReload={load} />
          )}
          {section === 'assets' && (
            <AssetsSection assets={assets} investments={[]} currency={cur}
              onAddAsset={() => router.push('/asset/new')}
              onAddInv={() => router.push('/investment/new')}
              onReload={load} />
          )}
          {section === 'investments' && (
            <AssetsSection assets={[]} investments={investments} currency={cur}
              onAddAsset={() => router.push('/asset/new')}
              onAddInv={() => router.push('/investment/new')}
              onReload={load} />
          )}
        </ScrollView>
        <FinancialHubSheet visible={hubOpen} current={section} onClose={() => setHubOpen(false)} onSelect={(next) => { setHubOpen(false); if (next === 'bills') router.push('/recurring'); else setSection(next); }} />
      </SafeAreaView>
    </Screen>
  );
}

/* --------------------- BUDGETS --------------------- */
function BudgetsSection({ budgets, currency, onAdd, onReload }: any) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>Monthly budgets</H2>
        <TouchableOpacity testID="budget-add-btn" onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {budgets.length === 0 ? (
        <EmptyState testID="budgets-empty" title="No budgets yet" subtitle="Set spending limits per category." actionLabel="Add budget" onAction={onAdd} />
      ) : (
        budgets.map((b: any) => {
          const spent = cv(b, 'spent');
          const amount = cv(b, 'amount');
          const pct = amount > 0 ? (spent / amount) * 100 : 0;
          const p = Math.min(1, pct / 100);
          const over = spent > amount;
          const warn = pct >= 80 && !over;
          const color = over ? colors.error : warn ? colors.warning : colors.brandPrimary;
          return (
            <Card key={b.id} onPress={() => confirmDialog('Delete budget?', async () => { await api.deleteBudget(b.id); onReload(); })}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ProgressRing progress={p} color={color} size={54} stroke={7}>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 11 }}>{Math.round(p * 100)}%</Body>
                </ProgressRing>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{b.category}</Body>
                  <Body muted style={{ marginTop: 2 }}>
                    {formatMoney(spent, currency)} of {formatMoney(amount, currency)}
                  </Body>
                </View>
                <Body style={{ fontFamily: font.displayBold, color }}>
                  {formatMoney(amount - spent, currency)}
                </Body>
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
        <H2 style={{ flex: 1, minWidth: 0 }}>Saving goals</H2>
        <TouchableOpacity testID="goal-add-btn" onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {goals.length === 0 ? (
        <EmptyState testID="goals-empty" title="No goals yet" subtitle="Save toward an emergency fund, a car, or anything you want." actionLabel="Create goal" onAction={onAdd} />
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
                  <Body muted style={{ marginTop: 2 }}>
                    {formatMoney(saved, currency)} / {formatMoney(target, currency)}
                  </Body>
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
        <H2 style={{ flex: 1, minWidth: 0 }}>Debts</H2>
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
        <EmptyState testID="debts-empty" title="No debts tracked" subtitle="Track loans and credit cards to plan payoff." actionLabel="Add debt" onAction={onAdd} />
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
              <Body style={{ fontFamily: font.displayBold, color: colors.error }}>{formatMoney(remaining, currency)}</Body>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar progress={p} color={colors.warning} />
              <Body muted style={{ marginTop: 6, fontSize: 12 }}>
                Paid {formatMoney(paid, currency)} of {formatMoney(principal, currency)} ({Math.round(p * 100)}%)
              </Body>
            </View>
          </Card>
        );
      })}
    </>
  );
}

/* --------------------- ASSETS + INVESTMENTS --------------------- */
function AssetsSection({ assets, investments, currency, onAddAsset, onAddInv, onReload }: any) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>Investments</H2>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexShrink: 0 }}>
          {investments.length > 0 && (
            <TouchableOpacity testID="inv-portfolio-btn" onPress={() => router.push('/portfolio' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pie-chart" size={15} color={colors.onBrandSoft} />
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="inv-add-btn" onPress={onAddInv} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={16} color={colors.onBrand} />
          </TouchableOpacity>
        </View>
      </View>
      {investments.length === 0 ? (
        <EmptyState testID="inv-empty" title="No investments" subtitle="Track stocks, crypto, gold and funds." actionLabel="Add investment" onAction={onAddInv} />
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
                <Body style={{ fontFamily: font.displayBold }}>{formatMoney(value, currency)}</Body>
                <Body style={{ marginTop: 2, color: plColor, fontFamily: font.textMedium }}>
                  {pl >= 0 ? '+' : ''}{formatMoney(pl, currency)}
                </Body>
              </View>
            </View>
          </Card>
        );
      })}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
        <H2 style={{ flex: 1, minWidth: 0 }}>Assets</H2>
        <TouchableOpacity testID="asset-add-btn" onPress={onAddAsset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {assets.length === 0 ? (
        <EmptyState testID="assets-empty" title="No assets yet" subtitle="Real estate, vehicles, gadgets…" actionLabel="Add asset" onAction={onAddAsset} />
      ) : assets.map((a: any) => (
        <Card key={a.id} onPress={() => confirmDialog('Delete asset?', async () => { await api.deleteAsset(a.id); onReload(); })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{a.name}</Body>
              <Body muted style={{ marginTop: 2 }}>{a.kind.replace('_', ' ')}</Body>
            </View>
            <Body style={{ fontFamily: font.displayBold }}>{formatMoney(cv(a, 'value'), currency)}</Body>
          </View>
        </Card>
      ))}
    </>
  );
}

function confirmDialog(msg: string, onOk: () => Promise<void>) {
  Alert.alert(msg, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { onOk(); } },
  ]);
}
