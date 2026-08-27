import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { formatMoneyCompact, formatMoneyFull, currencySymbol } from '@/src/theme/tokens';
import { useBalancePrivacy } from '@/src/privacy/BalancePrivacyProvider';

type Props = {
  value: number;
  currency?: string;
  // Only balance surfaces opt in. Transaction and informational amounts use the
  // same formatter without inheriting the app balance-visibility preference.
  privacy?: 'balance' | 'none';
  compact?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
};

function maskForCurrency(currency: string): string {
  const sym = currencySymbol(currency);
  // Keep currency context: IDR → Rp•••••••, USD → $••••••
  const dots = currency === 'IDR' ? '•••••••' : '••••••';
  return `${sym}${dots}`;
}

export function MoneyValue({ value, currency = 'USD', privacy = 'none', compact, style, testID, numberOfLines, adjustsFontSizeToFit, minimumFontScale }: Props) {
  const { isBalanceVisible, isPrivacyReady } = useBalancePrivacy();
  const { colors } = useTheme();

  const shouldMask = privacy === 'balance' && isPrivacyReady && !isBalanceVisible;
  // Before readiness, show masked placeholder to avoid flash of sensitive data
  const notReady = privacy === 'balance' && !isPrivacyReady;

  if (notReady || shouldMask) {
    return (
      <Text
        testID={testID}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        minimumFontScale={minimumFontScale}
        style={[{ color: colors.onSurface, fontVariant: ['tabular-nums'] } as TextStyle, style]}
      >
        {maskForCurrency(currency)}
      </Text>
    );
  }

  const formatted = compact ? formatMoneyCompact(value, currency) : formatMoneyFull(value, currency);
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
      style={[{ fontVariant: ['tabular-nums'] } as TextStyle, style]}
    >
      {formatted}
    </Text>
  );
}
