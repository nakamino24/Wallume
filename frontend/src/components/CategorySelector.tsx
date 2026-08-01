import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius } from '@/src/theme/tokens';
import { Chip, Label } from '@/src/components/ui';
import { QuickAddCategoryModal } from '@/src/components/QuickAddCategoryModal';
import { useUserCategories } from '@/src/hooks/use-user-categories';

export function CategorySelector({
  type, value, onChange, testID,
}: {
  type: 'income' | 'expense' | 'transfer';
  value: string;
  onChange: (label: string) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const { getOptions, reload } = useUserCategories();
  const [modalVisible, setModalVisible] = useState(false);
  const options = type === 'transfer' ? ['Transfer'] : getOptions(type);
  const catType = type === 'transfer' ? 'expense' : type;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Category</Label>
        <TouchableOpacity testID={`${testID || 'category'}-quick-add`} onPress={() => setModalVisible(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}>
          <Ionicons name="add-circle" size={18} color={colors.brandPrimary} />
          <Label style={{ color: colors.brandPrimary }}>Add</Label>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {options.map((c) => (
          <Chip key={c} testID={`${testID ? `${testID}-` : ''}cat-${c}`} label={c} active={value === c} onPress={() => onChange(c)} />
        ))}
      </ScrollView>

      <QuickAddCategoryModal
        visible={modalVisible}
        defaultType={catType}
        onClose={() => setModalVisible(false)}
        onCreated={(cat) => {
          onChange(cat.label);
          reload();
        }}
      />
    </>
  );
}