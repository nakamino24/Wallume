import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Body } from '@/src/components/ui';
import { MoneyValue } from '@/src/components/MoneyValue';
import { useTheme } from '@/src/theme/ThemeProvider';
import { font, radius, spacing } from '@/src/theme/tokens';
import { getLocale } from '@/src/lib/i18n';

const CAT_ICON: Record<string, any> = {
  Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle', Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
  Rent: 'home', Salary: 'cash', Groceries: 'basket', Other: 'ellipsis-horizontal', Freelance: 'laptop', Investment: 'trending-up', Business: 'briefcase', Gift: 'gift',
};

export type TransactionDayGroupData = { key: string; date: Date; transactions: any[] };

function parseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(`${value}T00:00:00`) : new Date(value);
}

export function groupTransactionsByDate(transactions: any[]): TransactionDayGroupData[] {
  const groups: TransactionDayGroupData[] = [];
  for (const transaction of transactions) {
    const key = (transaction.date || '').split('T')[0] || 'unknown';
    const previous = groups[groups.length - 1];
    if (previous?.key === key) previous.transactions.push(transaction);
    else groups.push({ key, date: parseDate(transaction.date), transactions: [transaction] });
  }
  return groups;
}

export function transactionDayLabel(date: Date, locale?: string) {
  const today = new Date();
  const todayKey = [today.getFullYear(), today.getMonth(), today.getDate()].join('-');
  const dateKey = [date.getFullYear(), date.getMonth(), date.getDate()].join('-');
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = [yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()].join('-');
  if (dateKey === todayKey) return locale?.startsWith('id') ? 'Hari ini' : 'Today';
  if (dateKey === yesterdayKey) return locale?.startsWith('id') ? 'Kemarin' : 'Yesterday';
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
}

export function transactionCalendarLabel(date: Date, locale?: string) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function TransactionDayGroup({ group, currency, onOpen, onRemove }: { group: TransactionDayGroupData; currency: string; onOpen: (transaction: any) => void; onRemove: (transaction: any) => void }) {
  const { colors } = useTheme();
  const locale = getLocale();
  return (
    <View testID={`transaction-day-${group.key}`} style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: spacing.xs }}>
        <Body style={{ fontFamily: font.textMedium }}>{transactionDayLabel(group.date, locale)}</Body>
        <Body muted style={{ fontSize: 12 }}>{transactionCalendarLabel(group.date, locale)}</Body>
      </View>
      <View style={{ overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}>
        {group.transactions.map((transaction, index) => <TransactionRow key={transaction.id} transaction={transaction} currency={currency} isLast={index === group.transactions.length - 1} onOpen={() => onOpen(transaction)} onRemove={() => onRemove(transaction)} />)}
      </View>
    </View>
  );
}

function TransactionRow({ transaction, currency, isLast, onOpen, onRemove }: { transaction: any; currency: string; isLast: boolean; onOpen: () => void; onRemove: () => void }) {
  const { colors } = useTheme();
  const positive = transaction.type === 'income';
  const negative = transaction.type === 'expense';
  const color = positive ? colors.success : negative ? colors.error : colors.brandPrimary;
  const date = parseDate(transaction.date);
  const time = transaction.date?.includes('T') ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date) : '';
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} onLongPress={onRemove} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: spacing.md, opacity: pressed ? 0.82 : 1, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border })}>
      <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={transaction.type === 'transfer' ? 'swap-horizontal' : (CAT_ICON[transaction.category] || 'ellipsis-horizontal')} size={18} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
        <Body numberOfLines={1} style={{ fontFamily: font.textMedium }}>{transaction.category}</Body>
        <Body numberOfLines={1} muted style={{ fontSize: 12, marginTop: 1 }}>{transaction.note || time || transaction.wallet_name || 'Transaction'}</Body>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <MoneyValue
          value={positive ? transaction.amount : negative ? -Math.abs(transaction.amount) : transaction.amount}
          currency={currency}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{ color, fontFamily: font.textBold, fontSize: 14 }}
        />
        {!!time && <Body muted style={{ fontSize: 11, marginTop: 1 }}>{time}</Body>}
      </View>
    </Pressable>
  );
}
