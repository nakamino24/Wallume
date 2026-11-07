// Split allocation logic — pure so the arithmetic is testable without a
// renderer. The invariant that matters: parts must always sum to the total,
// because the backend rejects a mismatch and the wallet is debited once.

export type SplitPart = {
  /** Stable key for React lists. */
  key: string;
  category: string;
  /** Raw digit string, matching how MoneyInput works elsewhere. */
  amount: string;
};

export type SplitTotal = {
  /** Sum of the parsed parts, rounded to 2dp. */
  sum: number;
  /** Total minus sum. Positive means under-allocated. */
  remaining: number;
  /** True when the parts exactly match the total (within a cent). */
  balanced: boolean;
  /** True when any part is zero, negative or unparseable. */
  hasInvalid: boolean;
};

export function parseSplitAmount(raw: string): number {
  const value = Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(value) ? value : NaN;
}

export function summarizeSplits(parts: SplitPart[], total: number): SplitTotal {
  let sum = 0;
  let hasInvalid = false;
  for (const part of parts) {
    const value = parseSplitAmount(part.amount);
    if (!Number.isFinite(value) || value <= 0) {
      hasInvalid = true;
      continue;
    }
    sum += value;
  }
  sum = Math.round(sum * 100) / 100;
  const remaining = Math.round((total - sum) * 100) / 100;
  return {
    sum,
    remaining,
    // A one-cent tolerance absorbs float noise without allowing a real gap.
    balanced: parts.length >= 2 && !hasInvalid && Math.abs(remaining) < 0.005,
    hasInvalid,
  };
}

/**
 * Distribute `total` across `count` parts as evenly as possible, giving the
 * remainder cents to the first parts. Used by "split evenly".
 */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) =>
    (base + (index < remainder ? 1 : 0)) / 100);
}

/** Fill parts so they sum to the total, keeping existing values where set. */
export function rebalanceParts(parts: SplitPart[], total: number): SplitPart[] {
  if (parts.length === 0) return parts;
  const values = parts.map((p) => {
    const v = parseSplitAmount(p.amount);
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const current = Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
  const gap = Math.round((total - current) * 100) / 100;
  if (Math.abs(gap) < 0.005) return parts;
  // Apply the whole difference to the last part so the others stay untouched.
  values[values.length - 1] = Math.max(0, Math.round((values[values.length - 1] + gap) * 100) / 100);
  return parts.map((part, index) => ({ ...part, amount: values[index] ? String(values[index]) : '' }));
}
