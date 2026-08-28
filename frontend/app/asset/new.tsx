import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { MoneyInput } from '@/src/components/MoneyInput';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';
import { useI18n } from '@/src/lib/I18nProvider';

const KINDS = ['real_estate', 'vehicle', 'gadget', 'cash', 'receivable', 'other'] as const;

export default function NewAsset() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('real_estate');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('asset.validation.name')); return; }
    const v = parseFloat(value);
    if (!v || v <= 0) { setErr(t('asset.validation.value')); return; }
    setLoading(true);
    try {
      await api.createAsset({ name: name.trim(), kind, value: v });
      router.back();
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingTop: spacing.md }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.close')} hitSlop={10} onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>{t('asset.new.title')}</H2>
          </View>
          <Input testID="asset-name" label={t('common.name')} value={name} onChangeText={setName} placeholder={t('asset.namePlaceholder')} />
          <Label>{t('goal.kind')}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
            {KINDS.map((assetKind) => (
              <Chip key={assetKind} testID={`asset-kind-${assetKind}`} label={t(`asset.kind.${assetKind}`)} active={kind === assetKind} onPress={() => setKind(assetKind)} />
            ))}
          </ScrollView>
          <MoneyInput testID="asset-value" label={t('asset.currentValue')} value={value} onChange={setValue} placeholder="150000" />
          {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
          <Button testID="asset-save" label={t('asset.add')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
