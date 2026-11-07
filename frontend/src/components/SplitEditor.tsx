import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font, formatMoney } from '@/src/theme/tokens';
import { Body, Label, Button } from '@/src/components/ui';
import { MoneyInput } from '@/src/components/MoneyInput';
import { CategorySelector } from '@/src/components/CategorySelector';
import { useI18n } from '@/src/lib/I18nProvider';
import { summarizeSplits, splitEvenly, rebalanceParts, type SplitPart } from '@/src/lib/split';
import { systemCategoryLabel } from '@/src/lib/categories';

export function SplitEditor({
  parts,
  onChange,
  total,
  currency,
}: {
  parts: SplitPart[];
  onChange: (parts: SplitPart[]) => void;
  total: number;
  currency: string;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const summary = summarizeSplits(parts, total);

  const update = (index: number, patch: Partial<SplitPart>) => {
    onChange(parts.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  };

  const addPart = () => {
    onChange([...parts, { key: `sp${Date.now()}${parts.length}`, category: 'Other', amount: '' }]);
  };

  const removePart = (index: number) => {
    onChange(parts.filter((_, i) => i !== index));
  };

  const distributeEvenly = () => {
    const values = splitEvenly(total, parts.length);
    onChange(parts.map((part, index) => ({ ...part, amount: String(values[index]) })));
  };

  return (
    <View testID="split-editor" style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>{t('split.edit')}</Label>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TouchableOpacity testID="split-evenly" accessibilityRole="button" accessibilityLabel={t('split.evenly')} onPress={distributeEvenly}>
            <Body style={{ fontSize: 12, color: colors.brandPrimary, fontFamily: font.textBold }}>{t('split.evenly')}</Body>
          </TouchableOpacity>
          <TouchableOpacity testID="split-rebalance" accessibilityRole="button" accessibilityLabel={t('split.rebalance')} onPress={() => onChange(rebalanceParts(parts, total))}>
            <Body style={{ fontSize: 12, color: colors.brandPrimary, fontFamily: font.textBold }}>{t('split.rebalance')}</Body>
          </TouchableOpacity>
        </View>
      </View>

      {parts.map((part, index) => (
        <View key={part.key} testID={`split-part-${index}`} style={{
          borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.surface2, padding: spacing.md, gap: spacing.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Body style={{ fontFamily: font.textBold, fontSize: 13 }}>{systemCategoryLabel(part.category, t)}</Body>
            {parts.length > 2 && (
              <TouchableOpacity testID={`split-remove-${index}`} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={8} onPress={() => removePart(index)}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <CategorySelector
            type="expense"
            value={part.category}
            onChange={(next) => update(index, { category: next })}
            testID={`split-cat-${index}`}
          />
          <MoneyInput
            testID={`split-amount-${index}`}
            label={t('transaction.amount')}
            currency={currency}
            value={part.amount}
            onChange={(next) => update(index, { amount: next })}
          />
        </View>
      ))}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button testID="split-add-part" variant="secondary" label={t('split.addPart')} onPress={addPart} />
        <View style={{ alignItems: 'flex-end' }}>
          <Body testID="split-sum" style={{
            fontFamily: font.textBold, fontSize: 13,
            color: summary.balanced ? colors.success : colors.warning,
          }}>
            {t('split.allocated', { sum: formatMoney(summary.sum, currency), total: formatMoney(total, currency) })}
          </Body>
          {!summary.balanced && (
            <Body testID="split-remaining" muted style={{ fontSize: 11, marginTop: 2, color: summary.remaining < 0 ? colors.error : colors.muted }}>
              {summary.remaining < 0
                ? t('split.overBy', { amount: formatMoney(Math.abs(summary.remaining), currency) })
                : t('split.remaining', { amount: formatMoney(Math.max(0, summary.remaining), currency) })}
            </Body>
          )}
        </View>
      </View>
    </View>
  );
}
