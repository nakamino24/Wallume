import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.6c' } },
}));

jest.mock('@/src/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { onSurface3: '#66736F', muted: '#66736F' } }),
}));

import { AppVersion } from '@/src/components/AppVersion';

describe('AppVersion', () => {
  it('reads the installed app version from Expo metadata', () => {
    const { getByTestId } = render(<AppVersion />);
    expect(getByTestId('app-version').props.children.join('')).toBe('Wallume v1.0.6c');
  });
});
