import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Label } from '@/src/components/ui';
import { DateField } from '@/src/components/DateField';
import { radius, spacing, font } from '@/src/theme/tokens';
import { todayLocalISO } from '@/src/utils/dates';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useI18n } from '@/src/lib/I18nProvider';

function formatPeriod(fromDate: string, toDate: string) {
  const format = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(fromDate)} – ${format(toDate)}`;
}

export function ReportPeriodPicker({ fromDate, toDate, onChange }: {
  fromDate: string;
  toDate: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(fromDate);
  const [draftTo, setDraftTo] = useState(toDate);
  const presets = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const daysAgo = (days: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() - days);
      return todayLocalISO(date);
    };
    return [
      { label: t('report.last7'), from: daysAgo(6), to: todayLocalISO(today) },
      { label: t('report.thisMonth'), from: todayLocalISO(startOfMonth), to: todayLocalISO(today) },
      { label: t('report.lastMonth'), from: todayLocalISO(startOfLastMonth), to: todayLocalISO(endOfLastMonth) },
      { label: t('report.last30'), from: daysAgo(29), to: todayLocalISO(today) },
      { label: t('report.last90'), from: daysAgo(89), to: todayLocalISO(today) },
    ];
  }, [t]);
  const apply = (from: string, to: string) => {
    setDraftFrom(from);
    setDraftTo(to);
    onChange({ from, to });
    setOpen(false);
  };

  return (
    <>
      <Pressable testID="report-period-picker" onPress={() => { setDraftFrom(fromDate); setDraftTo(toDate); setOpen(true); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, opacity: pressed ? 0.86 : 1 })}>
        <View>
          <Label>{t('report.period')}</Label>
          <Body style={{ marginTop: 3, fontFamily: font.textMedium }}>{formatPeriod(fromDate, toDate)}</Body>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radius.pill, backgroundColor: colors.borderStrong }} />
            <View>
              <Label>{t('report.periodTitle')}</Label>
              <Body style={{ fontFamily: font.displayBold, fontSize: font.sizes.lg, marginTop: 4 }}>{t('report.chooseRange')}</Body>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {presets.map((preset) => (
                <Pressable key={preset.label} onPress={() => apply(preset.from, preset.to)} style={({ pressed }) => ({ borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.brandSoft, opacity: pressed ? 0.8 : 1 })}>
                  <Body style={{ color: colors.onBrandSoft, fontFamily: font.textMedium, fontSize: font.sizes.sm }}>{preset.label}</Body>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}><DateField testID="report-from" label={t('common.from')} value={draftFrom} onChange={setDraftFrom} /></View>
              <View style={{ flex: 1 }}><DateField testID="report-to" label={t('common.to')} value={draftTo} onChange={setDraftTo} /></View>
            </View>
            <Pressable testID="report-period-apply" onPress={() => apply(draftFrom, draftTo)} style={({ pressed }) => ({ alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.md, backgroundColor: colors.brandPrimary, opacity: pressed ? 0.88 : 1 })}>
              <Body style={{ color: colors.onBrand, fontFamily: font.textMedium }}>{t('report.applyRange')}</Body>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
