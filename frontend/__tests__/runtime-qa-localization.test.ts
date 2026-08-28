import fs from 'fs';
import path from 'path';

import { formatDateFieldDisplay } from '@/src/components/DateField';
import { systemCategoryLabel } from '@/src/lib/categories';
import { EN_EXPORT, ID_EXPORT } from '@/src/lib/i18n';

const translate = (locale: 'en' | 'id') => (key: string) => (
  (locale === 'id' ? ID_EXPORT : EN_EXPORT)[key] || key
);

describe('runtime QA localization regressions', () => {
  it('formats DateField with the selected Wallume locale and localizes its empty state', () => {
    const id = formatDateFieldDisplay('2026-08-28', 'id', ID_EXPORT['date.select']);
    const en = formatDateFieldDisplay('2026-08-28', 'en', EN_EXPORT['date.select']);
    expect(id).toMatch(/Jum.*28.*Agu.*2026/i);
    expect(id).not.toMatch(/Fri|Aug/i);
    expect(en).toMatch(/Fri.*Aug.*28.*2026/i);
    expect(formatDateFieldDisplay('', 'id', ID_EXPORT['date.select'])).toBe('Pilih tanggal');
    expect(formatDateFieldDisplay('', 'en', EN_EXPORT['date.select'])).toBe('Select date');
  });

  it('localizes only known system categories and preserves custom labels exactly', () => {
    expect(systemCategoryLabel('Food', translate('id'))).toBe('Makanan');
    expect(systemCategoryLabel('food', translate('id'))).toBe('Makanan');
    expect(systemCategoryLabel('Food', translate('en'))).toBe('Food');
    expect(systemCategoryLabel('Coffee Beans', translate('id'))).toBe('Coffee Beans');
  });

  it('uses localized payday copy instead of hardcoded runtime English', () => {
    expect(ID_EXPORT['payday.today']).toMatch(/gajian/i);
    expect(ID_EXPORT['payday.today']).not.toMatch(/payday/i);
    expect(ID_EXPORT['payday.days']).toContain('hari lagi menuju gajian');
    const home = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'home.tsx'), 'utf8');
    expect(home).toContain("t('payday.today')");
    expect(home).toContain("t('payday.days'");
    expect(home).not.toContain("'Payday today!'");
    expect(home).not.toContain('`${payday.daysRemaining} days until payday`');
  });

  it('bounds horizontal FormLayout chip selectors while preserving the 44dp target', () => {
    const formSelectors = [
      'app/wallet/edit/[id].tsx', 'app/wallet/new.tsx', 'app/asset/new.tsx',
      'app/budget/new.tsx', 'app/goal/new.tsx', 'app/debt/new.tsx',
      'app/investment/new.tsx', 'app/transaction/new.tsx',
      'app/transaction/[id].tsx', 'app/recurring/new.tsx',
      'src/components/CategorySelector.tsx',
    ];
    for (const relative of formSelectors) {
      const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
      const horizontalSelectors = source.match(/<ScrollView horizontal[^>]+>/g) || [];
      expect(horizontalSelectors.length).toBeGreaterThan(0);
      for (const selector of horizontalSelectors) {
        expect(selector).toContain('style={{ flexGrow: 0 }}');
        expect(selector).toContain("alignItems: 'center'");
      }
    }
    const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'ui.tsx'), 'utf8');
    expect(ui).toMatch(/minHeight:\s*44/);
  });
});
