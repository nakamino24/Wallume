import React, { useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Screen, H2, Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { INVESTMENT_KINDS, isQtyKind, QTY_KIND_FIELDS, InvKind } from '@/src/lib/investmentKinds';

// Handles both "add new investment" and "edit investment". When editing, the
// detail screen passes the existing fields in as route params (id is present).
export default function InvestmentForm() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const isEdit = !!params.id;

  const [name, setName] = useState(params.name || '');
  const [ticker, setTicker] = useState(params.ticker || '');
  const [kind, setKind] = useState<InvKind>((params.kind as InvKind) || 'stock');

  // qty-style fields (stock/etf/mutual_fund/crypto/gold)
  const [qty, setQty] = useState(params.quantity || '');
  const [avgCost, setAvgCost] = useState(params.avg_cost || '');
  const [price, setPrice] = useState(params.current_price || '');

  // bond-specific fields
  const [faceValue, setFaceValue] = useState(params.face_value || '');
  const [couponRate, setCouponRate] = useState(params.coupon_rate || '');
  const [purchasePrice, setPurchasePrice] = useState(params.purchase_price || '');
  const [currentValue, setCurrentValue] = useState(params.current_value || '');

  // cash-specific
  const [cashAmount, setCashAmount] = useState(params.current_price || '');

  // supporting info (all kinds)
  const [broker, setBroker] = useState(params.broker || '');
  const [purchaseDate, setPurchaseDate] = useState(params.purchase_date || '');
  const [notes, setNotes] = useState(params.notes || '');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const qtyFields = QTY_KIND_FIELDS[kind];

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Enter a name'); return; }

    let body: any = {
      name: name.trim(),
      ticker: ticker.trim() || undefined,
      kind,
      broker: broker.trim() || undefined,
      purchase_date: purchaseDate.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (kind === 'bond') {
      const fv = parseFloat(faceValue) || 0;
      const cr = parseFloat(couponRate) || 0;
      const pp = parseFloat(purchasePrice) || 0;
      const cv = parseFloat(currentValue) || pp;
      if (!pp) { setErr('Enter a purchase price'); return; }
      body = {
        ...body,
        face_value: fv, coupon_rate: cr, purchase_price: pp, current_value: cv,
        // mirrored so totals elsewhere (net worth, etc.) keep working unchanged
        quantity: 1, avg_cost: pp, current_price: cv,
      };
    } else if (kind === 'cash') {
      const amt = parseFloat(cashAmount) || 0;
      if (!amt) { setErr('Enter an amount'); return; }
      body = { ...body, quantity: 1, avg_cost: amt, current_price: amt };
    } else {
      const q = parseFloat(qty) || 0;
      if (!q) { setErr(`Enter ${qtyFields?.quantityLabel.toLowerCase() || 'a quantity'}`); return; }
      body = {
        ...body,
        quantity: q,
        avg_cost: parseFloat(avgCost) || 0,
        current_price: parseFloat(price) || 0,
      };
    }

    setLoading(true);
    try {
      if (isEdit) await api.updateInvestment(params.id, body);
      else await api.createInvestment(body);
      router.back();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <TouchableOpacity testID="inv-back" onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: spacing.md }}>{isEdit ? 'Edit investment' : 'New investment'}</H2>
          </View>
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Input testID="inv-name" label="Name" value={name} onChangeText={setName} placeholder="Apple Inc." />
            {kind !== 'bond' && kind !== 'cash' && (
              <Input testID="inv-ticker" label="Ticker (optional)" value={ticker} onChangeText={setTicker} placeholder="AAPL" autoCapitalize="characters" />
            )}

            <Label>Category</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {INVESTMENT_KINDS.map((k) => (
                <Chip key={k.id} testID={`inv-kind-${k.id}`} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
              ))}
            </ScrollView>

            {/* --- Dynamic fields based on category --- */}
            {kind === 'bond' && (
              <>
                <Input testID="inv-face-value" label="Face Value" keyboardType="decimal-pad" value={faceValue} onChangeText={setFaceValue} placeholder="10000000" />
                <Input testID="inv-coupon-rate" label="Coupon Rate (%)" keyboardType="decimal-pad" value={couponRate} onChangeText={setCouponRate} placeholder="6.5" />
                <Input testID="inv-purchase-price" label="Purchase Price" keyboardType="decimal-pad" value={purchasePrice} onChangeText={setPurchasePrice} placeholder="9800000" />
                <Input testID="inv-current-value" label="Current Value" keyboardType="decimal-pad" value={currentValue} onChangeText={setCurrentValue} placeholder="10100000" />
              </>
            )}

            {kind === 'cash' && (
              <Input testID="inv-cash-amount" label="Amount" keyboardType="decimal-pad" value={cashAmount} onChangeText={setCashAmount} placeholder="5000000" />
            )}

            {isQtyKind(kind) && qtyFields && (
              <>
                <Input testID="inv-qty" label={qtyFields.quantityLabel} keyboardType="decimal-pad" value={qty} onChangeText={setQty} placeholder={qtyFields.quantityPlaceholder} />
                <Input testID="inv-avg-cost" label={qtyFields.avgCostLabel} keyboardType="decimal-pad" value={avgCost} onChangeText={setAvgCost} placeholder="150" />
                <Input testID="inv-price" label={qtyFields.priceLabel} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="180" />
              </>
            )}

            {/* --- Supporting info, all kinds --- */}
            <Input testID="inv-broker" label="Broker / Platform (optional)" value={broker} onChangeText={setBroker} placeholder="Bibit, Ajaib, Stockbit…" />
            <Input testID="inv-purchase-date" label="Purchase date (optional)" value={purchaseDate} onChangeText={setPurchaseDate} placeholder="YYYY-MM-DD" />
            <Input testID="inv-notes" label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Why you bought this…"
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)} />

            {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
            <Button testID="inv-save" label={isEdit ? 'Save changes' : 'Add investment'} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
