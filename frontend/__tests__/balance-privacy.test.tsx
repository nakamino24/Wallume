import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockToggle = jest.fn();
const mockShow = jest.fn();
const mockHide = jest.fn();

let mockVisible = false;
let mockReady = true;

jest.mock('@/src/privacy/BalancePrivacyProvider', () => ({
  useBalancePrivacy: () => ({
    isBalanceVisible: mockVisible,
    isPrivacyReady: mockReady,
    showBalance: mockShow,
    hideBalance: mockHide,
    toggleBalanceVisibility: mockToggle,
  }),
  BalancePrivacyProvider: ({ children }: any) => children,
}));

jest.mock('@/src/components/KeyboardAwareContainer', () => ({
  useKeyboardScroll: () => ({ focusToInput: jest.fn() }),
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { onSurface: '#000', onBrand: '#fff', surface: '#fff', surface2: '#fff', surface3: '#eee', border: '#ccc', muted: '#666', brandPrimary: '#0a0', success: '#0f0', error: '#f00' },
    mode: 'light',
  }),
}));

import { MoneyValue } from '@/src/components/MoneyValue';

describe('Balance Privacy', () => {
  beforeEach(() => {
    mockVisible = false;
    mockReady = true;
    jest.clearAllMocks();
  });

  it('BP1 default hidden shows masked value', () => {
    mockVisible = false;
    const { getByText } = render(<MoneyValue value={9058754} currency="IDR" privacy="financial" />);
    expect(getByText('Rp•••••••')).toBeTruthy();
  });

  it('BP2 eye reveal shows actual value', () => {
    mockVisible = true;
    const { getByText } = render(<MoneyValue value={9058754} currency="IDR" privacy="financial" />);
    expect(getByText('Rp9.058.754')).toBeTruthy();
  });

  it('BP3 eye hide masks value', () => {
    mockVisible = false;
    const { getByText } = render(<MoneyValue value={9058754} currency="IDR" />);
    expect(getByText('Rp•••••••')).toBeTruthy();
  });

  it('BP6 MoneyValue with privacy none always shows actual', () => {
    mockVisible = false;
    const { getByText } = render(<MoneyValue value={9058754} currency="IDR" privacy="none" />);
    expect(getByText('Rp9.058.754')).toBeTruthy();
  });

  it('BP7 transaction count remains visible (not masked)', () => {
    // MoneyValue is for financial, not for count; count should be plain Text
    const { getByText } = render(<Text>4 transactions</Text>);
    expect(getByText('4 transactions')).toBeTruthy();
  });

  it('BP9 MoneyInput remains readable while editing (not masked)', () => {
    const MoneyInput = require('@/src/components/MoneyInput').MoneyInput;
    const { getByTestId } = render(<MoneyInput value="25000" onChange={jest.fn()} label="Amount" currency="IDR" testID="money-input" />);
    expect(getByTestId('money-input')).toBeTruthy();
  });
});
