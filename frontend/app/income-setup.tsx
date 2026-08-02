import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H1, H2, Body, Label, Button, Input, Chip, EmptyState } from '@/src/components/ui';
import { useToast } from '@/src/components/Toast';

type Step = 'pick' | 'suggest' | 'edit' | 'schedule' | 'preview';

type Source = {
  id?: string;
  name: string;
  calculationMethod: string;
  frequency: string;
  amount?: number;
  hourlyRate?: number;
  perVisit?: number;
  perShift?: number;
  perSale?: number;
  perProject?: number;
  percentage?: number;
  percentageOf?: string;
  forecastRules?: Record<string, number>;
  recurring: boolean;
};

export default function IncomeSetup() {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'manage' ? 'manage' : 'onboarding';
  const toast = useToast();

  const [step, setStep] = useState<Step>('pick');
  const [templates, setTemplates] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [jobText, setJobText] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [workWeek, setWorkWeek] = useState<number>(user?.work_week || 5);
  const [paydayDay, setPaydayDay] = useState<number>(user?.payday_day || 25);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await api.incomeTemplates();
      setTemplates(r.templates || []);
    } catch {}
  }, []);
  React.useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const suggest = async () => {
    if (!jobText.trim()) return;
    setLoading(true);
    try {
      const r = await api.suggestIncomeTemplates(jobText.trim());
      setSuggestions(r.templates || []);
    } catch { toast.show('Could not suggest templates', 'error'); }
    finally { setLoading(false); }
  };

  const choose = (t: any) => {
    setSelected(t);
    setSources((t.incomeSources || []).map((s: any) => ({ ...s })));
    if (t.workWeekDefault) setWorkWeek(t.workWeekDefault);
    if (t.paydayDayDefault) setPaydayDay(t.paydayDayDefault);
    setStep('edit');
  };

  const updateSource = (idx: number, patch: Partial<Source>) => {
    setSources((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const applyAndPreview = async () => {
    setLoading(true);
    try {
      await api.applyIncomeTemplate(selected.id, {
        work_week: workWeek,
        payday_day: paydayDay,
        override_sources: sources,
      });
      await updateProfile({ work_week: workWeek, payday_day: paydayDay });
      const f = await api.incomeForecast();
      setForecast(f);
      setStep('preview');
    } catch (e: any) {
      toast.show(e.message || 'Could not apply template', 'error');
    } finally { setLoading(false); }
  };

  const finish = () => {
    if (mode === 'onboarding') router.replace('/(tabs)/home');
    else router.back();
  };

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

          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
            {/* Step 1: pick template */}
            {step === 'pick' && (
              <>
                <H1>What do you do?</H1>
                <Body muted style={{ marginTop: 4, marginBottom: spacing.lg }}>Pick your occupation type to pre-fill your income sources.</Body>

                {/* Dropdown to pick one of the 18 templates directly */}
                <Label>Occupation type</Label>
                <TouchableOpacity testID="income-dropdown" onPress={() => setDropdownOpen(true)} activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 14, marginTop: spacing.xs }}>
                  <Body style={{ fontSize: 15 }}>{selected ? selected.name : 'Select your occupation…'}</Body>
                  <Ionicons name="chevron-down" size={18} color={colors.muted} />
                </TouchableOpacity>

                {/* Optional AI suggestion helper */}
                <View style={{ marginTop: spacing.lg }}>
                  <Label>Not sure? Describe your job (optional)</Label>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Input testID="income-suggest-input" value={jobText} onChangeText={setJobText} placeholder="e.g. I work at a hospital" style={{ flex: 1 }} />
                    <Button testID="income-suggest-btn" label="Suggest" onPress={suggest} loading={loading} style={{ marginBottom: spacing.md, paddingHorizontal: spacing.md }} />
                  </View>
                  {suggestions.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                      {suggestions.map((s) => (
                        <Chip key={s.id} testID={`income-suggest-${s.id}`} label={s.name} onPress={() => choose(s)} />
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Dropdown modal listing all 18 templates */}
            <Modal visible={dropdownOpen} transparent animationType="slide" onRequestClose={() => setDropdownOpen(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                <SafeAreaView style={{ backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '75%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
                    <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>Choose occupation</Body>
                    <TouchableOpacity testID="income-dropdown-close" onPress={() => setDropdownOpen(false)} style={{ padding: 4 }}>
                      <Ionicons name="close" size={22} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}>
                    {templates.map((t) => (
                      <TouchableOpacity key={t.id} testID={`income-dropdown-${t.id}`} onPress={() => { setDropdownOpen(false); choose(t); }} activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ flex: 1 }}>
                          <Body style={{ fontFamily: font.textBold, fontSize: 15 }}>{t.name}</Body>
                          <Body muted style={{ fontSize: 12, marginTop: 2 }}>{t.incomeSources?.length || 0} sources</Body>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </SafeAreaView>
              </View>
            </Modal>

            {/* Step 2: edit sources */}
            {step === 'edit' && selected && (
              <>
                <H1>{selected.name}</H1>
                <Body muted style={{ marginTop: 4, marginBottom: spacing.md }}>Edit, remove, add, or reorder your income sources.</Body>
                {sources.map((s, idx) => (
                  <CardRow key={idx} idx={idx} source={s} colors={colors} onChange={(p) => updateSource(idx, p)}
                    onRemove={() => setSources((arr) => arr.filter((_, i) => i !== idx))} />
                ))}
                <Button testID="income-add-source" label="+ Add income source" variant="secondary" onPress={() => setSources((arr) => [...arr, { name: 'New source', calculationMethod: 'fixed_amount', frequency: 'monthly', amount: 0, recurring: true }])} style={{ marginTop: spacing.md }} />
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                  <Button label="Back" variant="secondary" onPress={() => setStep('pick')} style={{ flex: 1 }} />
                  <Button testID="income-edit-next" label="Continue" onPress={() => setStep('schedule')} style={{ flex: 2 }} />
                </View>
              </>
            )}

            {/* Step 3: schedule + calendar */}
            {step === 'schedule' && (
              <>
                <H1>Payment schedule</H1>
                <Body muted style={{ marginTop: 4, marginBottom: spacing.lg }}>Work schedule decides which days count as non-working for payday.</Body>

                <Label>Work week</Label>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  {([5, 6, 7] as const).map((w) => (
                    <Chip key={w} testID={`income-workweek-${w}`} label={`${w}-day`} active={workWeek === w} onPress={() => setWorkWeek(w)} />
                  ))}
                </View>

                <Label style={{ marginTop: spacing.lg }}>Payday day of month</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
                  {[5, 10, 15, 20, 25, 28, 31].map((d) => (
                    <Chip key={d} testID={`income-payday-${d}`} label={`Every ${d}th`} active={paydayDay === d} onPress={() => setPaydayDay(d)} />
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                  <Button label="Back" variant="secondary" onPress={() => setStep('edit')} style={{ flex: 1 }} />
                  <Button testID="income-schedule-next" label="Apply template" onPress={applyAndPreview} loading={loading} style={{ flex: 2 }} />
                </View>
              </>
            )}

            {/* Step 4: preview forecast */}
            {step === 'preview' && forecast && (
              <>
                <H1>Next expected income</H1>
                <View style={{ backgroundColor: colors.inverse, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md }}>
                  <Label style={{ color: colors.onInverse, opacity: 0.6 }}>Total expected</Label>
                  <Body style={{ color: colors.onInverse, fontFamily: font.displayBold, fontSize: 26, lineHeight: 32 }}>{forecast.total_expected?.toLocaleString()}</Body>
                  {forecast.next_payment_date && (
                    <Body style={{ color: colors.onInverse, opacity: 0.7, fontSize: 12, marginTop: 4 }}>Next payment: {forecast.next_payment_date}</Body>
                  )}
                </View>
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {(forecast.sources || []).map((s: any) => (
                    <View key={s.id || s.name} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Body style={{ fontFamily: font.textBold, fontSize: 14 }}>{s.name}</Body>
                        <Body muted style={{ fontSize: 11, marginTop: 2 }}>{s.next_payment_date || 'manual'} · {s.calculation_method}</Body>
                      </View>
                      <Body style={{ fontFamily: font.displayBold }}>{s.amount?.toLocaleString()}</Body>
                    </View>
                  ))}
                </View>
                <Button testID="income-finish" label={mode === 'onboarding' ? 'Finish & start using Wallume' : 'Done'} onPress={finish} style={{ marginTop: spacing.xl }} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

function CardRow({ idx, source, colors, onChange, onRemove }: {
  idx: number; source: Source; colors: any;
  onChange: (patch: Partial<Source>) => void; onRemove: () => void;
}) {
  const [name, setName] = useState(source.name);
  const [amount, setAmount] = useState(String(source.amount ?? ''));
  const method = source.calculationMethod;
  const methodLabel = method.replace(/_/g, ' ');

  const commit = () => onChange({ name, amount: parseFloat(amount) || 0 });

  return (
    <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <TextInput value={name} onChangeText={(v) => { setName(v); onChange({ name: v }); }}
            placeholder="Source name" placeholderTextColor={colors.muted}
            style={{ color: colors.onSurface, fontFamily: font.textBold, fontSize: 14, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 }} />
        </View>
        <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}><Ionicons name="close-circle" size={20} color={colors.error} /></TouchableOpacity>
      </View>
      <Body muted style={{ fontSize: 11, textTransform: 'capitalize', marginTop: 4 }}>{methodLabel} · {source.frequency}</Body>
      <TextInput value={amount} onChangeText={(v) => { setAmount(v); }}
        onEndEditing={commit} keyboardType="numeric" placeholder="Amount" placeholderTextColor={colors.muted}
        style={{ color: colors.onSurface, fontFamily: font.displayBold, fontSize: 18, marginTop: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 }} />
    </View>
  );
}