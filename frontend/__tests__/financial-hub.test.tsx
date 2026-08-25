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
});
