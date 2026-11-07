// Parsing for pasted bank-statement CSV.
//
// The app deliberately parses on-device: the export screen promises "nothing
// is uploaded", and the same trust story should hold for imports. Only the
// normalised rows are sent to the server.

export type ImportRow = {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  merchant: string;
  note: string;
};

export type NormalizeResult = {
  rows: ImportRow[];
  skipped: { line: number; reason: string }[];
};

/**
 * RFC-4180-ish CSV parse: quoted fields, escaped quotes (""), and embedded
 * commas/newlines. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === ',') { row.push(field); field = ''; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += char;
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const pad = (n: string) => n.padStart(2, '0');

/**
 * Accepts YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY and DD-MM-YYYY.
 * Day-first is assumed for slash/dash dates because the app's primary audience
 * is Indonesian; unambiguous ISO is preferred when available.
 */
export function normalizeDate(raw: string): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  let m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(value);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;

  // Fall back to Date for ISO datetimes ("2026-08-24T10:00:00Z").
  if (value.includes('T')) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad(String(d.getMonth() + 1))}-${pad(String(d.getDate()))}`;
    }
  }
  return null;
}

/**
 * Parse a money cell. Handles "Rp1.500.000", "$1,500.00", "1.500,00",
 * "(250.00)" for negatives, and a leading minus.
 */
export function parseAmount(raw: string): number | null {
  let value = (raw || '').trim();
  if (!value) return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) { negative = true; value = value.slice(1, -1); }
  value = value.trim();
  if (value.startsWith('-')) { negative = true; value = value.slice(1); }

  value = value.replace(/[^\d.,]/g, '');
  if (!value) return null;

  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    value = value.split(thousandSep).join('');
    if (decimalSep === ',') value = value.replace(',', '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = value.split(sep);
    const tail = parts[parts.length - 1];
    // "1.500" / "1,500" are thousands groups; "1.50" is a decimal.
    if (parts.length > 2 || tail.length === 3) value = parts.join('');
    else value = parts.join('.');
  }

  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

const HEADER_ALIASES = {
  date: ['date', 'tanggal', 'tgl', 'transaction date', 'time', 'waktu'],
  amount: ['amount', 'jumlah', 'nominal', 'nilai', 'value', 'debit', 'credit', 'kredit', 'mutasi'],
  type: ['type', 'tipe', 'jenis', 'direction'],
  category: ['category', 'kategori'],
  merchant: ['merchant', 'description', 'deskripsi', 'keterangan', 'payee', 'detail', 'uraian'],
  note: ['note', 'notes', 'catatan', 'memo'],
} as const;

function findHeaderIndex(header: string[], aliases: readonly string[]): number {
  return header.findIndex((cell) => aliases.includes(cell));
}

function isHeaderRow(cells: string[]): boolean {
  const normalized = cells.map((c) => c.trim().toLowerCase());
  const terms: readonly string[] = [HEADER_ALIASES.date, HEADER_ALIASES.amount, HEADER_ALIASES.merchant].flat();
  return normalized.some((cell) => terms.includes(cell));
}

const INCOME_WORDS = new Set(['income', 'credit', 'kredit', 'masuk', 'pemasukan', 'in', 'cr']);
const EXPENSE_WORDS = new Set(['expense', 'debit', 'debet', 'keluar', 'pengeluaran', 'out', 'dr']);

export type DefaultType = 'expense' | 'income' | 'auto';

/**
 * Turn raw CSV cells into import rows.
 *
 * Type resolution order (most explicit wins):
 *   1. an explicit `type` column (income/credit/… vs expense/debit/…)
 *   2. `defaultType` when it is expense or income
 *   3. the amount's sign
 */
export function normalizeStatement(
  cells: string[][],
  options: { defaultType?: DefaultType; suggest?: (merchant: string) => string | null } = {},
): NormalizeResult {
  const { defaultType = 'expense', suggest } = options;
  if (cells.length === 0) return { rows: [], skipped: [] };

  const hasHeader = isHeaderRow(cells[0]);
  const header = hasHeader ? cells[0].map((c) => c.trim().toLowerCase()) : [];
  const start = hasHeader ? 1 : 0;

  const indexes = hasHeader
    ? {
      date: findHeaderIndex(header, HEADER_ALIASES.date),
      amount: findHeaderIndex(header, HEADER_ALIASES.amount),
      type: findHeaderIndex(header, HEADER_ALIASES.type),
      category: findHeaderIndex(header, HEADER_ALIASES.category),
      merchant: findHeaderIndex(header, HEADER_ALIASES.merchant),
      note: findHeaderIndex(header, HEADER_ALIASES.note),
    }
    // No header: assume date, amount, merchant, note.
    : { date: 0, amount: 1, type: -1, category: -1, merchant: 2, note: 3 };

  const pick = (row: string[], index: number) => (index >= 0 && index < row.length ? row[index] : '');

  const rows: ImportRow[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let i = start; i < cells.length; i += 1) {
    const row = cells[i];
    const line = i + 1;

    const date = normalizeDate(pick(row, indexes.date));
    if (!date) { skipped.push({ line, reason: 'invalid_date' }); continue; }

    const signedAmount = parseAmount(pick(row, indexes.amount));
    if (signedAmount === null || signedAmount === 0) {
      skipped.push({ line, reason: 'invalid_amount' });
      continue;
    }

    let type: 'income' | 'expense';
    const typeCell = pick(row, indexes.type).trim().toLowerCase();
    if (typeCell && INCOME_WORDS.has(typeCell)) type = 'income';
    else if (typeCell && EXPENSE_WORDS.has(typeCell)) type = 'expense';
    else if (defaultType === 'income' || defaultType === 'expense') type = defaultType;
    else type = signedAmount < 0 ? 'expense' : 'income';

    const merchant = pick(row, indexes.merchant).trim().slice(0, 120);
    const note = pick(row, indexes.note).trim();
    const category = pick(row, indexes.category).trim() || suggest?.(merchant) || undefined;

    rows.push({
      date,
      amount: Math.abs(signedAmount),
      type,
      category,
      merchant,
      note,
    });
  }

  return { rows, skipped };
}
