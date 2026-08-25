import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Label, ProgressBar } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeProvider';
import { cv, font, formatMoney, radius, spacing } from '@/src/theme/tokens';
import { t } from '@/src/lib/i18n';

const planIcon: Record<string, any> = { wedding: 'heart-outline', house: 'home-outline', car: 'car-sport-outline', vacation: 'airplane-outline' };

export function planProgress(saved: number, target: number) {
  return target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0;
}

export function PlanCard({ plan, currency, onPress }: { plan: any; currency: string; onPress: () => void }) {
  const { colors } = useTheme();
  const saved = (plan.items || []).reduce((total: number, item: any) => total + cv(item, 'paid'), 0);
  const target = cv(plan, 'total_budget');
  const progress = planProgress(saved, target);
  return (
    <Pressable testID={`plan-open-${plan.id}`} accessibilityRole="button" accessibilityLabel={`${plan.name}, ${Math.round(progress * 100)} percent complete`} onPress={onPress} style={({ pressed }) => ({ backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
          <Ionicons name={planIcon[plan.kind] || 'compass-outline'} size={20} color={colors.onBrandSoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>{plan.kind || 'Plan'}</Label>
          <Body numberOfLines={1} style={{ marginTop: 3, fontFamily: font.textMedium }}>{plan.name}</Body>
        </View>
        <Body style={{ color: colors.brandPrimary, fontFamily: font.textMedium }}>{Math.round(progress * 100)}%</Body>
      </View>
      <Body numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: spacing.md, fontFamily: font.displayBold, fontSize: 18, fontVariant: ['tabular-nums'] }}>{formatMoney(saved, currency)}</Body>
      <Body muted style={{ marginTop: 2, fontSize: 12 }}>{t('plans.of')} {formatMoney(target, currency)}</Body>
      <View style={{ marginTop: spacing.sm }}><ProgressBar progress={progress} color={colors.brandPrimary} /></View>
      {!!plan.target_date && <Body muted style={{ marginTop: spacing.sm, fontSize: 12 }}>{t('plans.target')} · {plan.target_date}</Body>}
    </Pressable>
  );
}
