import { useCallback, useEffect, useState } from 'react';
import { api } from '@/src/api/client';
import { mergeCategories, DEFAULT_CATEGORIES, type UserCategory } from '@/src/lib/categories';

export function useUserCategories() {
  const [categories, setCategories] = useState<UserCategory[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.categories();
      setCategories(r.categories || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Optimistically add a just-created category so it appears in the chip list
  // immediately, without waiting on a (silently-failing) network refetch.
  const add = useCallback((cat: UserCategory) => {
    setCategories((prev) =>
      prev.some((c) => c.label === cat.label && c.type === cat.type)
        ? prev
        : [...prev, cat],
    );
  }, []);

  const getOptions = (type: 'income' | 'expense'): string[] => mergeCategories(type, categories);

  const isKnown = (type: 'income' | 'expense', category: string): boolean => {
    return mergeCategories(type, categories).includes(category);
  };

  return { categories, getOptions, isKnown, reload: load, add, defaults: DEFAULT_CATEGORIES };
}