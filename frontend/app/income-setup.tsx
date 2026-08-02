import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { storage } from '@/src/utils/storage';
import { Screen, H1, H2, Body, Label, Button, Chip } from '@/src/components/ui';
import { useToast } from '@/src/components/Toast';

type Template = {
  id: string; name: string; category: string; icon?: string;
  confidence: number; workWeekDefault?: number; paydayDayDefault?: number;
  incomeSources?: any[];
};

const FAV_KEY = 'mf.incomeFavs';
const RECENT_KEY = 'mf.incomeRecent';
const CATEGORY_ICON: Record<string, string> = {
  'Office / Professional': 'briefcase', Government: 'business', 'Blue Collar / Shift': 'construct',
  Healthcare: 'medkit', Retail: 'cart', Education: 'school', 'Freelance / Gig': 'laptop',
  'Self-Employed / Owner': 'storefront', 'Student / Other': 'book',
};

export default function IncomeSetup() {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'manage' ? 'manage' : 'onboarding';
  const toast = useToast();

  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [applied, setApplied] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [paydayDay, setPaydayDay] = useState<number>(25);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await api.incomeTemplates();
      setTemplates(r.templates || []);
    } catch {}
  }, []);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => {
    (async () => {
      const f = await storage.getItem<string>(FAV_KEY, '[]');
      const rc = await storage.getItem<string>(RECENT_KEY, '[]');
      try { setFavs(JSON.parse(f || '[]')); } catch { setFavs([]); }
      try { setRecent(JSON.parse(rc || '[]')); } catch { setRecent([]); }
    })();
  }, []);

  const toggleFav = async (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(next);
    await storage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const recordRecent = async (id: string) => {
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, 5);
    setRecent(next);
    await storage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  // STEP 2 — auto-configuration: apply the preset immediately (no input).
  const choose = async (t: Template) => {
    setSelected(t);
    setLoading(true);
    try {
      const pd = t.paydayDayDefault || 25;
      setPaydayDay(pd);
      await api.applyIncomeTemplate(t.id, { work_week: t.workWeekDefault || 5, payday_day: pd });
      await updateProfile({ work_week: t.workWeekDefault || 5, payday_day: pd });
      recordRecent(t.id);
      const f = await api.incomeForecast();
      setForecast(f);
      setApplied(t);
      setStep('preview');
    } catch (e: any) {
      toast.show(e.message || 'Could not apply preset', 'error');
    } finally { setLoading(false); }
  };

  // Editable salary date — persists; adjustment still runs on the edited date.
  const setPayday = async (day: number) => {
    setPaydayDay(day);
    await updateProfile({ payday_day: day });
    await api.applyIncomeTemplate(selected!.id, { work_week: selected!.workWeekDefault || 5, payday_day: day });
    const f = await api.incomeForecast();
    setForecast(f);
  };

  const finish = () => {
    if (mode === 'onboarding') router.replace('/(tabs)/home');
    else router.back();
  };

  // ----- filtering for STEP 1 -----
  const q = query.trim().toLowerCase();
  const filtered = q ? templates.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) : templates;
  const favTemplates = filtered.filter((t) => favs.includes(t.id));
  const recentTemplates = recent.map((id) => templates.find((t) => t.id === id)).filter(Boolean) as Template[];
  const byCategory = filtered.filter((t) => !favs.includes(t.id) && !recent.includes(t.id));
  const groups = byCategory.reduce<Record<string, Template[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  // ----- confidence note -----
  const lowConfidence = (selected?.confidence ?? 100) < 80;
  const workingDays = selected?.workWeekDefault === 7 ? 'Mon-Sun' : selected?.workWeekDefault === 6 ? 'Mon-Sat' : 'Mon-Fri';

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <H2 style={{ marginLeft: spacing.sm }}>Income setup</H2>
            {mode === 'manage' && (
              <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            {/* ---------- STEP 1: occupation pick ---------- */}
            {step === 'pick' && (
              <>
                <H1>What do you do?</H1>
                <Body muted style={{ marginTop: 4, marginBottom: spacing.lg }}>Pick your occupation. We&apos;ll auto-set up your income — under 30 seconds.</Body>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
                  <Ionicons name="search" size={18} color={colors.muted} />
                  <TextInput testID="income-search" value={query} onChangeText={setQuery} placeholder="Search occupation…"
                    placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.onSurface, fontFamily: font.text, fontSize: 15, paddingVertical: 12, marginLeft: spacing.sm }} />
                </View>

                {recentTemplates.length > 0 && (
                  <GroupTitle icon="time" label="Recently used" colors={colors} />
                )}
                {recentTemplates.map((t) => <Row key={t.id} t={t} colors={colors} onPress={() => choose(t)} onFav={() => toggleFav(t.id)} fav={favs.includes(t.id)} />)}

                {favTemplates.length > 0 && (
                  <GroupTitle icon="star" label="Favorites" colors={colors} />
                )}
                {favTemplates.map((t) => <Row key={t.id} t={t} colors={colors} onPress={() => choose(t)} onFav={() => toggleFav(t.id)} fav />)}

                {Object.keys(groups).map((cat) => (
                  <View key={cat}>
                    <GroupTitle icon={CATEGORY_ICON[cat] || 'briefcase'} label={cat} colors={colors} />
                    {groups[cat].map((t) => <Row key={t.id} t={t} colors={colors} onPress={() => choose(t)} onFav={() => toggleFav(t.id)} fav={favs.includes(t.id)} />)}
                  </View>
                ))}
              </>
            )}

            {/* ---------- STEP 3: preview summary ---------- */}
            {step === 'preview' && selected && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <TouchableOpacity testID="income-back-pick" onPress={() => setStep('pick')} style={{ padding: 4 }}>
                    <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
                  </TouchableOpacity>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 18, marginLeft: spacing.sm }}>{selected.name}</Body>
                </View>

                {/* Primary income */}
                <Card>
                  <Label>Primary income</Label>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 18, marginTop: 4 }}>
                    {(selected.incomeSources || []).length > 1 ? 'Multiple income sources' : (selected.incomeSources?.[0]?.name || '—')}
                  </Body>
                  {selected.incomeSources && selected.incomeSources.length > 1 && (
                    <Body muted style={{ fontSize: 12, marginTop: 4 }}>
                      {selected.incomeSources.map((s: any) => s.name).join(' · ')}
                    </Body>
                  )}
                  <Body muted style={{ fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
                    Based on common payroll practices in Indonesian {selected.category.toLowerCase()} institutions.
                  </Body>
                </Card>

                {/* Salary date (editable) */}
                <Card>
                  <Label>Salary date</Label>
                  <TouchableOpacity testID="income-salary-date" onPress={() => setShowPicker(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
                    <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>Every {paydayDay}th</Body>
                    <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
                  </TouchableOpacity>
                  {showPicker && (
                    <DateTimePicker
                      value={new Date(new Date().getFullYear(), new Date().getMonth(), paydayDay)}
                      mode="date" maximumDate={new Date(2100, 11, 31)}
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        if (Platform.OS === 'android') setShowPicker(false);
                        if (event.type === 'set' && date) setPayday(date.getDate());
                      }}
                    />
                  )}
                  <Body muted style={{ fontSize: 11, marginTop: 4 }}>
                    Shifts to the previous working day if it falls on a weekend or holiday.
                  </Body>
                </Card>

                {/* Working days + adjustment */}
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Label>Working days</Label>
                      <Body style={{ fontFamily: font.textBold, marginTop: 2 }}>{workingDays}</Body>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Label>Weekend adjustment</Label>
                      <Body style={{ fontFamily: font.textBold, marginTop: 2 }}>
                        {(selected.incomeSources?.[0]?.adjustmentRules?.[0]?.value || 'previous_business_day').replace(/_/g, ' ')}
                      </Body>
                    </View>
                  </View>
                </Card>

                {/* Confidence note */}
                {lowConfidence && (
                  <View style={{ backgroundColor: colors.warning + '1A', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }}>
                    <Body style={{ fontSize: 12, color: colors.warning, lineHeight: 18 }}>
                      This is an estimated configuration based on common industry practices. You can customize it at any time.
                    </Body>
                  </View>
                )}

                <Body muted style={{ fontSize: 11, textAlign: 'center', marginTop: spacing.md }}>
                  You can change these later in Settings.
                </Body>

                <Button testID="income-customize" label="Customize income sources" variant="secondary" onPress={() => router.push('/income-sources' as any)} style={{ marginTop: spacing.md }} />

                <Button testID="income-finish" label={mode === 'onboarding' ? 'Finish & start using Wallume' : 'Done'} onPress={finish} loading={loading} style={{ marginTop: spacing.md }} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>{children}</View>;
}

function GroupTitle({ icon, label, colors }: { icon: string; label: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm }}>
      <Ionicons name={icon as any} size={14} color={colors.muted} />
      <Label style={{ marginLeft: 6 }}>{label}</Label>
    </View>
  );
}

function Row({ t, colors, onPress, onFav, fav }: { t: Template; colors: any; onPress: () => void; onFav: () => void; fav: boolean }) {
  return (
    <TouchableOpacity testID={`income-occupation-${t.id}`} onPress={onPress} activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={(t.icon || 'briefcase') as any} size={17} color={colors.onBrandSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{t.name}</Body>
        <Body muted style={{ fontSize: 11, marginTop: 1 }}>{t.incomeSources?.length || 0} income source{t.incomeSources?.length === 1 ? '' : 's'}</Body>
      </View>
      <TouchableOpacity onPress={onFav} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name={fav ? 'star' : 'star-outline'} size={18} color={fav ? colors.secondary || '#F4A261' : colors.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}