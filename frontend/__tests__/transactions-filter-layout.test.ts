import fs from 'fs';
import path from 'path';

/**
 * Transactions filter-toolbar layout regression.
 *
 * Observed bug (v1.0.7a preview): on the Transactions screen the filter chips
 * intermittently expanded into tall vertical capsules, pushing the transaction
 * list out of place. It repeated on every filter interaction and loading
 * transition.
 *
 * Root cause, traced to React Native's own source:
 *
 * 1. `ScrollView` applies `flexGrow: 1` to BOTH orientations
 *    (Libraries/Components/ScrollView/ScrollView.js -> `baseHorizontal`), so a
 *    horizontal ScrollView placed in a column parent absorbs all leftover
 *    vertical space. The toolbar therefore became as tall as the screen minus
 *    the fixed header/search, and its height changed whenever the content below
 *    it (the transaction list) changed size — which is exactly when loading
 *    toggled.
 *
 * 2. The content container defaults to `alignItems: 'stretch'` on the cross
 *    axis (vertical, in a row), so every Chip was stretched to that full
 *    height. `Chip` sets `minHeight: 44` and `alignItems: 'center'`, which is
 *    why the label stayed vertically centred inside a giant capsule.
 *
 * The fix is the same constraint every other horizontal chip row in the app
 * already used; this screen was the outlier.
 *
 * LIMITATION: these are source/style assertions. Jest runs without Yoga, so it
 * cannot measure physical pixels — validating real height on a device is a
 * separate, manual acceptance step.
 */

const ROOT = path.join(__dirname, '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/**
 * Pull the opening tag of the first `<ScrollView` that carries `horizontal`,
 * so assertions target that element rather than the file as a whole.
 */
function horizontalScrollViewTag(source: string): string {
  const start = source.indexOf('<ScrollView');
  let index = start;
  while (index !== -1) {
    // Find the end of this opening tag.
    const tagEnd = source.indexOf('>', index);
    const tag = source.slice(index, tagEnd + 1);
    if (/\bhorizontal\b/.test(tag)) return tag;
    index = source.indexOf('<ScrollView', index + 1);
  }
  return '';
}

describe('Transactions filter toolbar — layout invariants', () => {
  const source = readSource(path.join('app', 'transactions.tsx'));

  it('constrains the horizontal filter ScrollView so it sizes to its content', () => {
    const tag = horizontalScrollViewTag(source);
    expect(tag).not.toBe('');

    // Without flexGrow: 0 RN's ScrollView absorbs all remaining vertical space
    // (baseHorizontal sets flexGrow: 1), which is the reported regression.
    expect(tag).toMatch(/flexGrow:\s*0/);
    // And it must not be squeezed by the list growing below it.
    expect(tag).toMatch(/flexShrink:\s*0/);
  });

  it('centres chips on the cross axis instead of stretching them', () => {
    const tag = horizontalScrollViewTag(source);
    // Flexbox default is `stretch`; that is what made chips tall capsules.
    expect(tag).toMatch(/alignItems:\s*'center'/);
    expect(tag).toMatch(/flexDirection:\s*'row'/);
  });

  it('does not impose a fixed pixel height on the filter row', () => {
    const tag = horizontalScrollViewTag(source);
    // The brief explicitly warns against solving this with a magic height:
    // that would break at other densities and with long wallet names.
    expect(tag).not.toMatch(/\bheight:\s*\d/);
    expect(tag).not.toMatch(/height:\s*'\d+%'/);
    expect(tag).not.toMatch(/\bminHeight:\s*\d/);
  });

  it('keeps the search field outside the scrollable list', () => {
    // The search box and the filter row must both sit above the list, so a
    // loading transition in the list cannot move them. Anchor each on a string
    // that occurs exactly once, in document order.
    const searchIndex = source.indexOf('testID="tx-search"');
    const walletChipIndex = source.indexOf('tx-filter-wallet-toggle');
    const listIndex = source.indexOf('refreshControl=');
    expect(searchIndex).toBeGreaterThan(-1);
    expect(walletChipIndex).toBeGreaterThan(-1);
    expect(listIndex).toBeGreaterThan(-1);
    // search box -> filter chips -> transaction list
    expect(searchIndex).toBeLessThan(walletChipIndex);
    expect(walletChipIndex).toBeLessThan(listIndex);
  });

  it('applies the same constraint to every horizontal chip row in the app', () => {
    // A regression guard for the class of bug: any horizontal ScrollView with
    // chips must not default to flexGrow: 1.
    const files = [
      'app/transactions.tsx',
      'app/profile.tsx',
      'app/budget/new.tsx',
      'app/goal/new.tsx',
      'app/debt/new.tsx',
      'app/asset/new.tsx',
      'app/wallet/new.tsx',
      'app/recurring/new.tsx',
      'app/investment/new.tsx',
      'app/transaction/new.tsx',
      'app/transaction/[id].tsx',
      'app/wallet/edit/[id].tsx',
    ];
    for (const file of files) {
      const content = readSource(file);
      const tag = horizontalScrollViewTag(content);
      if (!tag) continue;
      expect(tag).toMatch(/flexGrow:\s*0/);
    }
  });
});

describe('Transactions filter toolbar — behaviour preserved', () => {
  const source = readSource(path.join('app', 'transactions.tsx'));

  it('keeps all four transaction-type filters', () => {
    expect(source).toMatch(/const TYPES = \['all', 'income', 'expense', 'transfer'\] as const/);
  });

  it('keeps the wallet filter and its cycling behaviour', () => {
    expect(source).toContain('tx-filter-wallet-toggle');
    // Cycles through wallets, then clears — unchanged by this fix.
    expect(source).toMatch(/setWalletId\(idx === wallets\.length - 1 \? '' : wallets\[idx \+ 1\]\.id\)/);
  });

  it('keeps the clear-filters action and what it resets', () => {
    expect(source).toContain('tx-clear-filters');
    expect(source).toMatch(/const clearFilters = \(\) => \{/);
    for (const reset of ["setFilter('all')", "setSearchInput('')", "setSearch('')", "setWalletId('')"]) {
      expect(source).toContain(reset);
    }
  });

  it('keeps combined type + wallet filtering', () => {
    // Both filters are passed to the same query, so Transfer + a specific
    // wallet still composes.
    expect(source).toMatch(/useTransactionQuery\(\s*\{ type: filter, search, wallet_id: walletId \}/);
  });

  it('does not change which data source backs filtered vs unfiltered views', () => {
    // Unfiltered stays on the optimistic store; filtered is server-driven.
    expect(source).toMatch(/const shown = isFiltered \? fetched : recent;/);
  });
});
