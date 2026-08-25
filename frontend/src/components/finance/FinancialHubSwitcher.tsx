import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Label } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, font } from '@/src/theme/tokens';
import { t } from '@/src/lib/i18n';

export type FinancialModuleKey = 'budgets' | 'goals' | 'plans' | 'debts' | 'assets' | 'investments' | 'bills';

export const financialModules: Record<FinancialModuleKey, { labelKey: string; detailKey: string; icon: any }> = {
  budgets: { labelKey: 'budgets', detailKey: 'hub.budgets.detail', icon: 'pie-chart-outline' },
  goals: { labelKey: 'goals', detailKey: 'hub.goals.detail', icon: 'flag-outline' },
  plans: { labelKey: 'plans', detailKey: 'hub.plans.detail', icon: 'compass-outline' },
  debts: { labelKey: 'debts', detailKey: 'hub.debts.detail', icon: 'card-outline' },
  assets: { labelKey: 'assets', detailKey: 'hub.assets.detail', icon: 'layers-outline' },
  investments: { labelKey: 'investments', detailKey: 'hub.investments.detail', icon: 'trending-up-outline' },
  bills: { labelKey: 'bills', detailKey: 'hub.bills.detail', icon: 'receipt-outline' },
};

export function FinancialHubSwitcher({ current, onPress }: { current: FinancialModuleKey; onPress: () => void }) {
  const { colors } = useTheme();
  const module = financialModules[current];
  const label = t(module.labelKey);
  return (
    <Pressable
      testID="financial-hub-switcher"
      accessibilityRole="button"
      accessibilityLabel={`${t('hub.current.section')}: ${label}`}
      accessibilityState={{ expanded: false, selected: true }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderColor: colors.border,
        borderWidth: 1, borderRadius: radius.md, padding: spacing.md, opacity: pressed ? 0.86 : 1,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={module.icon} size={18} color={colors.onBrandSoft} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Label>{t('hub.title').toUpperCase()}</Label>
        <Body style={{ marginTop: 2, fontFamily: font.textMedium }}>{label}</Body>
      </View>
      <Ionicons name="chevron-down" size={20} color={colors.muted} />
    </Pressable>
  );
}
