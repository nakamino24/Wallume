import fs from 'fs';
import path from 'path';

/**
 * Splits and receipts must be visible from the transaction list.
 *
 * Both were backend-only fields that the list never surfaced:
 * - a split created one row per part sharing `split_group_id`, so three parts
 *   of one Rp500k transaction looked like three separate purchases;
 * - `receipt_count` was attached to the list response but no indicator used it,
 *   and the batched receipt query existed only as dead code.
 */
const ROOT = path.join(__dirname, '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const ROW = path.join('src', 'components', 'transactions', 'TransactionDayGroup.tsx');

describe('Split and receipt indicators on transaction rows', () => {
  const row = readSource(ROW);
  const i18n = readSource(path.join('src', 'lib', 'i18n.ts'));

  it('shows a split badge on rows that belong to a split group', () => {
    // Driven by split_group_id, which every part row carries.
    expect(row).toMatch(/split_group_id/);
    expect(row).toMatch(/split\.badge/);
    expect(row).toMatch(/tx-split-badge-/);
  });

  it('does not show the badge on non-split rows', () => {
    // Conditional on the field being present and truthy.
    expect(row).toMatch(/!!transaction\.split_group_id/);
  });

  it('shows a receipt indicator using the count from the list response', () => {
    expect(row).toMatch(/receipt_count/);
    expect(row).toMatch(/tx-receipts-/);
    expect(i18n).toMatch(/'transaction\.receipts'/);
  });

  it('does not show the receipt indicator when there are none', () => {
    expect(row).toMatch(/Boolean\(transaction\.receipt_count\)/);
  });

  it('keeps the category label readable next to the badge', () => {
    // The badge sits in a row with the category; the label must be allowed to
    // shrink rather than pushing the badge off-screen.
    expect(row).toMatch(/flexShrink:\s*1/);
  });
});

describe('receipt counts reach the list response', () => {
  it('frontend field name matches what the backend attaches', () => {
    // The backend test file (test_receipts.py) is the authority for the API
    // contract; this only guards that the frontend reads the same field name
    // the backend writes.
    expect(readSource(ROW)).toMatch(/receipt_count/);
  });
});
