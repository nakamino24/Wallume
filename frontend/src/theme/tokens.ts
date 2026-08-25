import * as moneyMoney from '@/src/lib/money';

export const palette = {
  light: {
    surface: '#F6F7F3',
    onSurface: '#1C2926',
    surface2: '#FFFFFF',
    onSurface2: '#263431',
    surface3: '#ECF0EA',
    onSurface3: '#66736F',
    inverse: '#164B43',
    onInverse: '#FFFFFF',
    brand: '#164B43',
    brandPrimary: '#287565',
    onBrand: '#FFFFFF',
    brandSoft: '#E2F0EA',
    onBrandSoft: '#164B43',
    success: '#247A57',
    onSuccess: '#FFFFFF',
    warning: '#B86C20',
    onWarning: '#FFFFFF',
    error: '#B64A4A',
    onError: '#FFFFFF',
    info: '#527C8A',
    onInfo: '#FFFFFF',
    border: '#E0E6DF',
    borderStrong: '#C8D3CB',
    muted: '#70807A',
    secondary: '#D69A57',
    onSecondary: '#FFFFFF',
  },
  dark: {
    surface: '#11131A',
    onSurface: '#F2F3F8',
    surface2: '#191D28',
    onSurface2: '#E7E9F0',
    surface3: '#242938',
    onSurface3: '#B1B7C8',
    inverse: '#20283A',
    onInverse: '#F7F8FC',
    brand: '#70C8B1',
    brandPrimary: '#70C8B1',
    onBrand: '#10221F',
    brandSoft: '#213E42',
    onBrandSoft: '#A6E2D1',
    success: '#83D2AA',
    onSuccess: '#FFFFFF',
    warning: '#E3B879',
    onWarning: '#2B210F',
    error: '#F19B9D',
    onError: '#32171B',
    info: '#9EBEE8',
    onInfo: '#17243B',
    border: '#303647',
    borderStrong: '#464E64',
    muted: '#A7AEC0',
    secondary: '#D5AE7A',
    onSecondary: '#FFFFFF',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const font = {
  display: 'Fraunces',
  displayMedium: 'Fraunces-Medium',
  displayBold: 'Fraunces-SemiBold',
  text: 'Inter',
  textMedium: 'Inter-Medium',
  textBold: 'Inter-SemiBold',
  sizes: { sm: 12, base: 15, lg: 18, xl: 26, xxl: 32, display: 40 } as const,
};

export type ThemeMode = 'light' | 'dark';
export type Palette = typeof palette.light;

export const images = {
  wedding: 'https://images.unsplash.com/photo-1680624528924-7ee5542e4f4d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTJ8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwYWVzdGhldGljJTIwbWluaW1hbGlzdGljJTIwcGhvdG98ZW58MHx8fHwxNzgzNzI0OTU0fDA&ixlib=rb-4.1.0&q=85',
  house: 'https://images.unsplash.com/photo-1628012209120-d9db7abf7eab?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBtaW5pbWFsaXN0JTIwYXJjaGl0ZWN0dXJlJTIwaG91c2V8ZW58MHx8fHwxNzgzNzI0OTU0fDA&ixlib=rb-4.1.0&q=85',
  car: 'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w7NDQ2NDN8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBjYXIlMjBzbGVlayUyMGRhcmt8ZW58MHx8fHwxNzgzNzI0OTU0fDA&ixlib=rb-4.1.0&q=85',
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
  // Centralized Indonesian formatter is the single source of truth now.
  return moneyMoney.currencySymbol(code) || CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

export function formatMoney(amount: number, currency: string = 'USD') {
  // Indonesian full format, no compact — e.g. "Rp4.200.000".
  return moneyMoney.formatMoneyFull(amount, currency);
}

export function formatMoneyFull(amount: number, currency: string = 'USD') {
  return moneyMoney.formatMoneyFull(amount, currency);
}

export function formatMoneyCompact(amount: number, currency: string = 'USD') {
  // Compact supporting metrics, e.g. "Rp4,2M".
  return moneyMoney.formatMoneyCompact(amount, currency);
}

// Picks the backend-converted (home-currency) value for an entity field, falling
// back to the original stored value. The backend adds `converted_<field>` when a
// stored item's currency differs from the user's home currency.
export function cv(item: any, field: string): number {
  return Number(item?.[`converted_${field}`] ?? item?.[field] ?? 0);
}
