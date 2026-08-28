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

  it.each([
    ['Auth', 'app/(auth)/login.tsx', "t('welcome.back')"],
    ['Signup', 'app/(auth)/signup.tsx', "t('create.account')"],
    ['Onboarding', 'app/(auth)/onboarding.tsx', "t('onboarding.payday.title')"],
    ['Tabs', 'app/(tabs)/_layout.tsx', "t('home')"],
    ['Profile', 'app/profile.tsx', "t('profile.dataAbout')"],
    ['Reports', 'app/reports.tsx', "t('reports.netCashFlow')"],
    ['Recurring', 'app/recurring.tsx', "t('recurring.empty.title')"],
    ['Privacy', 'app/privacy.tsx', 'privacy.storage.body'],
  ])('%s critical copy uses localization', (_name, relativePath, expected) => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', relativePath), 'utf8');
    expect(src).toContain(expected);
  });

  it.each([
    ['Transaction create', 'app/transaction/new.tsx', "transaction.new.title"],
    ['Transaction edit', 'app/transaction/[id].tsx', "transaction.edit.title"],
    ['Wallet create', 'app/wallet/new.tsx', "wallet.new.title"],
    ['Wallet edit', 'app/wallet/edit/[id].tsx', "wallet.edit.title"],
    ['Goal create', 'app/goal/new.tsx', "goal.new.title"],
    ['Goal detail', 'app/goal/[id].tsx', "goal.addContribution"],
    ['Budget create', 'app/budget/new.tsx', "budget.new.title"],
    ['Asset create', 'app/asset/new.tsx', "asset.new.title"],
    ['Debt create', 'app/debt/new.tsx', "debt.new.title"],
    ['Debt planner', 'app/debt-planner.tsx', "planner.title"],
    ['Plan create', 'app/plan/new.tsx', "plan.form.chooseType"],
    ['Investment create', 'app/investment/new.tsx', "investment.new.title"],
    ['Investment detail', 'app/investment/[id].tsx', "investment.currentValue"],
    ['Export report', 'app/export-report.tsx', "export.financialReport"],
    ['App lock', 'src/auth/AppLockGate.tsx', "applock.title"],
    ['Category manager', 'src/components/QuickAddCategoryModal.tsx', "category.manageTitle"],
    ['Report period', 'src/components/ReportPeriodPicker.tsx', "report.chooseRange"],
  ])('%s secondary flow uses localization', (_name, relativePath, expectedKey) => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', relativePath), 'utf8');
    expect(src).toContain(expectedKey);
  });

  it('secondary flows do not regress to known hardcoded English copy', () => {
    const fs = require('fs');
    const path = require('path');
    const files = [
      'app/transaction/new.tsx', 'app/transaction/[id].tsx',
      'app/wallet/new.tsx', 'app/wallet/edit/[id].tsx',
      'app/goal/new.tsx', 'app/goal/[id].tsx',
      'app/budget/new.tsx', 'app/asset/new.tsx', 'app/debt/new.tsx',
      'app/debt-planner.tsx', 'app/plan/new.tsx',
      'app/investment/new.tsx', 'app/investment/[id].tsx',
      'src/auth/AppLockGate.tsx', 'src/components/QuickAddCategoryModal.tsx',
      'src/components/ReportPeriodPicker.tsx',
    ];
    const source = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
    expect(source).not.toMatch(/(?:title|label|subtitle|placeholder)="(?:New |Edit |Delete |Add |Save |Choose |Current |Target |Monthly |Category|Type|Name|Retry)/);
    expect(source).not.toMatch(/Alert\.alert\(['"](?:Delete|Report|Could not)/);
  });
});
