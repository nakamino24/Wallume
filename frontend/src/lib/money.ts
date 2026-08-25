/**
 * Centralized Indonesian money formatting — single source of truth.
 * Used by the entire app. No screen should format currency itself.
 *
 * Rules:
 *  - Thousands "." sep, decimal "," only when decimals exist.
 *  - 100 -> 100 | 1000 -> 1.000 | 4200000 -> 4.200.000
 *  - Full: "Rp4.200.000" (no space, no ",00" unless decimals required)
 *  - Compact (analytics/charts only): Rp1,2K | Rp1,5M | Rp4,2B
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', IDR: 'Rp', INR: '₹',
  SGD: 'S$', AUD: 'A$', CAD: 'C$', VND: '₫', CNY: '¥', AED: 'د.إ',
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || code;
}

// Groups an unsigned integer string with "." separators, e.g. "4200000" -> "4.200.000".
function groupThousands(intStr: string): string {
  const s = intStr.replace(/^0+/, '');
  if (s === '') return intStr === '' ? '' : '0'; // empty stays empty; lone "0" stays "0"
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Full formatting: "Rp4.200.000" (decimals omitted unless required).
export function formatMoneyFull(amount: number, currency: string = 'USD', withSymbol = true): string {
  const sym = withSymbol ? currencySymbol(currency) : '';
  const isZeroDecimals = ['IDR', 'JPY', 'KRW', 'VND', 'CLP'].includes(currency);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const fracPart = abs - intPart;
  let decimals = '';
  if (!isZeroDecimals && fracPart > 0.004) {
    decimals = ',' + fracPart.toFixed(2).slice(2); // "0.50" -> "50"
  }
  const intStr = groupThousands(String(intPart));
  return `${sign}${sym}${intStr}${decimals}`;
}

// Compact (analytics/charts only): Rp1,2K | Rp1,5M | Rp4,2B.
export function formatMoneyCompact(amount: number, currency: string = 'USD'): string {
  const sym = currencySymbol(currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${sym}${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${sym}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${sym}${(abs / 1_000).toFixed(1).replace('.', ',')}K`;
  }
  return `${sign}${sym}${Math.round(abs)}`;
}

// Format the digits only (no symbol) — used inside inputs.
export function formatNumberFull(amount: number): string {
  return groupThousands(String(Math.round(Math.abs(amount))));
}

export function getCurrencyFractionDigits(currency: string): number {
  return ['IDR', 'JPY', 'KRW', 'VND', 'CLP'].includes(currency) ? 0 : 2;
}

export function formatMoneyInput(raw: string, currency: string = 'IDR'): string {
  if (!raw) return '';
  const digits = getCurrencyFractionDigits(currency);
  if (digits === 0) return groupThousands(raw.replace(/\D/g, ''));
  const clean = raw.replace(/[^0-9]/g, '');
  if (!clean) return '';
  // For 2-decimal currencies, treat raw as major units with optional decimal comma
  // Keep raw as canonical string (e.g. "25.50"), format display with comma decimal
  if (clean.includes('.') || clean.includes(',')) {
    const normalized = clean.replace(',', '.');
    const parts = normalized.split('.');
    const intPart = groupThousands(parts[0] || '0');
    const frac = (parts[1] || '').slice(0, 2).padEnd(2, '0');
    return `${intPart},${frac}`;
  }
  return groupThousands(clean);
}

export function parseMoneyInput(display: string, currency: string = 'IDR'): number {
  if (!display) return 0;
  const digits = getCurrencyFractionDigits(currency);
  if (digits === 0) return parseFloat(display.replace(/\./g, '').replace(/,/g, '.')) || 0;
  const normalized = display.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

/**
 * Live formatting while typing in an amount input.
 * Takes a raw digit string (already stripped of separators) and returns the
 * formatted display string. Returns the digits separately so the caller can
 * preserve cursor position.
 */
export function formatInputDigits(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  return groupThousands(clean);
}

/** Turn a formatted display string back into a plain digits string. */
export function stripFormatting(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

/**
 * Core edit engine shared by every MoneyInput. Given the new formatted string
 * `text` (as reported by onChangeText), the previous RAW digit value and the
 * raw digit range of the current selection, it returns the next raw value and
 * the caret position in the FORMATTED string.
 *
 * All caret math stays in raw-digit space (with tracking `selStartRaw`/`selEndRaw`),
 * so mid-string inserts, backspace, paste, selection-replace and leading-zero
 * typing always land the caret next to the edited digit — even when separators
 * are inserted.
 */
export function computeInputAmount(
  text: string,
  prevRaw: string,
  selStartRaw: number,
  selEndRaw: number,
): { raw: string; caretFormatted: number; caretRaw: number } {
  const digits = stripFormatting(text);
  const raw = digits.replace(/^0+(?=\d)/, ''); // drop leading zeros, keep lone "0"

  const oldLen = prevRaw.length;
  const removedLen = Math.max(0, selEndRaw - selStartRaw);
  const inserted = digits.length - (oldLen - removedLen); // net digits typed (+/-)
  const caretRaw = Math.max(0, Math.min(digits.length, selStartRaw + inserted));

  // Map the raw caret offset back through the formatted string.
  const prefixDigits = (digits.slice(0, caretRaw) || '').replace(/^0+(?=\d)/, '');
  const caretFormatted = formatInputDigits(prefixDigits).length;
  // Caret offset within the CLEANED raw value (for preserving position next keystroke).
  const caretRawClean = Math.min(raw.length, Math.max(0, caretRaw));
  return { raw, caretFormatted, caretRaw: caretRawClean };
}

/**
 * Guard for use in an onChangeText handler: given the previous plain-digits
 * value and the new (possibly caret-mangled) input, return the correct digits.
 * If appending keeps the string prefix, return as-is; otherwise fall back to
 * the last valid digit sequence.
 */
export function keepCursorDigits(prevDigits: string, rawInput: string): string {
  const rawD = rawInput.replace(/\D/g, '');
  // Deleting a digit shrinks by 1; default to stripping non-digits.
  if (rawD.length <= prevDigits.length) return rawD;
  // Type: found the appended digit, return stripped input.
  return rawD;
}