import * as moneyMoney from '@/src/lib/money';

export const palette = {
  light: {
    surface: '#F8F7F4',
    onSurface: '#222222',
    surface2: '#FFFFFF',
    onSurface2: '#222222',
    surface3: '#F0EFED',
    onSurface3: '#6B7280',
    inverse: '#16213E',
    onInverse: '#FFFFFF',
    brand: '#16213E',
    brandPrimary: '#3FA796',
    onBrand: '#FFFFFF',
    brandSoft: '#E8F5F1',
    onBrandSoft: '#16213E',
    success: '#2E7D32',
    onSuccess: '#FFFFFF',
    warning: '#ED6C02',
    onWarning: '#FFFFFF',
    error: '#D32F2F',
    onError: '#FFFFFF',
    info: '#6B7280',
    onInfo: '#FFFFFF',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    muted: '#6B7280',
    secondary: '#F4A261',
    onSecondary: '#FFFFFF',
  },
  dark: {
    surface: '#0F0F12',
    onSurface: '#F5F5F5',
    surface2: '#1A1A1E',
    onSurface2: '#F5F5F5',
    surface3: '#252528',
    onSurface3: '#9CA3AF',
    inverse: '#FFFFFF',
    onInverse: '#16213E',
    brand: '#3FA796',
    brandPrimary: '#3FA796',
    onBrand: '#FFFFFF',
    brandSoft: '#1A2E2A',
    onBrandSoft: '#3FA796',
    success: '#4CAF50',
    onSuccess: '#FFFFFF',
    warning: '#FF9800',
    onWarning: '#FFFFFF',
    error: '#EF5350',
    onError: '#FFFFFF',
    info: '#9CA3AF',
    onInfo: '#FFFFFF',
    border: '#2A2A2E',
    borderStrong: '#3A3A3E',
    muted: '#9CA3AF',
    secondary: '#F4A261',
    onSecondary: '#FFFFFF',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64 };
export const radius = { sm: 8, md: 12, lg: 16 };

export const font = {
  display: 'System',
  displayMedium: 'System',
  displayBold: 'System',
  text: 'System',
  textMedium: 'System',
  textBold: 'System',
  sizes: { sm: 12, base: 14, lg: 16, xl: 24, xxl: 32, display: 40 } as const,
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
  // Analytics / charts only — compact "Rp4,2M".
  return moneyMoney.formatMoneyCompact(amount, currency);
}

// Picks the backend-converted (home-currency) value for an entity field, falling
// back to the original stored value. The backend adds `converted_<field>` when a
// stored item's currency differs from the user's home currency.
export function cv(item: any, field: string): number {
  return Number(item?.[`converted_${field}`] ?? item?.[field] ?? 0);
}