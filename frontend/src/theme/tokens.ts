// Theme tokens sourced from /app/design_guidelines.json
// Personality: iOS-Native Clean × Glass / Luxe DARK. Emerald accent. No blue/purple.

export const palette = {
  light: {
    surface: '#F6F6F6',
    onSurface: '#121212',
    surface2: '#FFFFFF',
    onSurface2: '#171717',
    surface3: '#EAEAEA',
    onSurface3: '#404040',
    inverse: '#121212',
    onInverse: '#F6F6F6',
    brand: '#059669',
    brandPrimary: '#10B981',
    onBrand: '#FFFFFF',
    brandSoft: '#A7F3D0',
    onBrandSoft: '#064E3B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#737373',
    border: '#E5E5E5',
    borderStrong: '#A3A3A3',
    muted: '#737373',
  },
  dark: {
    surface: '#09090B',
    onSurface: '#FAFAFA',
    surface2: '#18181B',
    onSurface2: '#F4F4F5',
    surface3: '#27272A',
    onSurface3: '#D4D4D8',
    inverse: '#FAFAFA',
    onInverse: '#09090B',
    brand: '#10B981',
    brandPrimary: '#10B981',
    onBrand: '#000000',
    brandSoft: '#065F46',
    onBrandSoft: '#D1FAE5',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#A1A1AA',
    border: '#27272A',
    borderStrong: '#3F3F46',
    muted: '#A1A1AA',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, xl: 28, pill: 999 };

export const font = {
  display: 'SpaceGrotesk',
  displayMedium: 'SpaceGrotesk-Medium',
  displayBold: 'SpaceGrotesk-Bold',
  text: 'PlusJakarta',
  textMedium: 'PlusJakarta-Medium',
  textBold: 'PlusJakarta-SemiBold',
};

export type ThemeMode = 'light' | 'dark';
export type Palette = typeof palette.dark;

export const images = {
  wedding: 'https://images.unsplash.com/photo-1680624528924-7ee5542e4f4d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTJ8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwYWVzdGhldGljJTIwbWluaW1hbGlzdGljJTIwcGhvdG98ZW58MHx8fHwxNzgzNzI0OTU0fDA&ixlib=rb-4.1.0&q=85',
  house: 'https://images.unsplash.com/photo-1628012209120-d9db7abf7eab?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBtaW5pbWFsaXN0JTIwYXJjaGl0ZWN0dXJlJTIwaG91c2V8ZW58MHx8fHwxNzgzNzI0OTU0fDA&ixlib=rb-4.1.0&q=85',
  car: 'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NDQ2NDN8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBjYXIlMjBzbGVlayUyMGRhcmt8ZW58MHx8fHwxNzgzNzI0OTU0fDA&ixlib=rb-4.1.0&q=85',
  vacation: 'https://images.unsplash.com/photo-1541417904950-b855846fe074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwdHJvcGljYWwlMjB2YWNhdGlvbiUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3ODM3MjQ5NTR8MA&ixlib=rb-4.1.0&q=85',
  emptyWallet: 'https://images.unsplash.com/photo-1614260938313-a7fc1a7ad0d2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTF8MHwxfHNlYXJjaHwxfHxlbXB0eSUyMHdhbGxldCUyMGlsbHVzdHJhdGlvbiUyMG1pbmltYWx8ZW58MHx8fHwxNzgzNzI0OTU0fDA&ixlib=rb-4.1.0&q=85',
};

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'VND', symbol: '₫', label: 'Vietnamese Dong' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
];

export function currencySymbol(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

export function formatMoney(amount: number, currency: string = 'USD') {
  const sym = currencySymbol(currency);
  const abs = Math.abs(amount);
  const formatted =
    abs >= 1_000_000
      ? (amount / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + 'M'
      : abs >= 10_000
      ? (amount / 1000).toFixed(1) + 'k'
      : amount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  return `${sym}${formatted}`;
}

export function formatMoneyFull(amount: number, currency: string = 'USD') {
  const sym = currencySymbol(currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${sym}${abs.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}
