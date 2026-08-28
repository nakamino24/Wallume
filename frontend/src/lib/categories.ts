export const DEFAULT_CATEGORIES = {
  income: ['Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Other'],
  expense: ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Rent', 'Groceries', 'Other'],
  transfer: ['Transfer'],
};

export type UserCategory = {
  id: string;
  label: string;
  type: 'income' | 'expense';
  color?: string | null;
  icon?: string | null;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

const SYSTEM_CATEGORY_KEYS = new Map<string, string>(
  [...DEFAULT_CATEGORIES.income, ...DEFAULT_CATEGORIES.expense]
    .map((label): [string, string] => [label.toLowerCase(), `budgets.category.${label.toLowerCase().replace(/\s+/g, '_')}`]),
);

/** Localize only Wallume's canonical system categories; preserve custom user labels verbatim. */
export function systemCategoryLabel(raw: string, translate: Translate): string {
  const key = SYSTEM_CATEGORY_KEYS.get(raw.trim().toLowerCase());
  if (!key) return raw;
  const localized = translate(key);
  return localized === key ? raw : localized;
}

export function mergeCategories(
  type: 'income' | 'expense',
  userCategories: UserCategory[],
): string[] {
  const defaults = type === 'income' ? DEFAULT_CATEGORIES.income : DEFAULT_CATEGORIES.expense;
  const custom = userCategories
    .filter((c) => c.type === type)
    .map((c) => c.label)
    .filter((label) => label && !defaults.includes(label));
  return [...defaults, ...custom];
}

export function iconForCategory(category: string, custom: UserCategory[]): string {
  const match = custom.find((c) => c.label === category);
  if (match?.icon) return match.icon;
  const map: Record<string, string> = {
    Food: 'restaurant', Transport: 'car', Shopping: 'bag-handle',
    Entertainment: 'film', Bills: 'receipt', Health: 'medkit',
    Rent: 'home', Salary: 'cash', Groceries: 'basket',
    Freelance: 'laptop', Investment: 'trending-up', Business: 'briefcase', Gift: 'gift',
    Other: 'ellipsis-horizontal',
  };
  return map[category] || 'ellipsis-horizontal';
}
