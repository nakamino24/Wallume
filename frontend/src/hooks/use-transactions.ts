import { useCallback, useEffect, useState } from 'react';
import { api } from '@/src/api/client';
import { storage } from '@/src/utils/storage';

type TxState = {
  transactions: any[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addOptimistic: (tx: any) => void;
};

const STORAGE_KEY = 'mf.transactions.cache.v1';
const STALE_MS = 30_000;

let cache: any[] | null = null;
let cacheError: string | null = null;
let inFlight: Promise<any[]> | null = null;
let lastFetch = 0;

async function loadFromStorage() {
  try {
    const raw = await storage.getItem<string | null>(STORAGE_KEY, null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.transactions)) {
        cache = parsed.transactions;
        lastFetch = parsed.updatedAt || 0;
      }
    }
  } catch {}
}

async function saveToStorage(list: any[]) {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify({ transactions: list, updatedAt: Date.now() }));
  } catch {}
}

async function fetchTransactions(): Promise<any[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const r = await api.transactions(undefined, 200);
    const list = r.transactions || [];
    cache = list;
    cacheError = null;
    lastFetch = Date.now();
    await saveToStorage(list);
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
    let cancelled = false;
    (async () => {
      if (cache === null) {
        await loadFromStorage();
        if (!cancelled && cache !== null) {
          setTransactions(cache);
          setError(cacheError ?? '');
          setLoading(false);
          if (Date.now() - lastFetch > STALE_MS) refresh();
          else return;
        } else if (!cancelled) {
          refresh();
        }
      } else if (Date.now() - lastFetch > STALE_MS) {
        refresh();
      } else {
        setTransactions(cache);
        setError(cacheError ?? '');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  return { transactions, loading, error, refresh, addOptimistic };
}

export function invalidateTransactionsCache() {
  lastFetch = 0;
  inFlight = null;
}
