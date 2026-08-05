import React, { useEffect, useState } from 'react';
import {
  View, Modal, TouchableOpacity, Platform, KeyboardAvoidingView, ScrollView, Keyboard,
  type KeyboardEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Button, Input, Chip, Label } from '@/src/components/ui';
import { useToast } from '@/src/components/Toast';
import type { UserCategory } from '@/src/lib/categories';

export function QuickAddCategoryModal({
  visible, onClose, defaultType, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  defaultType: 'income' | 'expense';
  onCreated: (category: UserCategory) => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [saving, setSaving] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // RN <Modal> lives in its own window on Android, so the app-wide keyboard
  // avoidance never applies. Track the real keyboard height and pad the scroll
  // content so the focused input and the Save button stay fully visible.
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setKbHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKbHeight(0);
    const subs = [
      Keyboard.addListener('keyboardWillShow', onShow),
      Keyboard.addListener('keyboardWillHide', onHide),
      Keyboard.addListener('keyboardDidShow', onShow),
      Keyboard.addListener('keyboardDidHide', onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const reset = () => { setLabel(''); setType(defaultType); setSaving(false); };

  const save = async () => {
    if (saving) return;
    const trimmed = label.trim();
    if (!trimmed) { toast.show('Enter a category name', 'error'); return; }
    setSaving(true);
    try {
      const r = await api.createCategory({ label: trimmed, type });
      toast.show('Category added');
      reset();
      onCreated(r.category);
      Keyboard.dismiss();
      onClose();
    } catch (e: any) {
      toast.show(e.message || 'Could not add category', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        {/* This modal renders in its own view hierarchy (RN Modal). The app-wide
            KeyboardAvoidingView never reaches it, and behavior is a no-op on
            Android — so wrap in a ScrollView and pad by real keyboard height. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={{ backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: kbHeight > 0 ? kbHeight + 24 : 24 }}
            >
              <View style={{ padding: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>Add category</Body>
                  <TouchableOpacity testID="quick-add-category-close" onPress={onClose} style={{ padding: 4 }}>
                    <Ionicons name="close" size={22} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                <Label>Name</Label>
                <Input testID="quick-add-category-input" autoFocus value={label} onChangeText={setLabel}
                  placeholder={type === 'expense' ? 'e.g. Kos / Kost' : 'e.g. Bonus'}
                  returnKeyType="done"
                  onSubmitEditing={save} />

                <Label style={{ marginTop: spacing.sm }}>Type</Label>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  {(['expense', 'income'] as const).map((t) => (
                    <Chip key={t} testID={`quick-add-category-type-${t}`} label={t}
                      active={type === t} onPress={() => setType(t)} />
                  ))}
                </View>

                <Button testID="quick-add-category-save" label="Add category" onPress={save} loading={saving} style={{ marginTop: spacing.lg }} />
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}