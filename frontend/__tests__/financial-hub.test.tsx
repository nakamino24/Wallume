import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { surface2: '#FFFFFF', surface3: '#ECF0EA', onSurface2: '#263431', onBrandSoft: '#164B43', brandSoft: '#E2F0EA', brandPrimary: '#287565', border: '#E0E6DF', borderStrong: '#C8D3CB', muted: '#70807A' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/src/lib/i18n', () => ({
  t: (key: string) => ({ budgets: 'Budgets', goals: 'Goals', plans: 'Plans', debts: 'Debts', assets: 'Assets', investments: 'Investments', bills: 'Bills', 'hub.title': 'Your money', 'hub.subtitle': 'Manage every part of your finances.', 'hub.current': 'Current', 'hub.current.section': 'Current section', 'hub.budgets.detail': 'Monthly limits', 'hub.goals.detail': 'Saving goals', 'hub.plans.detail': 'Life plans', 'hub.debts.detail': 'Payoff plans', 'hub.assets.detail': 'What you own', 'hub.investments.detail': 'Your portfolio', 'hub.bills.detail': 'Recurring payments' }[key] || key),
}));

import { FinancialHubSheet } from '@/src/components/finance/FinancialHubSheet';
import { FinancialHubSwitcher } from '@/src/components/finance/FinancialHubSwitcher';

const mockApi = {
  budgets: jest.fn(),
  goals: jest.fn(),
  plans: jest.fn(),
  debts: jest.fn(),
  assets: jest.fn(),
  investments: jest.fn(),
};
jest.mock('@/src/api/client', () => ({ api: mockApi }));
jest.mock('@/src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { currency: 'IDR' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({ useBalancePrivacy: () => ({ isBalanceVisible: false, isPrivacyReady: true }) }));

describe('Financial Hub', () => {
  it('renders the compact current-module switcher and the seven module cards', () => {
    const onSelect = jest.fn();
    const { getByTestId, getAllByText } = render(<><FinancialHubSwitcher current="plans" onPress={jest.fn()} /><FinancialHubSheet visible current="plans" onClose={jest.fn()} onSelect={onSelect} /></>);
    expect(getByTestId('financial-hub-switcher')).toBeTruthy();
    expect(getAllByText('Plans').length).toBeGreaterThan(0);
    ['budgets', 'goals', 'plans', 'debts', 'assets', 'investments', 'bills'].forEach((key) => expect(getByTestId(`financial-module-${key}`)).toBeTruthy());
    expect(getByTestId('financial-module-plans').props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByTestId('financial-module-budgets'));
    expect(onSelect).toHaveBeenCalledWith('budgets');
  });

  it('switcher chevron and section + action do not share competing layout space', () => {
    const { getByTestId } = render(<FinancialHubSwitcher current="plans" onPress={jest.fn()} />);
    const node = getByTestId('financial-hub-switcher');
    const style = node.props.style;
    const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
    expect(resolved.minHeight).toBeLessThanOrEqual(52);
    expect(resolved.gap).toBeDefined();
  });

  it('does not show the plans empty state before plans finish loading', () => {
    mockApi.budgets.mockReturnValue(new Promise(() => {}));
    mockApi.goals.mockReturnValue(new Promise(() => {}));
    mockApi.plans.mockReturnValue(new Promise(() => {}));
    mockApi.debts.mockReturnValue(new Promise(() => {}));
    mockApi.assets.mockReturnValue(new Promise(() => {}));
    mockApi.investments.mockReturnValue(new Promise(() => {}));
    const PlanScreen = require('@/app/(tabs)/plan').default;
    const { queryByTestId } = render(<PlanScreen />);
    expect(queryByTestId('plans-empty')).toBeNull();
  });
});
