import { useCallback, useEffect, useState } from 'react';
import { api } from '@/src/api/client';

type TxState = {
  transactions: any[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addOptimistic: (tx: any) => void;
};

let cache: any[] | null = null;
let cacheError: string | null = null;
let inFlight: Promise<any[]> | null = null;
let lastFetch = 0;
const STALE_MS = 30_000;

async function fetchTransactions(): Promise<any[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const r = await api.transactions(undefined, 200);
    const list = r.transactions || [];
    cache = list;
    cacheError = null;
    lastFetch = Date.now();
    return list;
  })();
  try {
    return await inFlight;
  } catch (e: any) {
    cacheError = e?.message || 'Failed to load transactions';
    throw e;
  } finally {
    inFlight = null;
  }
}

export function useTransactions(): TxState {
  const [transactions, setTransactions] = useState<any[]>(() => cache ?? []);
  const [loading, setLoading] = useState(() => cache === null);
  const [error, setError] = useState(() => cacheError ?? '');

  const refresh = useCallback(async () => {
    setError('');
    if (cache === null) setLoading(true);
    try {
      const list = await fetchTransactions();
      setTransactions(list);
      setError('');
    } catch (e: any) {
      const msg = e?.message || 'Failed to load transactions';
      setError(msg);
      if (cache !== null) setTransactions(cache);
    } finally {
      setLoading(false);
    }
  }, []);

  const addOptimistic = useCallback((tx: any) => {
    const optimistic = { ...tx, id: tx.id || `opt-${Date.now()}` };
    cache = cache ? [optimistic, ...cache] : [optimistic];
    setTransactions(cache);
    lastFetch = Date.now();
  }, []);

  useEffect(() => {
    if (cache === null) {
      refresh();
    } else if (Date.now() - lastFetch > STALE_MS) {
      refresh();
    } else {
      setTransactions(cache);
      setError(cacheError ?? '');
      setLoading(false);
    }
  }, [refresh]);

  return { transactions, loading, error, refresh, addOptimistic };
}

export function invalidateTransactionsCache() {
  lastFetch = 0;
  inFlight = null;
}
