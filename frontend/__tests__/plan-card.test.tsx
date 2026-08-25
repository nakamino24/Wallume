import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { surface2: '#FFFFFF', onSurface: '#1C2926', onSurface3: '#66736F', muted: '#70807A', brandPrimary: '#287565', brandSoft: '#E2F0EA', onBrandSoft: '#164B43', surface3: '#ECF0EA' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/src/lib/i18n', () => ({ t: (key: string) => ({ 'plans.of': 'of', 'plans.target': 'Target' }[key] || key) }));

import { PlanCard, planProgress } from '@/src/components/plans/PlanCard';

describe('PlanCard', () => {
  it('derives safe progress from existing saved and target values without changing a user title', () => {
    expect(planProgress(42_500_000, 300_000_000)).toBeCloseTo(0.1417);
    expect(planProgress(100, 0)).toBe(0);
    const onPress = jest.fn();
    const { getByText, getByTestId } = render(<PlanCard currency="IDR" onPress={onPress} plan={{ id: 'p1', kind: 'wedding', name: 'Bismillah 2029', total_budget: 200_000_000, items: [{ paid: 0 }] }} />);
    expect(getByText('Bismillah 2029')).toBeTruthy();
    expect(getByText('0%')).toBeTruthy();
    fireEvent.press(getByTestId('plan-open-p1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
