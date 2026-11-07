import { parseCsv, normalizeDate, parseAmount, normalizeStatement } from '@/src/lib/csv';

describe('parseCsv', () => {
  it('splits simple rows and drops blanks', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('handles quoted fields containing commas', () => {
    expect(parseCsv('date,desc\n2026-08-01,"Coffee, large"')).toEqual([
      ['date', 'desc'],
      ['2026-08-01', 'Coffee, large'],
    ]);
  });

  it('handles escaped quotes', () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
  });

  it('normalises CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('normalizeDate', () => {
  it('accepts canonical ISO', () => {
    expect(normalizeDate('2026-08-24')).toBe('2026-08-24');
  });

  it('accepts YYYY/MM/DD', () => {
    expect(normalizeDate('2026/8/4')).toBe('2026-08-04');
  });

  it('accepts DD/MM/YYYY', () => {
    expect(normalizeDate('24/08/2026')).toBe('2026-08-24');
  });

  it('accepts DD-MM-YYYY', () => {
    expect(normalizeDate('24-08-2026')).toBe('2026-08-24');
  });

  it('rejects nonsense', () => {
    expect(normalizeDate('sometime')).toBeNull();
    expect(normalizeDate('')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('parses plain numbers', () => {
    expect(parseAmount('25000')).toBe(25000);
  });

  it('parses Rupiah thousands groups', () => {
    expect(parseAmount('Rp1.500.000')).toBe(1500000);
  });

  it('parses US formatted decimals', () => {
    expect(parseAmount('$1,500.75')).toBe(1500.75);
  });

  it('parses European formatted decimals', () => {
    expect(parseAmount('1.500,75')).toBe(1500.75);
  });

  it('treats parentheses as negative', () => {
    expect(parseAmount('(250.00)')).toBe(-250);
  });

  it('treats a leading minus as negative', () => {
    expect(parseAmount('-25000')).toBe(-25000);
  });

  it('rejects non-numeric', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('normalizeStatement', () => {
  it('maps a headered CSV and keeps direction from a type column', () => {
    const cells = parseCsv(
      'date,amount,description,type\n2026-08-01,25000,Indomaret,debit\n2026-08-02,500000,Employer,credit',
    );
    const { rows, skipped } = normalizeStatement(cells);
    expect(skipped).toEqual([]);
    expect(rows).toEqual([
      { date: '2026-08-01', amount: 25000, type: 'expense', category: undefined, merchant: 'Indomaret', note: '' },
      { date: '2026-08-02', amount: 500000, type: 'income', category: undefined, merchant: 'Employer', note: '' },
    ]);
  });

  it('supports Indonesian header aliases', () => {
    const cells = parseCsv('tanggal,jumlah,keterangan\n01/08/2026,25000,Indomaret');
    const { rows } = normalizeStatement(cells);
    expect(rows[0]).toMatchObject({ date: '2026-08-01', amount: 25000, merchant: 'Indomaret' });
  });

  it('uses the explicit default type when there is no type column', () => {
    const cells = parseCsv('date,amount,description\n2026-08-01,25000,Indomaret');
    expect(normalizeStatement(cells, { defaultType: 'income' }).rows[0].type).toBe('income');
    expect(normalizeStatement(cells, { defaultType: 'expense' }).rows[0].type).toBe('expense');
  });

  it('falls back to the amount sign in auto mode', () => {
    const cells = parseCsv('date,amount,description\n2026-08-01,-25000,Indomaret\n2026-08-02,500000,Employer');
    const { rows } = normalizeStatement(cells, { defaultType: 'auto' });
    expect(rows.map((r) => r.type)).toEqual(['expense', 'income']);
  });

  it('normalises the amount to a positive magnitude', () => {
    const cells = parseCsv('date,amount,description\n2026-08-01,-25000,Indomaret');
    expect(normalizeStatement(cells).rows[0].amount).toBe(25000);
  });

  it('uses positional columns when there is no header', () => {
    const cells = parseCsv('2026-08-01,25000,Indomaret,weekly shop');
    const { rows } = normalizeStatement(cells);
    expect(rows[0]).toMatchObject({ date: '2026-08-01', amount: 25000, merchant: 'Indomaret', note: 'weekly shop' });
  });

  it('suggests a category from the merchant', () => {
    const cells = parseCsv('date,amount,description\n2026-08-01,25000,Gojek');
    const { rows } = normalizeStatement(cells, { suggest: (m) => (m === 'Gojek' ? 'Transportasi' : null) });
    expect(rows[0].category).toBe('Transportasi');
  });

  it('reports rows it cannot parse instead of silently dropping them', () => {
    const cells = parseCsv('date,amount,description\nnot-a-date,25000,X\n2026-08-01,abc,Y\n2026-08-02,10,Z');
    const { rows, skipped } = normalizeStatement(cells);
    expect(rows).toHaveLength(1);
    expect(skipped).toEqual([
      { line: 2, reason: 'invalid_date' },
      { line: 3, reason: 'invalid_amount' },
    ]);
  });
});
