import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';

const KINDS = [
  { id: 'stock', label: 'Stock' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'gold', label: 'Gold' },
  { id: 'mutual_fund', label: 'Mutual Fund' },
  { id: 'etf', label: 'ETF' },
  { id: 'bond', label: 'Bond' },
  { id: 'other', label: 'Other' },
];

export default function NewInvestment() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [kind, setKind] = useState('stock');
  const [qty, setQty] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Enter a name'); return; }
    setLoading(true);
    try {
      await api.createInvestment({
        name: name.trim(),
        ticker: ticker.trim() || undefined,
        kind,
        quantity: parseFloat(qty) || 0,
        avg_cost: parseFloat(avgCost) || 0,
        current_price: parseFloat(price) || 0,
      });
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>New investment</H2>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            <Input testID="inv-name" label="Name" value={name} onChangeText={setName} placeholder="Apple Inc." />
            <Input testID="inv-ticker" label="Ticker (optional)" value={ticker} onChangeText={setTicker} placeholder="AAPL" autoCapitalize="characters" />
            <Label>Kind</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {KINDS.map((k) => (
                <Chip key={k.id} testID={`inv-kind-${k.id}`} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
              ))}
            </ScrollView>
            <Input testID="inv-qty" label="Quantity" keyboardType="decimal-pad" value={qty} onChangeText={setQty} placeholder="10" />
            <Input testID="inv-avg-cost" label="Average cost" keyboardType="decimal-pad" value={avgCost} onChangeText={setAvgCost} placeholder="150" />
            <Input testID="inv-price" label="Current price" keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="180" />
            {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
            <Button testID="inv-save" label="Add investment" onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
