import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { KeyboardAwareContainer } from '@/src/components/KeyboardAwareContainer';

const KINDS = [
  { id: 'real_estate', label: 'Real Estate' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'gadget', label: 'Gadget' },
  { id: 'cash', label: 'Cash' },
  { id: 'receivable', label: 'Receivable' },
  { id: 'other', label: 'Other' },
];

export default function NewAsset() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('real_estate');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Enter a name'); return; }
    const v = parseFloat(value);
    if (!v || v <= 0) { setErr('Enter a value'); return; }
    setLoading(true);
    try {
      await api.createAsset({ name: name.trim(), kind, value: v });
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>New asset</H2>
          </View>
          <Input testID="asset-name" label="Name" value={name} onChangeText={setName} placeholder="Condo, MacBook, Rolex…" />
          <Label>Kind</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
            {KINDS.map((k) => (
              <Chip key={k.id} testID={`asset-kind-${k.id}`} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
            ))}
          </ScrollView>
          <Input testID="asset-value" label="Current value" keyboardType="decimal-pad" value={value} onChangeText={setValue} placeholder="150000" />
          {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
          <Button testID="asset-save" label="Add asset" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
        </KeyboardAwareContainer>
      </SafeAreaView>
    </Screen>
  );
}
