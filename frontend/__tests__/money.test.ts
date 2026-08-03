import {
  formatMoneyFull,
  formatMoneyCompact,
  formatInputDigits,
  stripFormatting,
  keepCursorDigits,
} from '@/src/lib/money';

describe('formatMoneyFull (Indonesian)', () => {
  it('formats the spec examples', () => {
    expect(formatMoneyFull(100, 'IDR')).toBe('Rp100');
    expect(formatMoneyFull(999, 'IDR')).toBe('Rp999');
    expect(formatMoneyFull(1000, 'IDR')).toBe('Rp1.000');
    expect(formatMoneyFull(15000, 'IDR')).toBe('Rp15.000');
    expect(formatMoneyFull(4200000, 'IDR')).toBe('Rp4.200.000');
    expect(formatMoneyFull(100000000, 'IDR')).toBe('Rp100.000.000');
  });

  it('adds symbol and never uses comma separators', () => {
    const out = formatMoneyFull(4200000, 'IDR');
    expect(out).not.toContain(',');
    expect(out).toMatch(/^Rp/);
  });

  it('shows decimals only when required (non-IDR)', () => {
    expect(formatMoneyFull(1234.5, 'USD')).toBe('$1.234,50');
    expect(formatMoneyFull(42, 'USD')).toBe('$42');
  });
});

describe('formatMoneyCompact (analytics only)', () => {
  it('formats K/M/B', () => {
    expect(formatMoneyCompact(1200, 'IDR')).toBe('Rp1,2K');
    expect(formatMoneyCompact(1500000, 'IDR')).toBe('Rp1,5M');
    expect(formatMoneyCompact(4200000000, 'IDR')).toBe('Rp4,2B');
  });
});

describe('live input formatting', () => {
  it('formats digits as the user types', () => {
    expect(formatInputDigits('1')).toBe('1');
    expect(formatInputDigits('12')).toBe('12');
    expect(formatInputDigits('123')).toBe('123');
    expect(formatInputDigits('1234')).toBe('1.234');
    expect(formatInputDigits('12345')).toBe('12.345');
    expect(formatInputDigits('123456')).toBe('123.456');
  });

  it('strips formatting back to digits', () => {
    expect(stripFormatting('12.345')).toBe('12345');
    expect(stripFormatting('4.200.000')).toBe('4200000');
  });

  it('keeps digits when typing / deleting', () => {
    // typing appends
    expect(keepCursorDigits('1234', '12345')).toBe('12345');
    // deleting shrinks
    expect(keepCursorDigits('1234', '123')).toBe('123');
    // wiping the field
    expect(keepCursorDigits('1234', '')).toBe('');
  });
});

describe('MoneyInput cursor/formatting edge cases (raw digit layer)', () => {
  // Backspace chain: 1.234.567 -> 123.456 -> 12.345 -> ...
  it('deletes digit-by-digit correctly through formatted groups', () => {
    expect(formatInputDigits('1234567')).toBe('1.234.567');
    expect(formatInputDigits('123456')).toBe('123.456');
    expect(formatInputDigits('12345')).toBe('12.345');
    expect(formatInputDigits('1234')).toBe('1.234');
    expect(formatInputDigits('123')).toBe('123');
    expect(formatInputDigits('12')).toBe('12');
    expect(formatInputDigits('1')).toBe('1');
    expect(formatInputDigits('')).toBe('');
  });

  // Leading zeros are dropped; empty stays empty.
  it('drops leading zeros and keeps empty input empty', () => {
    expect(stripFormatting('0')).toBe('0');
    expect(stripFormatting('007')).toBe('007'); // digits layer keeps, formatting layer handles
    expect(formatInputDigits('007')).toBe('7'); // formatted layer strips leading zeros
    expect(formatInputDigits('')).toBe('');
  });

  // Typing chain from the spec.
  it('formats the typing chain 1..1234567', () => {
    let digits = '';
    const seq = ['1', '12', '123', '1234', '12345', '1234567'];
    for (const d of seq) {
      digits = stripFormatting(d);
      expect(formatInputDigits(digits)).toBe(d.length < 4 ? d : formatInputDigits(d));
    }
    expect(formatInputDigits('1')).toBe('1');
    expect(formatInputDigits('12')).toBe('12');
    expect(formatInputDigits('123')).toBe('123');
    expect(formatInputDigits('1234')).toBe('1.234');
    expect(formatInputDigits('12345')).toBe('12.345');
    expect(formatInputDigits('1234567')).toBe('1.234.567');
  });
});