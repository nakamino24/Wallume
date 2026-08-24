import { useCallback, useEffect, useState } from 'react';
import { api } from '@/src/api/client';

type WalletsState = {
  wallets: any[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

// Module-level cache — survives navigation, shared across all screens.
// In-memory only (no AsyncStorage for financial data — security).
// Stale-while-revalidate: instant cache hit, background refresh.
let cache: any[] | null = null;
let cacheError: string | null = null;
let inFlight: Promise<any[]> | null = null;
let lastFetch = 0;
const STALE_MS = 30_000;

async function fetchWallets(): Promise<any[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const r = await api.wallets();
    const list = r.wallets || [];
    cache = list;
    cacheError = null;
    lastFetch = Date.now();
    return list;
  })();
  try {
    return await inFlight;
  } catch (e: any) {
    cacheError = e?.message || 'Failed to load wallets';
    throw e;
  } finally {
    inFlight = null;
  }
}

export function useWallets(): WalletsState {
  const [wallets, setWallets] = useState<any[]>(() => cache ?? []);
  const [loading, setLoading] = useState(() => cache === null);
  const [error, setError] = useState(() => cacheError ?? '');

  const refresh = useCallback(async () => {
    setError('');
    // If we have cache, keep it visible and just revalidate in background.
    // Only show loading if no cache yet.
    if (cache === null) setLoading(true);
    try {
      const list = await fetchWallets();
      setWallets(list);
      setError('');
    } catch (e: any) {
      const msg = e?.message || 'Failed to load wallets';
      setError(msg);
      // Keep stale cache visible on error
      if (cache !== null) setWallets(cache);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cache === null) {
      refresh();
    } else if (Date.now() - lastFetch > STALE_MS) {
      refresh();
    } else {
      setWallets(cache);
      setError(cacheError ?? '');
      setLoading(false);
    }
  }, [refresh]);

  return { wallets, loading, error, refresh };
}

export function invalidateWalletsCache() {
  // Keep stale cache visible, just mark as stale so next refresh does background fetch.
  // Previously did cache=null which caused wallet cards to disappear and show loading.
  lastFetch = 0;
  inFlight = null;
}

export function applyOptimisticWalletEffect(walletId: string, toWalletId: string | undefined, type: string, amount: number) {
  if (!cache) return;
  const amt = Number(amount) || 0;
  cache = cache.map((w) => {
    if (w.id === walletId) {
      const delta = type === 'income' ? amt : -amt;
      return { ...w, balance: (Number(w.balance) || 0) + delta, converted_balance: undefined };
    }
    if (type === 'transfer' && w.id === toWalletId) {
      return { ...w, balance: (Number(w.balance) || 0) + amt, converted_balance: undefined };
    }
    return w;
  });
  lastFetch = Date.now();
}
