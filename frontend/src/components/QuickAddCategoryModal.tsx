import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

/**
 * Full category management modal (replaces the old create-only quick-add).
 *
 * - Create a new category (label + type).
 * - Tap a listed row to edit its label inline.
 * - Long-press a row to delete it. If still referenced by transactions the
 *   backend returns 409 `{message:"in_use",count}`; the user is then offered a
 *   picker to reassign those transactions to another category before the delete
 *   actually runs — transactions are never silently dropped.
 *
 * Default/system categories (client-side DEFAULT_CATEGORIES) are never stored in
 * Mongo and are never listed here, so they can't be deleted.
 */
export function QuickAddCategoryModal({
  visible, onClose, defaultType, onCreated, onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  defaultType: 'income' | 'expense';
  onCreated: (category: UserCategory) => void;
  onChanged?: () => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();

  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [saving, setSaving] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // Inline edit state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete / reassign flow state.
  const [deleteCat, setDeleteCat] = useState<UserCategory | null>(null);
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [needsReassign, setNeedsReassign] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.categories();
      setCategories(r.categories || []);
    } catch {}
  }, []);

  // Reset local UI whenever the modal (re)opens so we never show stale state.
  useEffect(() => {
    if (visible) {
      setLabel('');
      setType(defaultType);
      setEditingId(null);
      setDeleteCat(null);
      setReassignTo(null);
      setNeedsReassign(false);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, defaultType]);

  // RN <Modal> lives in its own window, so app-wide keyboard avoidance never
  // applies. Track the real keyboard height and pad the scroll content.
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

  const custom = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const candidates = useMemo(
    () => custom.filter((c) => c.id !== deleteCat?.id),
    [custom, deleteCat],
  );

  const notifyChanged = () => { onChanged?.(); };

  const create = async () => {
    if (saving) return;
    const trimmed = label.trim();
    if (!trimmed) { toast.show('Enter a category name', 'error'); return; }
    setSaving(true);
    try {
      const r = await api.createCategory({ label: trimmed, type });
      toast.show('Category added');
      setLabel('');
      await load();
      onCreated(r.category);
      notifyChanged();
    } catch (e: any) {
      toast.show(e.message || 'Could not add category', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: UserCategory) => {
    setEditingId(c.id);
    setEditLabel(c.label);
  };

  const saveEdit = async () => {
    if (!editingId || editSaving) return;
    const trimmed = editLabel.trim();
    if (!trimmed) { toast.show('Enter a category name', 'error'); return; }
    const target = categories.find((c) => c.id === editingId);
    if (!target) return;
    if (trimmed === target.label) { setEditingId(null); return; }
    setEditSaving(true);
    try {
      await api.updateCategory(editingId, { label: trimmed });
      toast.show('Category updated');
      setEditingId(null);
      await load();
      notifyChanged();
    } catch (e: any) {
      toast.show(e.message || 'Could not update category', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const askDelete = (c: UserCategory) => {
    setDeleteCat(c);
    setReassignTo(null);
    setNeedsReassign(false);
  };

  const doDelete = async () => {
    if (!deleteCat || deleteBusy) return;
    // First attempt a plain delete. If the backend reports the category is still
    // referenced (409 in_use), switch the sheet to the reassign picker.
    if (!needsReassign) {
      setDeleteBusy(true);
      try {
        await api.deleteCategory(deleteCat.id);
        toast.show('Category deleted');
        setDeleteCat(null);
        await load();
        notifyChanged();
        return;
      } catch (e: any) {
        if (e?.status === 409) {
          setDeleteBusy(false);
          setNeedsReassign(true);
          return;
        }
        toast.show(e.message || 'Could not delete category', 'error');
      } finally {
        setDeleteBusy(false);
      }
      return;
    }

    // Reassign mode: require a target, then reassign + delete.
    if (!reassignTo) {
      toast.show('Choose a category to move transactions to', 'error');
      return;
    }
    setDeleteBusy(true);
    try {
      await api.deleteCategoryReassign(deleteCat.id, reassignTo);
      toast.show('Category deleted');
      setDeleteCat(null);
      setNeedsReassign(false);
      await load();
      notifyChanged();
    } catch (e: any) {
      toast.show(e.message || 'Could not delete category', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={{ backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: kbHeight > 0 ? kbHeight + 24 : 24 }}
            >
              <View style={{ padding: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 18 }}>Manage categories</Body>
                  <TouchableOpacity testID="quick-add-category-close" onPress={onClose} style={{ padding: 4 }}>
                    <Ionicons name="close" size={22} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                <Label>New category</Label>
                <Input testID="quick-add-category-input" value={label} onChangeText={setLabel}
                  placeholder={type === 'expense' ? 'e.g. Kos / Kost' : 'e.g. Bonus'}
                  returnKeyType="done"
                  onSubmitEditing={create} />

                <Label style={{ marginTop: spacing.sm }}>Type</Label>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  {(['expense', 'income'] as const).map((t) => (
                    <Chip key={t} testID={`quick-add-category-type-${t}`} label={t}
                      active={type === t} onPress={() => setType(t)} />
                  ))}
                </View>

                <Button testID="quick-add-category-save" label="Add category" onPress={create} loading={saving} style={{ marginTop: spacing.lg }} />

                <Label style={{ marginTop: spacing.xl }}>Your {type} categories</Label>
                <Body muted style={{ fontSize: 12, marginTop: 2, marginBottom: spacing.sm }}>
                  Tap to rename · hold to delete.
                </Body>

                {custom.length === 0 && (
                  <Body muted style={{ paddingVertical: spacing.md, fontSize: 13 }}>
                    No custom {type} categories yet. Add one above.
                  </Body>
                )}

                {custom.map((c) => {
                  const isEditing = editingId === c.id;
                  if (isEditing) {
                    return (
                      <View key={c.id} style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md, gap: spacing.sm }}>
                        <Input testID={`cat-edit-input-${c.id}`} autoFocus value={editLabel}
                          onChangeText={setEditLabel} placeholder="Category name" style={{ flex: 1, marginBottom: 0 }}
                          returnKeyType="done" onSubmitEditing={saveEdit} />
                        <TouchableOpacity testID={`cat-edit-save-${c.id}`} onPress={saveEdit} disabled={editSaving} style={{ paddingVertical: 8 }}>
                          <Ionicons name="checkmark-circle" size={24} color={colors.brandPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity testID={`cat-edit-cancel-${c.id}`} onPress={() => setEditingId(null)} style={{ paddingVertical: 8 }}>
                          <Ionicons name="close-circle" size={24} color={colors.muted} />
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={c.id}
                      testID={`manage-cat-${c.id}`}
                      onPress={() => startEdit(c)}
                      onLongPress={() => askDelete(c)}
                      activeOpacity={0.7}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: (c.color || colors.brandSoft), alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                        <Ionicons name={(c.icon as any) || 'pricetag'} size={14} color={colors.onBrand} />
                      </View>
                      <Body style={{ flex: 1, fontFamily: font.textMedium }}>{c.label}</Body>
                      <Ionicons name="reload" size={14} color={colors.muted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>

      {/* Delete / reassign confirmation modal */}
      {deleteCat && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setDeleteCat(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl }}>
            <SafeAreaView style={{ backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.xl }}>
              <Body style={{ fontFamily: font.displayBold, fontSize: 16, marginBottom: spacing.sm }}>
                Delete “{deleteCat.label}”?
              </Body>

              {needsReassign ? (
                candidates.length > 0 ? (
                  <>
                    <Body muted style={{ marginBottom: spacing.md }}>
                      This category is still referenced by transactions. Choose where to move them, then confirm.
                    </Body>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
                      {candidates.map((c) => (
                        <Chip key={c.id} testID={`reassign-to-${c.id}`} label={c.label}
                          active={reassignTo === c.id} onPress={() => setReassignTo(c.id)} />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <Button variant="secondary" label="Cancel" onPress={() => setDeleteCat(null)} style={{ flex: 1 }} />
                      <Button label="Reassign & delete" loading={deleteBusy}
                        disabled={!reassignTo}
                        onPress={() => doDelete()} style={{ flex: 1 }} />
                    </View>
                  </>
                ) : (
                  <>
                    <Body muted style={{ marginBottom: spacing.md }}>
                      Some transactions still use this category, but there are no other categories to move them to. Add another category first, then retry.
                    </Body>
                    <Button label="OK" onPress={() => setDeleteCat(null)} />
                  </>
                )
              ) : (
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Button variant="secondary" label="Cancel" onPress={() => setDeleteCat(null)} style={{ flex: 1 }} />
                  <Button label="Delete" loading={deleteBusy} onPress={() => doDelete()} style={{ flex: 1 }} />
                </View>
              )}
            </SafeAreaView>
          </View>
        </Modal>
      )}
    </Modal>
  );
}