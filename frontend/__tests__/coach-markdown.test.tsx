import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { onSurface: '#000', onBrand: '#fff', surface: '#fff', surface2: '#fff', surface3: '#eee', border: '#ccc', muted: '#666', brandPrimary: '#0a0' },
    mode: 'light',
  }),
}));

import { CoachMarkdown } from '@/src/components/CoachMarkdown';

describe('AI Coach Markdown', () => {
  it('AC1 bold renders without literal **', () => {
    const { getByText, queryByText } = render(<CoachMarkdown>{'**Important**'}</CoachMarkdown>);
    expect(getByText('Important')).toBeTruthy();
    expect(queryByText('**Important**')).toBeNull();
    expect(queryByText('**')).toBeNull();
  });

  it('AC2 italic renders', () => {
    const { getByText } = render(<CoachMarkdown>{'*Note*'}</CoachMarkdown>);
    expect(getByText('Note')).toBeTruthy();
  });

  it('AC3 bulleted list renders', () => {
    const { getByText } = render(<CoachMarkdown>{'- Food: Rp500.000\n- Transport: Rp200.000'}</CoachMarkdown>);
    expect(getByText(/Food/)).toBeTruthy();
    expect(getByText(/Transport/)).toBeTruthy();
  });

  it('AC4 numbered list renders', () => {
    const { getByText } = render(<CoachMarkdown>{'1. First\n2. Second'}</CoachMarkdown>);
    expect(getByText(/First/)).toBeTruthy();
    expect(getByText(/Second/)).toBeTruthy();
  });

  it('AC6 malformed incomplete Markdown does not crash', () => {
    const { getByText } = render(<CoachMarkdown>{'**Important'}</CoachMarkdown>);
    expect(getByText(/Important/)).toBeTruthy();
  });

  it('AC8 Indonesian bold renders', () => {
    const { getByText } = render(<CoachMarkdown>{'**Ringkasan**\n- Pengeluaran meningkat'}</CoachMarkdown>);
    expect(getByText('Ringkasan')).toBeTruthy();
    expect(getByText(/Pengeluaran/)).toBeTruthy();
  });
});
