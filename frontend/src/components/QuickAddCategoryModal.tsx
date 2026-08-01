import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
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

  const reset = () => { setLabel(''); setType(defaultType); setSaving(false); };

  const save = async () => {
    const trimmed = label.trim();
    if (!trimmed) { toast.show('Enter a category name', 'error'); return; }
    setSaving(true);
    try {
      const r = await api.createCategory({ label: trimmed, type });
      toast.show('Category added');
      reset();
      onCreated(r.category);
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
        <SafeAreaView style={{ backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ padding: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
                <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>Add category</Body>
                <TouchableOpacity testID="quick-add-category-close" onPress={onClose} style={{ padding: 4 }}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <Label>Name</Label>
              <Input testID="quick-add-category-input" autoFocus value={label} onChangeText={setLabel}
                placeholder={type === 'expense' ? 'e.g. Kos / Kost' : 'e.g. Bonus'} />

              <Label style={{ marginTop: spacing.sm }}>Type</Label>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                {(['expense', 'income'] as const).map((t) => (
                  <Chip key={t} testID={`quick-add-category-type-${t}`} label={t}
                    active={type === t} onPress={() => setType(t)} />
                ))}
              </View>

              <Button testID="quick-add-category-save" label="Add category" onPress={save} loading={saving} style={{ marginTop: spacing.lg }} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}