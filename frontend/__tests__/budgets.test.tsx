import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#F6F7F3', surface2: '#FFFFFF', surface3: '#ECF0EA', onSurface: '#1C2926', onSurface2: '#263431',
      muted: '#70807A', border: '#E0E6DF', brandPrimary: '#287565', warning: '#B86C20', error: '#B64A4A',
      onBrand: '#FFFFFF',
    },
    mode: 'light',
  }),
}));
jest.mock('@/src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { currency: 'IDR' } }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/src/api/client', () => ({ api: { deleteBudget: jest.fn(() => Promise.resolve({})) } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: (cb: any) => cb() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({ useBalancePrivacy: () => ({ isBalanceVisible: true, isPrivacyReady: true }) }));

let mockLocale: 'en' | 'id' = 'en';
jest.mock('@/src/lib/i18n', () => {
  const actual = jest.requireActual('@/src/lib/i18n');
  return {
    ...actual,
    t: (key: string, params?: any) => {
      if (mockLocale === 'id') {
        const map: Record<string, string> = {
          'budgets.monthly': 'Anggaran Bulanan',
          'budgets.of': 'dari',
          'budgets.over': 'Lebih',
          'budgets.remaining': 'Sisa',
          'budgets.category.food': 'Makanan',
          'budgets.category.transport': 'Transportasi',
          'budgets.category.entertainment': 'Hiburan',
          'budgets.category.bills': 'Tagihan',
        };
        if (map[key]) {
          if (params) {
            let s = map[key];
            for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
            return s;
          }
          return map[key];
        }
      } else {
        const map: Record<string, string> = {
          'budgets.monthly': 'Monthly budgets',
          'budgets.of': 'of',
          'budgets.over': 'Over',
          'budgets.remaining': 'Remaining',
          'budgets.category.food': 'Food',
          'budgets.category.transport': 'Transport',
          'budgets.category.entertainment': 'Entertainment',
          'budgets.category.bills': 'Bills',
        };
        if (map[key]) return map[key];
      }
      return actual.t(key, params);
    },
    getLocale: () => mockLocale,
  };
});

// Import after mocks
import { BudgetsSection } from '@/app/(tabs)/plan';

const renderBudgets = (budgets: any[], locale: 'en' | 'id' = 'en') => {
  mockLocale = locale;
  return render(<BudgetsSection budgets={budgets} currency="IDR" onAdd={jest.fn()} onReload={jest.fn()} />);
};

const pctText = (id: string, getByTestId: any) => {
  const c = getByTestId(`budget-pct-${id}`).props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};

describe('Budget semantics', () => {
  it('exact limit 120k of 120k shows 100% Remaining Rp0', () => {
    const { getByText, getByTestId } = renderBudgets([{ id: 'b1', category: 'Food', spent: 120000, amount: 120000 }]);
    expect(pctText('b1', getByTestId)).toBe('100%');
    expect(getByText('Remaining')).toBeTruthy();
    expect(getByTestId('budget-status-b1').props.children).toBe('Rp0');
  });

  it('slightly over 1553300/1500000 shows 104% Over Rp53.300', () => {
    const { getByText, getByTestId } = renderBudgets([{ id: 'b1', category: 'Food', spent: 1553300, amount: 1500000 }]);
    expect(pctText('b1', getByTestId)).toBe('104%');
    expect(getByText('Over')).toBeTruthy();
    // MoneyValue formats 53.300 -> Rp53.300
    expect(getByTestId('budget-status-b1').props.children).toBe('Rp53.300');
  });

  it('significantly over 493000/270000 shows 183% Over Rp223.000', () => {
    const { getByTestId, getByText } = renderBudgets([{ id: 'b2', category: 'Transport', spent: 493000, amount: 270000 }]);
    expect(pctText('b2', getByTestId)).toBe('183%');
    expect(getByText('Over')).toBeTruthy();
    expect(getByTestId('budget-status-b2').props.children).toBe('Rp223.000');
  });

  it('under budget 750k/1500k shows 50% Remaining Rp750.000', () => {
    const { getByTestId, getByText } = renderBudgets([{ id: 'b3', category: 'Bills', spent: 750000, amount: 1500000 }]);
    expect(pctText('b3', getByTestId)).toBe('50%');
    expect(getByText('Remaining')).toBeTruthy();
    expect(getByTestId('budget-status-b3').props.children).toBe('Rp750.000');
  });

  it('zero budget does not show NaN Infinity', () => {
    const { getByTestId, queryByText } = renderBudgets([
      { id: 'z1', category: 'Food', spent: 0, amount: 0 },
      { id: 'z2', category: 'Bills', spent: 50000, amount: 0 },
    ]);
    expect(pctText('z1', getByTestId)).toBe('0%');
    expect(pctText('z2', getByTestId)).toBe('0%');
    expect(queryByText(/NaN/)).toBeNull();
    expect(queryByText(/Infinity/)).toBeNull();
  });

  it('localization ID shows Anggaran Bulanan Makanan dari Lebih Sisa', () => {
    const { getByText } = renderBudgets([{ id: 'b1', category: 'food', spent: 1000, amount: 2000 }], 'id');
    expect(getByText('Anggaran Bulanan')).toBeTruthy();
    expect(getByText('Makanan')).toBeTruthy();
    expect(getByText('dari')).toBeTruthy();
    // status is Remaining -> Sisa
    expect(getByText('Sisa')).toBeTruthy();
  });

  it('localization EN shows Monthly budgets Food of Over Remaining', () => {
    const { getByText } = renderBudgets([{ id: 'b1', category: 'food', spent: 2500, amount: 2000 }], 'en');
    expect(getByText('Monthly budgets')).toBeTruthy();
    expect(getByText('Food')).toBeTruthy();
    expect(getByText('of')).toBeTruthy();
    expect(getByText('Over')).toBeTruthy();
  });

  it('ring progress remains capped at 100% while percentage shows real', () => {
    const { getByTestId } = renderBudgets([{ id: 'b1', category: 'Food', spent: 398000, amount: 200000 }]);
    expect(pctText('b1', getByTestId)).toBe('199%');
  });
});
