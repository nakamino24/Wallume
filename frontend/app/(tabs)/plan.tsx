import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ImageBackground, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font, formatMoney, formatMoneyFull, images } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, Card, H1, H2, Body, Label, DisplayNumber, ProgressRing, ProgressBar, EmptyState, Chip } from '@/src/components/ui';
import { computeInvestmentMetrics, kindLabel, quantitySummary } from '@/src/lib/investmentKinds';

type Section = 'budgets' | 'goals' | 'plans' | 'debts' | 'assets';

const PLAN_HERO: Record<string, string> = {
  wedding: images.wedding, house: images.house, car: images.car, vacation: images.vacation,
};
const PLAN_ICON: Record<string, any> = {
  wedding: 'heart', house: 'home', car: 'car-sport', vacation: 'airplane',
};

export default function PlanScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [section, setSection] = useState<Section>('budgets');
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
        {/* Sticky header */}
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <H1>Plan</H1>
          <Body muted style={{ marginTop: 4 }}>Budgets, goals, and life plans.</Body>
        </View>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.md }}
        >
          {(['budgets', 'goals', 'plans', 'debts', 'assets'] as Section[]).map((s) => (
            <Chip key={s} testID={`plan-chip-${s}`} label={s[0].toUpperCase() + s.slice(1)} active={section === s} onPress={() => setSection(s)} />
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          {section === 'budgets' && (
            <BudgetsSection budgets={budgets} currency={cur} onAdd={() => router.push('/budget/new')} onReload={load} />
          )}
          {section === 'goals' && (
            <GoalsSection goals={goals} currency={cur} onAdd={() => router.push('/goal/new')} onOpen={(id) => router.push({ pathname: '/goal/[id]', params: { id } })} onReload={load} />
          )}
          {section === 'plans' && (
            <PlansSection plans={plans} currency={cur} onAdd={(kind) => router.push({ pathname: '/plan/new', params: { kind } })} onOpen={(id) => router.push({ pathname: '/plan/[id]', params: { id } })} />
          )}
          {section === 'debts' && (
            <DebtsSection debts={debts} currency={cur} onAdd={() => router.push('/debt/new')} onReload={load} />
          )}
          {section === 'assets' && (
            <AssetsSection assets={assets} investments={investments} currency={cur}
              onAddAsset={() => router.push('/asset/new')}
              onAddInv={() => router.push('/investment/new')}
              onReload={load} />
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

/* --------------------- BUDGETS --------------------- */
function BudgetsSection({ budgets, currency, onAdd, onReload }: any) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <H2>Monthly budgets</H2>
        <TouchableOpacity testID="budget-add-btn" onPress={onAdd}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={18} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {budgets.length === 0 ? (
        <EmptyState testID="budgets-empty" title="No budgets yet" subtitle="Set spending limits per category." actionLabel="Add budget" onAction={onAdd} />
      ) : (
        budgets.map((b: any) => {
          const spent = b.spent || 0;
          const p = b.amount > 0 ? Math.min(1, spent / b.amount) : 0;
          const over = spent > b.amount;
          const color = over ? colors.error : p > 0.8 ? colors.warning : colors.brandPrimary;
          return (
            <Card key={b.id} onPress={() => confirmDialog('Delete budget?', async () => { await api.deleteBudget(b.id); onReload(); })}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ProgressRing progress={p} color={color} size={54} stroke={7}>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 11 }}>{Math.round(p * 100)}%</Body>
                </ProgressRing>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{b.category}</Body>
                  <Body muted style={{ marginTop: 2 }}>
                    {formatMoney(spent, currency)} of {formatMoney(b.amount, currency)}
                  </Body>
                </View>
                <Body style={{ fontFamily: font.displayBold, color }}>
                  {formatMoney(b.amount - spent, currency)}
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <H2>Saving goals</H2>
        <TouchableOpacity testID="goal-add-btn" onPress={onAdd}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={18} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {goals.length === 0 ? (
        <EmptyState testID="goals-empty" title="No goals yet" subtitle="Save toward an emergency fund, a car, or anything you want." actionLabel="Create goal" onAction={onAdd} />
      ) : (
        goals.map((g: any) => {
          const p = g.target_amount > 0 ? Math.min(1, g.saved_amount / g.target_amount) : 0;
          return (
            <Card key={g.id} onPress={() => onOpen(g.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (g.color || colors.brandSoft), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={goalIcon(g.kind)} size={20} color={colors.onBrand} />
                </View>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{g.name}</Body>
                  <Body muted style={{ marginTop: 2 }}>
                    {formatMoney(g.saved_amount, currency)} / {formatMoney(g.target_amount, currency)}
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
  const { colors } = useTheme();
  const kinds: Array<'wedding' | 'house' | 'car' | 'vacation'> = ['wedding', 'house', 'car', 'vacation'];
  return (
    <>
      <H2>Life plans</H2>
      <Body muted style={{ marginTop: -6, marginBottom: spacing.sm }}>Structured plans with budget & checklist.</Body>
      {plans.length > 0 && plans.map((p: any) => {
        const totalPaid = (p.items || []).reduce((s: number, i: any) => s + (i.paid || 0), 0);
        const progress = p.total_budget > 0 ? Math.min(1, totalPaid / p.total_budget) : 0;
        return (
          <TouchableOpacity key={p.id} testID={`plan-open-${p.id}`} activeOpacity={0.9} onPress={() => onOpen(p.id)}>
            <ImageBackground
              source={{ uri: PLAN_HERO[p.kind] }}
              style={styles.planHero}
              imageStyle={{ borderRadius: radius.lg }}
            >
              <LinearGradient colors={['transparent', '#000000ee']} style={styles.planScrim}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name={PLAN_ICON[p.kind]} size={16} color="#ffffffcc" />
                  <Body style={{ color: '#ffffffcc', marginLeft: 6, fontFamily: font.textMedium, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11 }}>{p.kind}</Body>
                </View>
                <H2 style={{ color: '#fff' }}>{p.name}</H2>
                <Body style={{ color: '#ffffffcc', marginTop: 4 }}>
                  {formatMoney(totalPaid, currency)} of {formatMoney(p.total_budget, currency)}
                </Body>
                <View style={{ marginTop: 8 }}>
                  <ProgressBar progress={progress} color={colors.brandPrimary} />
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        );
      })}

      <Label style={{ marginTop: spacing.lg }}>Start a new plan</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {kinds.map((k) => (
          <TouchableOpacity key={k} testID={`plan-new-${k}`} activeOpacity={0.9} onPress={() => onAdd(k)} style={{ width: '48%' }}>
            <ImageBackground source={{ uri: PLAN_HERO[k] }} style={styles.planTile} imageStyle={{ borderRadius: radius.lg }}>
              <LinearGradient colors={['transparent', '#000000cc']} style={styles.planTileScrim}>
                <Ionicons name={PLAN_ICON[k]} size={20} color="#fff" />
                <Body style={{ color: '#fff', fontFamily: font.textBold, marginTop: 4, textTransform: 'capitalize' }}>{k}</Body>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

/* --------------------- DEBTS --------------------- */
function DebtsSection({ debts, currency, onAdd, onReload }: any) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <H2>Debts</H2>
        <TouchableOpacity testID="debt-add-btn" onPress={onAdd}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={18} color={colors.onBrand} />
        </TouchableOpacity>
      </View>
      {debts.length === 0 ? (
        <EmptyState testID="debts-empty" title="No debts tracked" subtitle="Track loans and credit cards to plan payoff." actionLabel="Add debt" onAction={onAdd} />
      ) : debts.map((d: any) => {
        const paid = d.principal - d.remaining;
        const p = d.principal > 0 ? Math.min(1, paid / d.principal) : 0;
        return (
          <Card key={d.id} onPress={() => confirmDialog('Delete debt?', async () => { await api.deleteDebt(d.id); onReload(); })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{d.name}</Body>
                <Body muted style={{ marginTop: 2 }}>{d.kind.replace('_', ' ')} · {d.interest_rate}% APR</Body>
              </View>
              <Body style={{ fontFamily: font.displayBold, color: colors.error }}>{formatMoney(d.remaining, currency)}</Body>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar progress={p} color={colors.warning} />
              <Body muted style={{ marginTop: 6, fontSize: 12 }}>
                Paid {formatMoney(paid, currency)} of {formatMoney(d.principal, currency)} ({Math.round(p * 100)}%)
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <H2>Investments</H2>
        <TouchableOpacity testID="inv-add-btn" onPress={onAddInv}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={18} color={colors.onBrand} />
        </TouchableOpacity>
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

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg }}>
        <H2>Assets</H2>
        <TouchableOpacity testID="asset-add-btn" onPress={onAddAsset}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={18} color={colors.onBrand} />
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
            <Body style={{ fontFamily: font.displayBold }}>{formatMoney(a.value, currency)}</Body>
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

const styles = StyleSheet.create({
  planHero: { height: 180, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  planScrim: { padding: spacing.lg, borderRadius: radius.lg },
  planTile: { height: 120, overflow: 'hidden', borderRadius: radius.lg, justifyContent: 'flex-end' },
  planTileScrim: { padding: spacing.md, borderRadius: radius.lg, minHeight: 120, justifyContent: 'flex-end' },
});
