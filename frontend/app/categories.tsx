import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip, EmptyState } from '@/src/components/ui';
import { useToast } from '@/src/components/Toast';
import { DEFAULT_CATEGORIES, type UserCategory } from '@/src/lib/categories';

export default function Categories() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [cats, setCats] = useState<UserCategory[]>([]);
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.categories();
      setCats(r.categories || []);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    const trimmed = label.trim();
    if (!trimmed) { toast.show('Enter a category name', 'error'); return; }
    setSaving(true);
    try {
      const r = await api.createCategory({ label: trimmed, type: tab });
      setCats((c) => [...c, r.category]);
      setLabel('');
      toast.show('Category added');
    } catch (e: any) {
      toast.show(e.message || 'Could not add category', 'error');
    } finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    try {
      await api.deleteCategory(id);
      setCats((c) => c.filter((x) => x.id !== id));
      toast.show(`Removed ${name}`);
    } catch { toast.show('Could not remove category', 'error'); }
  };

  const custom = cats.filter((c) => c.type === tab);
  const defaults = tab === 'income' ? DEFAULT_CATEGORIES.income : DEFAULT_CATEGORIES.expense;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>Categories</H2>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
            <Body muted style={{ marginBottom: spacing.lg }}>
              Add your own category names — in any language. They will appear in transactions and budgets.
            </Body>

            {/* Type tabs */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginBottom: spacing.lg }}>
              {(['expense', 'income'] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setTab(t)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', backgroundColor: tab === t ? colors.brandPrimary : 'transparent' }}>
                  <Body style={{ color: tab === t ? colors.onBrand : colors.onSurface2, fontFamily: font.textBold, textTransform: 'capitalize' }}>{t}</Body>
                </TouchableOpacity>
              ))}
            </View>

            {/* Add new */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
              <Input testID="category-input" label="New category" value={label} onChangeText={setLabel}
                placeholder={tab === 'expense' ? 'e.g. Kos / Kost' : 'e.g. Bonus'} style={{ flex: 1 }} />
              <Button testID="category-add" label="Add" onPress={add} loading={saving} style={{ marginBottom: spacing.md, paddingHorizontal: spacing.xl }} />
            </View>

            {/* Custom categories */}
            <Label style={{ marginTop: spacing.lg }}>Your categories</Label>
            {custom.length === 0 ? (
              <EmptyState title="No custom categories" subtitle={`Add an ${tab} category above.`} />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                {custom.map((c) => (
                  <TouchableOpacity key={c.id} onPress={() => remove(c.id, c.label)} activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brandSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
                    <Body style={{ color: colors.onBrandSoft, fontFamily: font.textMedium, fontSize: 13 }}>{c.label}</Body>
                    <Ionicons name="close" size={14} color={colors.onBrandSoft} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Defaults */}
            <Label style={{ marginTop: spacing.xl }}>Defaults</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {defaults.map((c) => (
                <Chip key={c} label={c} />
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}