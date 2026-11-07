import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/src/api/client';

export type TransactionQuery = {
  type?: 'all' | 'income' | 'expense' | 'transfer';
  search?: string;
  wallet_id?: string;
  category?: string;
  from_date?: string;
  to_date?: string;
};

const PAGE_SIZE = 50;

/**
 * Server-driven transaction query with paging.
 *
 * The optimistic `useTransactions` store only holds the most recent window and
 * cannot express search/date/category filters, so filtered views are queried
 * from the API directly. Results are kept page-by-page so "load more" appends
 * rather than replacing what is already on screen.
 */
export function useTransactionQuery(query: TransactionQuery, enabled: boolean) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  // Monotonic token: a slow response from a previous query must never
  // overwrite the results of the query the user has already typed past.
  const requestId = useRef(0);

  const normalized = {
    type: query.type && query.type !== 'all' ? query.type : undefined,
    search: query.search?.trim() || undefined,
    wallet_id: query.wallet_id || undefined,
    category: query.category || undefined,
    from_date: query.from_date || undefined,
    to_date: query.to_date || undefined,
  };

  const key = JSON.stringify(normalized);

  const load = useCallback(async () => {
    if (!enabled) return;
    const token = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result: any = await api.searchTransactions({ ...normalized, limit: PAGE_SIZE, offset: 0 });
      if (token !== requestId.current) return;
      setItems(result?.transactions || []);
      setTotal(result?.total ?? (result?.transactions?.length || 0));
    } catch (cause: any) {
      if (token !== requestId.current) return;
      setError(cause?.message || 'Failed to load transactions');
    } finally {
      if (token === requestId.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [load, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || loading || loadingMore || items.length >= total) return;
    const token = requestId.current;
    setLoadingMore(true);
    try {
      const result: any = await api.searchTransactions({
        ...normalized, limit: PAGE_SIZE, offset: items.length,
      });
      if (token !== requestId.current) return;
      const nextPage = result?.transactions || [];
      setItems((prev) => {
        const seen = new Set(prev.map((tx: any) => tx.id));
        return [...prev, ...nextPage.filter((tx: any) => !seen.has(tx.id))];
      });
      setTotal(result?.total ?? total);
    } catch (cause: any) {
      if (token === requestId.current) setError(cause?.message || 'Failed to load transactions');
    } finally {
      if (token === requestId.current) setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loading, loadingMore, items.length, total, key]);

  return {
    transactions: items,
    total,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    reload: load,
    loadMore,
  };
}
