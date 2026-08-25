import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body, Label } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, font } from '@/src/theme/tokens';
import { financialModules, type FinancialModuleKey } from '@/src/components/finance/FinancialHubSwitcher';
import { t } from '@/src/lib/i18n';

export function FinancialHubSheet({ visible, current, onClose, onSelect }: {
  visible: boolean;
  current: FinancialModuleKey;
  onClose: () => void;
  onSelect: (key: FinancialModuleKey) => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable testID="financial-hub-backdrop" onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surface2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: spacing.xxxl }}>
          <View style={{ alignSelf: 'center', height: 4, width: 36, borderRadius: radius.pill, backgroundColor: colors.borderStrong }} />
          <View style={{ marginTop: spacing.lg }}>
            <Label>{t('hub.title').toUpperCase()}</Label>
            <Body style={{ fontFamily: font.displayBold, fontSize: font.sizes.lg, marginTop: 3 }}>{t('hub.subtitle')}</Body>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
            {(Object.keys(financialModules) as FinancialModuleKey[]).map((key) => {
              const module = financialModules[key];
              const selected = key === current;
              const label = t(module.labelKey);
              return (
                <Pressable
                  key={key}
                  testID={`financial-module-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}. ${selected ? t('hub.current') : t(module.detailKey)}`}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(key)}
                  style={({ pressed }) => ({ width: '48.8%', minHeight: 104, borderRadius: radius.md, padding: spacing.md, backgroundColor: selected ? colors.brandSoft : colors.surface3, borderWidth: 1, borderColor: selected ? colors.brandPrimary : 'transparent', opacity: pressed ? 0.82 : 1 })}
                >
                  <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: selected ? colors.surface2 : colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={module.icon} size={17} color={selected ? colors.brandPrimary : colors.onSurface2} />
                  </View>
                  <Body numberOfLines={2} style={{ fontFamily: font.textMedium, marginTop: spacing.sm }}>{label}</Body>
                  <Body numberOfLines={1} muted style={{ fontSize: 11, marginTop: 2 }}>{selected ? t('hub.current') : t(module.detailKey)}</Body>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
