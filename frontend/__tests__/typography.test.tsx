import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      surface: '#F6F7F3', surface2: '#FFFFFF', onSurface: '#1C2926', onBrand: '#FFFFFF',
      brandPrimary: '#287565', error: '#B64A4A', success: '#247A57', inverse: '#164B43',
      onInverse: '#FFFFFF', muted: '#70807A', border: '#E0E6DF', surface3: '#ECF0EA',
      brandSoft: '#E2F0EA', onBrandSoft: '#164B43',
    },
    mode: 'light',
  }),
}));

const { font, palette } = require('@/src/theme/tokens');
const { DisplayNumber } = require('@/src/components/ui');
const { TransactionDayGroup } = require('@/src/components/transactions/TransactionDayGroup');

describe('Typography tokens', () => {
  it('maps Inter for all typography (one-font)', () => {
    expect(font.display).toBe('Inter');
    expect(font.displayBold).toBe('Inter-SemiBold');
    expect(font.text).toBe('Inter');
    expect(font.textBold).toBe('Inter-SemiBold');
  });

  it('DisplayNumber hero value renders with Inter', () => {
    const { getByText } = render(<DisplayNumber size={34}>Rp1.000</DisplayNumber>);
    const node = getByText('Rp1.000');
    const style = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(style.fontFamily).toBe('Inter-SemiBold');
    expect(style.fontVariant).toContain('tabular-nums');
  });
});

describe('Transaction amount typography', () => {
  it('uses Inter with tabular figures', () => {
    const group = {
      key: '2026-08-25',
      date: new Date('2026-08-25T00:00:00'),
      transactions: [{ id: 'a', date: '2026-08-25', type: 'expense', category: 'Food', amount: 35000 }],
    };
    const { getByText } = render(
      <TransactionDayGroup group={group} currency="IDR" onOpen={jest.fn()} onRemove={jest.fn()} />,
    );
    const node = getByText('-Rp35.000');
    const style = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(style.fontFamily).toBe('Inter-SemiBold');
    expect(style.fontVariant).toContain('tabular-nums');
  });
});

describe('Dark theme token system', () => {
  it('replaces green-dominant surfaces with a graphite/navy/indigo system', () => {
    expect(palette.dark.surface).toBe('#11131A');
    expect(palette.dark.inverse).toBe('#20283A');
    expect(palette.dark.onInverse).toBe('#F7F8FC');
    expect(palette.dark.brandPrimary).toBe('#70C8B1');
    expect(palette.dark.onSurface).not.toBe('#101816');
  });
});
