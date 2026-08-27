import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#F6F7F3', surface2: '#FFFFFF', surface3: '#ECF0EA', onSurface: '#1C2926', onSurface2: '#263431',
      onSurface3: '#66736F', muted: '#70807A', border: '#E0E6DF', borderStrong: '#C8D3CB',
      brandPrimary: '#287565', brandSoft: '#E2F0EA', onBrandSoft: '#164B43', onBrand: '#FFFFFF',
      success: '#247A57', error: '#B64A4A', warning: '#B86C20',
    },
    mode: 'light',
  }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/src/lib/i18n', () => ({
  t: (k: string, p?: any) => {
    const m: Record<string, string> = {
      'plans.active': 'Active plans',
      'plans.subtitle': 'Build toward what matters.',
      'plans.empty': 'No active plans yet',
      'plans.empty.subtitle': 'Choose a template',
      'plans.start': 'Start a new plan',
      'plans.of': 'of',
      'plans.target': 'Target',
      'assets.heading': 'Assets',
      'assets.empty.title': 'No assets yet',
      'assets.empty.subtitle': 'Real estate, vehicles, gadgets…',
      'assets.empty.action': 'Add asset',
      'assets.delete.title': 'Delete asset?',
      'investments.heading': 'Investments',
      'investments.empty.title': 'No investments',
      'investments.empty.subtitle': 'Track stocks, crypto, gold and funds.',
      'investments.empty.action': 'Add investment',
      'budgets.monthly': 'Monthly budgets',
      'budgets.of': 'of',
      'budgets.over': 'Over',
      'budgets.remaining': 'Remaining',
    };
    let v = m[k] || k;
    if (p) for (const [a, b] of Object.entries(p)) v = v.replace(`{${a}}`, String(b));
    return v;
  },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: (cb: any) => cb() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({ useBalancePrivacy: () => ({ isBalanceVisible: true, isPrivacyReady: true }) }));
jest.mock('@/src/api/client', () => ({ api: { deleteAsset: jest.fn(() => Promise.resolve({})), deleteBudget: jest.fn(), budgets: jest.fn(() => Promise.resolve({ budgets: [] })), goals: jest.fn(() => Promise.resolve({ goals: [] })), plans: jest.fn(() => Promise.resolve({ plans: [] })), debts: jest.fn(() => Promise.resolve({ debts: [] })), assets: jest.fn(() => Promise.resolve({ assets: [] })), investments: jest.fn(() => Promise.resolve({ investments: [] })) } }));
jest.mock('@/src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { currency: 'IDR' } }) }));

import { AssetsSection, InvestmentsSection } from '@/app/(tabs)/plan';

const mockAsset = { id: 'a1', name: 'Villa Bali', kind: 'real_estate', value: 500000000 };
const mockInvestment = { id: 'inv1', name: 'BBCA', ticker: 'BBCA', kind: 'stock', quantity: 100, avg_cost: 8000, current_price: 9500 };

describe('Assets / Investments separation', () => {
  it('Test 1 — Assets with data shows only assets', () => {
    const { getByText, queryByText, queryByTestId } = render(
      <AssetsSection assets={[mockAsset]} currency="IDR" onAdd={jest.fn()} onReload={jest.fn()} />
    );
    expect(getByText('Villa Bali')).toBeTruthy();
    expect(getByText('Assets')).toBeTruthy();
    expect(queryByText('No assets yet')).toBeNull();
    expect(queryByText('No investments')).toBeNull();
    expect(queryByText('BBCA')).toBeNull();
    expect(queryByTestId('inv-empty')).toBeNull();
    expect(queryByTestId('inv-portfolio-btn')).toBeNull();
  });

  it('Test 2 — Assets empty does not show investments empty', () => {
    const { getByText, queryByText } = render(
      <AssetsSection assets={[]} currency="IDR" onAdd={jest.fn()} onReload={jest.fn()} />
    );
    expect(getByText('No assets yet')).toBeTruthy();
    expect(queryByText('No investments')).toBeNull();
    expect(queryByText('Villa Bali')).toBeNull();
  });

  it('Test 3 — Investments with data shows only investments', () => {
    const { getByText, queryByText, queryByTestId } = render(
      <InvestmentsSection investments={[mockInvestment]} currency="IDR" onAdd={jest.fn()} />
    );
    expect(getByText('Investments')).toBeTruthy();
    expect(getByText('BBCA · BBCA')).toBeTruthy();
    expect(queryByText('No investments')).toBeNull();
    expect(queryByText('No assets yet')).toBeNull();
    expect(queryByText('Villa Bali')).toBeNull();
    expect(queryByTestId('assets-empty')).toBeNull();
  });

  it('Test 4 — Investments empty does not show assets empty', () => {
    const { getByText, queryByText } = render(
      <InvestmentsSection investments={[]} currency="IDR" onAdd={jest.fn()} />
    );
    expect(getByText('No investments')).toBeTruthy();
    expect(queryByText('No assets yet')).toBeNull();
    expect(queryByText('Villa Bali')).toBeNull();
  });

  it('Test 5 — Add buttons route correctly', () => {
    const onAddAsset = jest.fn();
    const onAddInv = jest.fn();
    const { getByTestId } = render(
      <>
        <AssetsSection assets={[]} currency="IDR" onAdd={onAddAsset} onReload={jest.fn()} />
        <InvestmentsSection investments={[]} currency="IDR" onAdd={onAddInv} />
      </>
    );
    fireEvent.press(getByTestId('asset-add-btn'));
    expect(onAddAsset).toHaveBeenCalled();
    fireEvent.press(getByTestId('inv-add-btn'));
    expect(onAddInv).toHaveBeenCalled();
  });

  it('Test 6 — Portfolio button visible only in Investments when investments exist, not in Assets', () => {
    const { queryByTestId: qA } = render(<AssetsSection assets={[mockAsset]} currency="IDR" onAdd={jest.fn()} onReload={jest.fn()} />);
    expect(qA('inv-portfolio-btn')).toBeNull();
    expect(qA('inv-add-btn')).toBeNull(); // asset section doesn't have inv-add-btn

    const { queryByTestId: qI } = render(<InvestmentsSection investments={[mockInvestment]} currency="IDR" onAdd={jest.fn()} />);
    expect(qI('inv-portfolio-btn')).toBeTruthy();
    expect(qI('inv-add-btn')).toBeTruthy();
    expect(qI('asset-add-btn')).toBeNull();

    const { queryByTestId: qEmpty } = render(<InvestmentsSection investments={[]} currency="IDR" onAdd={jest.fn()} />);
    expect(qEmpty('inv-portfolio-btn')).toBeNull(); // empty investments: no portfolio button
  });
});
