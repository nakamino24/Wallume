import {
  formatMoneyFull,
  formatMoneyCompact,
  formatInputDigits,
  stripFormatting,
  keepCursorDigits,
  computeInputAmount,
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

describe('computeInputAmount — caret scenarios from the transaction UX spec', () => {
  // Scenario 1: type digits left-to-right; caret stays after the last typed digit.
  it('types left-to-right with caret after the last digit', () => {
    let raw = '';
    let sel = { start: 0, end: 0 };
    const typed = ['1', '12', '123', '1234'];
    for (const text of typed) {
      const { raw: next, caretFormatted, caretRaw } = computeInputAmount(text, raw, sel.start, sel.end);
      raw = next;
      sel = { start: caretRaw, end: caretRaw };
    }
    expect(raw).toBe('1234');
    expect(formatInputDigits(raw)).toBe('1.234');
    // caret (raw) sits at the end of the digits
    expect(sel.start).toBe(4);
  });

  // Scenario 2: backspace repeatedly from 1234567; shrinks one digit, caret at end.
  it('backspace shrinks one digit at a time with caret at end', () => {
    const seq = ['123456', '12345', '1234', '123', '12', '1'];
    let raw = '1234567';
    let caret = 7;
    for (const text of seq) {
      const r = computeInputAmount(text, raw, caret, caret);
      raw = r.raw;
      caret = r.caretRaw;
    }
    expect(raw).toBe('1');
    expect(caret).toBe(1);
  });

  // Scenario 3: insert mid-string; caret ends up right after the inserted digit.
  it('inserts mid-string and keeps caret after the inserted digit', () => {
    // raw 1234567 -> 12349567, insert '9' after 4th digit (raw index 4)
    const { raw, caretRaw, caretFormatted } = computeInputAmount('12349567', '1234567', 4, 4);
    expect(raw).toBe('12349567');
    expect(formatInputDigits(raw)).toBe('12.349.567');
    // caret right after the inserted '9' (raw index 5)
    expect(caretRaw).toBe(5);
    expect(caretFormatted).toBe(formatInputDigits('12349').length);
  });

  // Scenario 4: replace a selected run; caret sits right after the replacement.
  it('replaces a selected run and keeps caret after the replacement', () => {
    // raw "1234567", select digits 3..5 ("345"), replace with '9' -> "12967"
    const { raw, caretRaw } = computeInputAmount('12967', '1234567', 2, 5);
    expect(raw).toBe('12967');
    // inserted at raw index 2, one digit typed -> caret at 3
    expect(caretRaw).toBe(3);
  });

  // Scenario 5: paste into empty field; caret lands at end.
  it('pastes digits into an empty field and lands caret at the end', () => {
    const { raw, caretRaw, caretFormatted } = computeInputAmount('50.000', '', 0, 0);
    expect(raw).toBe('50000');
    expect(formatInputDigits(raw)).toBe('50.000');
    expect(caretRaw).toBe(5);
    expect(caretFormatted).toBe('50.000'.length);
  });

  // Scenario 6: leading zeros are dropped.
  it('drops chained leading zeros when typing as the next digit', () => {
    const first = computeInputAmount('0', '', 0, 0);
    const second = computeInputAmount('0', first.raw, 0, 0);
    const third = computeInputAmount('5', second.raw, 0, 0);
    expect(third.raw).toBe('5');
  });

  // Scenario 7: clearing the field stays empty (does not reset to "0").
  it('clearing the field stays empty', () => {
    const { raw, caretRaw } = computeInputAmount('', '12345', 0, 5);
    expect(raw).toBe('');
    expect(caretRaw).toBe(0);
  });
});