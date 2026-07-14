// Central place that defines how each investment/asset category behaves in the UI:
// what to call its fields (Shares vs Units vs Weight...), and how to compute
// value / cost / profit-loss / return% so the user never has to do that math.

export type InvKind = 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'gold' | 'cash' | 'other';

export const INVESTMENT_KINDS: { id: InvKind; label: string }[] = [
  { id: 'stock', label: 'Stock' },
  { id: 'etf', label: 'ETF' },
  { id: 'mutual_fund', label: 'Mutual Fund' },
  { id: 'bond', label: 'Bond' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'gold', label: 'Gold' },
  { id: 'cash', label: 'Cash' },
];

// Simple "quantity x price" kinds (stock/etf/mutual_fund/crypto/gold) share the
// same shape but with different vocabulary. Bond and cash are handled specially.
export const QTY_KIND_FIELDS: Partial<Record<InvKind, {
  quantityLabel: string;
  quantityUnit: string;
  quantityPlaceholder: string;
  avgCostLabel: string;
  priceLabel: string;
}>> = {
  stock: { quantityLabel: 'Shares', quantityUnit: 'shares', quantityPlaceholder: '10', avgCostLabel: 'Average Cost', priceLabel: 'Current Price' },
  etf: { quantityLabel: 'Shares', quantityUnit: 'shares', quantityPlaceholder: '10', avgCostLabel: 'Average Cost', priceLabel: 'Current Price' },
  mutual_fund: { quantityLabel: 'Units', quantityUnit: 'units', quantityPlaceholder: '1000', avgCostLabel: 'Average NAV', priceLabel: 'Current NAV' },
  crypto: { quantityLabel: 'Amount', quantityUnit: 'coins', quantityPlaceholder: '0.5', avgCostLabel: 'Average Cost', priceLabel: 'Current Price' },
  gold: { quantityLabel: 'Weight (gram)', quantityUnit: 'g', quantityPlaceholder: '10', avgCostLabel: 'Avg Price / gram', priceLabel: 'Current Price / gram' },
};

export function isQtyKind(kind: InvKind) {
  return kind in QTY_KIND_FIELDS;
}

export type InvestmentDoc = {
  id?: string;
  name: string;
  ticker?: string;
  kind: InvKind;
  quantity?: number;
  avg_cost?: number;
  current_price?: number;
  face_value?: number;
  coupon_rate?: number;
  purchase_price?: number;
  current_value?: number;
  broker?: string;
  purchase_date?: string;
  notes?: string;
};

export type InvMetrics = {
  value: number;      // current market value
  cost: number;        // total amount paid in
  pl: number;           // unrealized gain/loss
  returnPct: number;    // % return
};

// The single source of truth for "how much is this worth / what did it cost".
// Every screen (list, detail, dashboard) should call this instead of computing inline.
export function computeInvestmentMetrics(iv: InvestmentDoc): InvMetrics {
  if (iv.kind === 'bond') {
    const cost = iv.purchase_price ?? 0;
    const value = iv.current_value ?? cost;
    const pl = value - cost;
    return { value, cost, pl, returnPct: cost > 0 ? (pl / cost) * 100 : 0 };
  }
  if (iv.kind === 'cash') {
    const value = iv.current_price ?? 0;
    return { value, cost: value, pl: 0, returnPct: 0 };
  }
  const qty = iv.quantity || 0;
  const value = qty * (iv.current_price || 0);
  const cost = qty * (iv.avg_cost || 0);
  const pl = value - cost;
  return { value, cost, pl, returnPct: cost > 0 ? (pl / cost) * 100 : 0 };
}

// Short line for list rows, e.g. "10 shares", "5.2 g", "Bond", "Cash".
export function quantitySummary(iv: InvestmentDoc): string {
  if (iv.kind === 'bond') return 'Bond';
  if (iv.kind === 'cash') return 'Cash';
  const f = QTY_KIND_FIELDS[iv.kind];
  if (!f) return '';
  const qty = iv.quantity || 0;
  return `${qty} ${f.quantityUnit}`;
}

export function kindLabel(kind: InvKind): string {
  return INVESTMENT_KINDS.find((k) => k.id === kind)?.label || kind;
}
