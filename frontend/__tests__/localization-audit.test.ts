import { EN_EXPORT, ID_EXPORT } from '@/src/lib/i18n';

describe('Localization audit', () => {
  it('EN and ID have parity for all budget/wallet/transaction keys', () => {
    const enKeys = Object.keys(EN_EXPORT);
    const idKeys = Object.keys(ID_EXPORT);
    const missingInId = enKeys.filter((k) => !(k in ID_EXPORT));
    const missingInEn = idKeys.filter((k) => !(k in EN_EXPORT));
    expect(missingInId).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('no raw localization key is exposed as user-facing fallback', () => {
    const { t } = require('@/src/lib/i18n');
    // Known keys should not fallback to raw key
    expect(t('budgets.monthly')).not.toBe('budgets.monthly');
    expect(t('wallets.heading')).not.toBe('wallets.heading');
    expect(t('transactions.empty.title')).not.toBe('transactions.empty.title');
    expect(t('budgets.over')).not.toBe('budgets.over');
    expect(t('common.cancel')).not.toBe('common.cancel');
  });

  it('financial hub headings are localized via t', () => {
    const planSource = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', '(tabs)', 'plan.tsx'), 'utf8');
    expect(planSource).toContain("t('budgets.monthly')");
    expect(planSource).toContain("t('assets.heading')");
    expect(planSource).toContain("t('investments.heading')");
    expect(planSource).not.toMatch(/<H2[^>]*>Monthly budgets<\/H2>/);
    expect(planSource).not.toMatch(/<H2[^>]*>Assets<\/H2>/);
    expect(planSource).not.toMatch(/<H2[^>]*>Investments<\/H2>/);
  });

  it('wallet empty state uses localized keys', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', '(tabs)', 'wallets.tsx'), 'utf8');
    expect(src).toContain("t('wallets.empty.title')");
    expect(src).not.toContain('title="No wallets yet"');
  });

  it('budget semantics remain localized and not hardcoded English', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', '(tabs)', 'plan.tsx'), 'utf8');
    expect(src).toContain("t('budgets.over')");
    expect(src).toContain("t('budgets.remaining')");
    expect(src).toContain('budgetCategoryLabel');
  });
});
