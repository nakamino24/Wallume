import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import { api } from '@/src/api/client';
import { Body, Label, Button, Input, Chip } from '@/src/components/ui';
import { DateField } from '@/src/components/DateField';
import { FormLayout } from '@/src/components/FormLayout';
import { MoneyInput } from '@/src/components/MoneyInput';
import { INVESTMENT_KINDS, isQtyKind, QTY_KIND_FIELDS, InvKind } from '@/src/lib/investmentKinds';
import { useI18n } from '@/src/lib/I18nProvider';

// Handles both "add new investment" and "edit investment". When editing, the
// detail screen passes the existing fields in as route params (id is present).
export default function InvestmentForm() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
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

  const qtyFields = QTY_KIND_FIELDS[kind];
  const localizedQtyFields = kind === 'mutual_fund'
    ? { quantity: t('investment.quantity.units', { value: '' }).trim(), avgCost: t('investment.averageNav'), price: t('investment.currentNav') }
    : kind === 'gold'
      ? { quantity: t('investment.weightGram'), avgCost: t('investment.avgPriceGram'), price: t('investment.currentPriceGram') }
      : kind === 'crypto'
        ? { quantity: t('investment.amount'), avgCost: t('investment.avgCost'), price: t('investment.currentPrice') }
        : { quantity: t('investment.quantity.shares', { value: '' }).trim(), avgCost: t('investment.avgCost'), price: t('investment.currentPrice') };

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('investment.validation.name')); return; }

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
      if (!pp) { setErr(t('investment.validation.purchasePrice')); return; }
      body = {
        ...body,
        face_value: fv, coupon_rate: cr, purchase_price: pp, current_value: cv,
        // mirrored so totals elsewhere (net worth, etc.) keep working unchanged
        quantity: 1, avg_cost: pp, current_price: cv,
      };
    } else if (kind === 'cash') {
      const amt = parseFloat(cashAmount) || 0;
      if (!amt) { setErr(t('investment.validation.amount')); return; }
      body = { ...body, quantity: 1, avg_cost: amt, current_price: amt };
    } else {
      const q = parseFloat(qty) || 0;
      if (!q) { setErr(t('investment.validation.quantity', { quantity: localizedQtyFields.quantity.toLowerCase() })); return; }
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
    } catch { setErr(t('common.error')); }
    finally { setLoading(false); }
  };

  return (
    <FormLayout title={t(isEdit ? 'investment.edit' : 'investment.new.title')} onBack={() => router.back()}>
      <Input testID="inv-name" label={t('common.name')} value={name} onChangeText={setName} placeholder={t('investment.namePlaceholder')} />
      {kind !== 'bond' && kind !== 'cash' && (
        <Input testID="inv-ticker" label={t('investment.tickerOptional')} value={ticker} onChangeText={setTicker} placeholder="AAPL" autoCapitalize="characters" />
      )}

      <Label>{t('investment.category')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        {INVESTMENT_KINDS.map((k) => (
          <Chip key={k.id} testID={`inv-kind-${k.id}`} label={t(`investment.kind.${k.id}`)} active={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </ScrollView>

      {/* --- Dynamic fields based on category --- */}
      {kind === 'bond' && (
        <>
          <MoneyInput testID="inv-face-value" label={t('investment.faceValue')} value={faceValue} onChange={setFaceValue} placeholder="10000000" />
          <Input testID="inv-coupon-rate" label={t('investment.couponRate')} keyboardType="decimal-pad" value={couponRate} onChangeText={setCouponRate} placeholder="6.5" />
          <MoneyInput testID="inv-purchase-price" label={t('investment.purchasePrice')} value={purchasePrice} onChange={setPurchasePrice} placeholder="9800000" />
          <MoneyInput testID="inv-current-value" label={t('investment.currentValue')} value={currentValue} onChange={setCurrentValue} placeholder="10100000" />
        </>
      )}

      {kind === 'cash' && (
        <MoneyInput testID="inv-cash-amount" label={t('investment.amount')} value={cashAmount} onChange={setCashAmount} placeholder="5000000" />
      )}

      {isQtyKind(kind) && qtyFields && (
        <>
          <Input testID="inv-qty" label={localizedQtyFields.quantity} keyboardType="decimal-pad" value={qty} onChangeText={setQty} placeholder={qtyFields.quantityPlaceholder} />
          <MoneyInput testID="inv-avg-cost" label={localizedQtyFields.avgCost} value={avgCost} onChange={setAvgCost} placeholder="150" />
          <MoneyInput testID="inv-price" label={localizedQtyFields.price} value={price} onChange={setPrice} placeholder="180" />
        </>
      )}

      {/* --- Supporting info, all kinds --- */}
      <Input testID="inv-broker" label={t('investment.brokerOptional')} value={broker} onChangeText={setBroker} placeholder="Bibit, Ajaib, Stockbit…" />
      <DateField testID="inv-purchase-date" label={t('investment.purchaseDateOptional')} value={purchaseDate} onChange={setPurchaseDate} />
      <Input testID="inv-notes" label={t('investment.notesOptional')} value={notes} onChangeText={setNotes} placeholder={t('investment.notesPlaceholder')} />

      {!!err && <Body style={{ color: colors.error }}>{err}</Body>}
      <Button testID="inv-save" label={t(isEdit ? 'transaction.saveChanges' : 'investment.add')} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
    </FormLayout>
  );
}
