import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({
  useBalancePrivacy: () => ({ isBalanceVisible: true, isPrivacyReady: true }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#F6F7F3', surface2: '#FFFFFF', surface3: '#ECF0EA',
      onSurface: '#1C2926', onSurface2: '#263431', onSurface3: '#66736F',
      onBrand: '#FFFFFF', onBrandSoft: '#164B43', brandSoft: '#E2F0EA',
      brandPrimary: '#287565', border: '#E0E6DF', borderStrong: '#C8D3CB',
      muted: '#70807A', error: '#B64A4A', success: '#247A57',
    },
    mode: 'light',
  }),
}));

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { currency: 'IDR', name: 'Test' } }),
}));

const mockPlan = {
  id: 'plan1', kind: 'wedding', name: 'Bismillah 2029',
  total_budget: 50000, target_date: '2029-06-01',
  items: [
    { id: 'it1', label: 'Venue', amount: 20000, paid: 5000, done: false },
    { id: 'it2', label: 'Catering', amount: 15000, paid: 0, done: false },
  ],
};

jest.mock('@/src/api/client', () => ({
  api: {
    plans: jest.fn(() => Promise.resolve({ plans: [mockPlan] })),
    updatePlan: jest.fn(() => Promise.resolve({})),
    deletePlan: jest.fn(() => Promise.resolve({})),
  },
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'plan1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: any) => children }));
jest.mock('@/src/lib/i18n', () => ({
  t: (key: string, params?: Record<string, string | number>) => {
    const text = ({
      'plans.template.wedding': 'Wedding',
      'plans.collected': 'Collected',
      'plans.target': 'Target',
      'plans.summary': 'Summary',
      'plans.budget': 'Budget',
      'plans.allocated': 'Allocated',
      'plans.fundsCollected': 'Funds collected',
      'plans.ofBudget': '{pct}% of budget',
      'plans.checklist': 'Checklist',
      'plans.addItem': 'Add item',
      'plans.itemPlaceholder': 'e.g. Wedding cake',
      'plans.amountOptional': 'Amount (optional)',
      'plans.addChecklistItem': 'Add checklist item',
    } as Record<string, string>)[key] || key;
    return params ? text.replace('{pct}', String(params.pct)) : text;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => {
    const React = require('react');
    return React.createElement('View', null, children);
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('Plan detail layout', () => {
  it('Wedding detail does NOT show FinancialHubSwitcher', async () => {
    const Detail = require('@/app/plan/[id]').default;
    const { queryByTestId, getByText } = render(<Detail />);
    await waitFor(() => expect(getByText('Bismillah 2029')).toBeTruthy());
    expect(queryByTestId('financial-hub-switcher')).toBeNull();
  });

  it('does NOT show navigation pills to other plans', async () => {
    const Detail = require('@/app/plan/[id]').default;
    const { queryByTestId, getByText } = render(<Detail />);
    await waitFor(() => expect(getByText('Bismillah 2029')).toBeTruthy());
    expect(queryByTestId('plan-new-wedding')).toBeNull();
    expect(queryByTestId('plan-new-house')).toBeNull();
  });

  it('shows the current plan hierarchy (Back, name, saved/target, progress)', async () => {
    const Detail = require('@/app/plan/[id]').default;
    const { getByTestId, getByText } = render(<Detail />);
    await waitFor(() => expect(getByText('Bismillah 2029')).toBeTruthy());
    expect(getByTestId('plan-back')).toBeTruthy();
    expect(getByText('Wedding')).toBeTruthy();
    expect(getByText('Collected')).toBeTruthy();
    expect(getByText('Target')).toBeTruthy();
    expect(getByText('Summary')).toBeTruthy();
    expect(getByText('Checklist')).toBeTruthy();
    expect(getByText('10% of budget')).toBeTruthy();
    expect(getByText('Allocated')).toBeTruthy();
    expect(getByText('Add item')).toBeTruthy();
  });

  it('uses skeleton loading UI instead of raw loading copy', () => {
    const Detail = require('@/app/plan/[id]').default;
    const { queryByText } = render(<Detail />);
    expect(queryByText(/Loading/i)).toBeNull();
  });
});
