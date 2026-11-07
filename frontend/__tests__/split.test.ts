import { summarizeSplits, splitEvenly, rebalanceParts, parseSplitAmount } from '@/src/lib/split';

const part = (key: string, amount: string, category = 'Food') => ({ key, category, amount });

describe('parseSplitAmount', () => {
  it('parses plain digits', () => {
    expect(parseSplitAmount('25000')).toBe(25000);
  });

  it('tolerates formatted separators', () => {
    expect(parseSplitAmount('1.500')).toBe(1.5);
  });

  it('strips non-numeric characters entirely', () => {
    // 'abc' has no digits, so it cleans to '' and parses as 0. summarizeSplits
    // then rejects it (<= 0) rather than letting it count as an allocation.
    expect(parseSplitAmount('abc')).toBe(0);
  });

  it('treats an empty string as zero, not NaN', () => {
    // Number('') is 0; summarizeSplits then flags it as invalid (<= 0).
    expect(parseSplitAmount('')).toBe(0);
  });
});

describe('summarizeSplits', () => {
  it('is balanced when parts equal the total', () => {
    const result = summarizeSplits([part('a', '60'), part('b', '40')], 100);
    expect(result.sum).toBe(100);
    expect(result.remaining).toBe(0);
    expect(result.balanced).toBe(true);
  });

  it('reports what is left when under-allocated', () => {
    const result = summarizeSplits([part('a', '60'), part('b', '20')], 100);
    expect(result.remaining).toBe(20);
    expect(result.balanced).toBe(false);
  });

  it('reports an over-allocation as a negative remainder', () => {
    const result = summarizeSplits([part('a', '80'), part('b', '40')], 100);
    expect(result.remaining).toBe(-20);
    expect(result.balanced).toBe(false);
  });

  it('is not balanced with a single part even if the amount matches', () => {
    expect(summarizeSplits([part('a', '100')], 100).balanced).toBe(false);
  });

  it('flags zero and blank parts as invalid', () => {
    const result = summarizeSplits([part('a', '100'), part('b', '')], 100);
    expect(result.hasInvalid).toBe(true);
    expect(result.balanced).toBe(false);
  });

  it('absorbs floating point noise within a cent', () => {
    const result = summarizeSplits([part('a', '0.1'), part('b', '0.2')], 0.3);
    expect(result.balanced).toBe(true);
  });

  it('does not treat a real one-cent gap as balanced', () => {
    expect(summarizeSplits([part('a', '50'), part('b', '49.99')], 100).balanced).toBe(false);
  });
});

describe('splitEvenly', () => {
  it('divides without losing cents', () => {
    const shares = splitEvenly(100, 3);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  it('gives remainder cents to the first parts', () => {
    expect(splitEvenly(0.05, 3)).toEqual([0.02, 0.02, 0.01]);
  });

  it('handles an uneven total', () => {
    expect(splitEvenly(10, 4)).toEqual([2.5, 2.5, 2.5, 2.5]);
  });

  it('returns nothing for a zero count', () => {
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});

describe('rebalanceParts', () => {
  it('fills the remainder into the last part', () => {
    const result = rebalanceParts([part('a', '60'), part('b', '20')], 100);
    expect(result[1].amount).toBe('40');
    expect(result[0].amount).toBe('60');
  });

  it('leaves already-balanced parts untouched', () => {
    const parts = [part('a', '60'), part('b', '40')];
    expect(rebalanceParts(parts, 100)).toBe(parts);
  });

  it('reduces the last part when over-allocated', () => {
    const result = rebalanceParts([part('a', '60'), part('b', '60')], 100);
    expect(result[1].amount).toBe('40');
  });

  it('never produces a negative last part', () => {
    const result = rebalanceParts([part('a', '150'), part('b', '10')], 100);
    expect(Number(result[1].amount)).toBeGreaterThanOrEqual(0);
  });
});
