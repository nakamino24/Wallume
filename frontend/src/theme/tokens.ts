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
  wedding: 'https://i.pinimg.com/736x/27/5c/b7/275cb72bd46fc5255d6984af0a4083b6.jpg',
  house: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSbK2eqo5HzgTeQxV5ojNLPYIIgQ89h3q3ZQidxAomshwxwVx39LHcsY4no&s=10',
  car: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfHxlqfubEzSNWBs5D4wj8Nl_JN6P_Q1mzJunNTUO6jAj0ihNh3eMceuDK&s=10',
  vacation: 'https://i.pinimg.com/736x/8c/11/4e/8c114ef2759b895083f4cd2886deb57f.jpg',
  emptyWallet: 'https://cdn.vectoricons.net/molmedia/illustrations/DA9569A60DC1/66BA7CF58801/uploads-empty-wallet-wallet-money-empty-purse-lost-money-poor-finance-wallet-void-money-gone-1024.webp',
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

// Currencies that are conventionally shown without decimal places.
const ZERO_DECIMAL_CURRENCIES = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF']);

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
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  return `${sign}${sym}${abs.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
}