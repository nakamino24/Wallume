import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeProvider';
import { font, radius, spacing } from '@/src/theme/tokens';
import { t } from '@/src/lib/i18n';

const templates: Record<string, { icon: any; tint: string; labelKey: string }> = {
  wedding: { icon: 'heart-outline', tint: '#F7E7E7', labelKey: 'plans.template.wedding' },
  house: { icon: 'home-outline', tint: '#E2F0EA', labelKey: 'plans.template.house' },
  car: { icon: 'car-sport-outline', tint: '#E5EDF2', labelKey: 'plans.template.car' },
  vacation: { icon: 'airplane-outline', tint: '#F7EFD9', labelKey: 'plans.template.vacation' },
};

export function PlanTemplateCard({ kind, onPress }: { kind: keyof typeof templates; onPress: () => void }) {
  const { colors, mode } = useTheme();
  const template = templates[kind];
  const label = t(template.labelKey);
  return (
    <Pressable testID={`plan-new-${kind}`} accessibilityRole="button" accessibilityLabel={`${t('plans.template.start')} ${label}`} onPress={onPress} style={({ pressed }) => ({ flexGrow: 1, flexBasis: '46%', minWidth: 132, minHeight: 104, borderRadius: radius.md, padding: spacing.md, backgroundColor: mode === 'dark' ? colors.surface3 : template.tint, opacity: pressed ? 0.84 : 1 })}>
      <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={template.icon} size={17} color={colors.onBrandSoft} />
      </View>
      <Body style={{ marginTop: spacing.sm, fontFamily: font.textMedium }}>{label}</Body>
      <Body muted style={{ marginTop: 2, fontSize: 12 }}>{t('plans.template.start')}</Body>
    </Pressable>
  );
}
