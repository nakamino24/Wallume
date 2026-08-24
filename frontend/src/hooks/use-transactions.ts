import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api, generateMutationId } from '@/src/api/client';

type MutationType = 'create' | 'edit' | 'delete';
type PendingMutation = {
  clientMutationId: string;
  sequence: number;
  createdAt: number;
  type: MutationType;
  logicalResourceId: string;
  serverResourceId?: string;
  payload?: any;
  status: 'queued' | 'sending';
};
type Store = { serverSnapshot: any[] | null; pending: PendingMutation[]; failed: PendingMutation[]; error: string; loading: boolean };

const STALE_MS = 30_000;
let store: Store = { serverSnapshot: null, pending: [], failed: [], error: '', loading: false };
let sequence = 0;
let lastFetch = 0;
let generation = 0;
let inFlight: { promise: Promise<void>; generation: number } | null = null;
const listeners = new Set<() => void>();

function publish(next: Store) { store = next; listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function resolveId(mutation: PendingMutation) { return mutation.serverResourceId || mutation.logicalResourceId; }
function deriveTransactions(snapshot = store.serverSnapshot || [], pending = store.pending) {
  let transactions = [...snapshot];
  for (const mutation of [...pending].sort((a, b) => a.sequence - b.sequence)) {
    const id = resolveId(mutation);
    if (mutation.type === 'create') transactions = [{ ...mutation.payload, id: mutation.logicalResourceId }, ...transactions.filter((tx) => tx.id !== id)];
    if (mutation.type === 'edit') transactions = transactions.map((tx) => tx.id === id || tx.id === mutation.logicalResourceId ? { ...tx, ...mutation.payload } : tx);
    if (mutation.type === 'delete') transactions = transactions.filter((tx) => tx.id !== id && tx.id !== mutation.logicalResourceId);
  }
  return transactions;
}
function replacePending(mutator: (pending: PendingMutation[]) => PendingMutation[]) { publish({ ...store, pending: mutator(store.pending) }); }

async function refreshStore() {
  if (inFlight?.generation === generation) {
    return inFlight.promise;
  }
  const requestGeneration = generation;
  publish({ ...store, loading: store.serverSnapshot === null, error: '' });
  const request = api.transactions(undefined, 200);
  const promise = request.then((result) => {
    if (requestGeneration !== generation) return;
    lastFetch = Date.now();
    publish({ ...store, serverSnapshot: result.transactions || [], loading: false, error: '' });
  }).catch((cause: any) => {
    if (requestGeneration !== generation) return;
    publish({ ...store, loading: false, error: cause?.message || 'Failed to load transactions' });
    throw cause;
  }).finally(() => {
    if (inFlight?.promise === promise && inFlight.generation === requestGeneration) inFlight = null;
  });
  inFlight = { promise, generation: requestGeneration };
  return promise;
}
function mergeConfirmed(mutation: PendingMutation, transaction?: any) {
  let snapshot = store.serverSnapshot || [];
  if (mutation.type === 'delete') snapshot = snapshot.filter((tx) => tx.id !== resolveId(mutation));
  if (transaction) snapshot = [transaction, ...snapshot.filter((tx) => tx.id !== transaction.id && tx.id !== mutation.logicalResourceId)];
  publish({ ...store, serverSnapshot: snapshot, pending: store.pending.filter((item) => item.clientMutationId !== mutation.clientMutationId) });
}
function settleFailure(mutation: PendingMutation, cause: any) {
  // A failed create invalidates dependent local operations; later mutations on
  // a confirmed resource remain independently derivable.
  const removed = mutation.type === 'create'
    ? store.pending.filter((item) => item.logicalResourceId !== mutation.logicalResourceId)
    : store.pending.filter((item) => item.clientMutationId !== mutation.clientMutationId);
  // Failed mutations no longer affect derived state, but retain their original
  // mutation ID so a deliberate retry is idempotent at the backend.
  const failed = mutation.type === 'create'
    ? [...store.failed, ...store.pending.filter((item) => item.logicalResourceId === mutation.logicalResourceId)]
    : [...store.failed, mutation];
  publish({ ...store, pending: removed, failed, error: cause?.message || 'Failed to save transaction' });
}
async function sendNext(logicalResourceId: string) {
  const mutation = store.pending.filter((item) => item.logicalResourceId === logicalResourceId && item.status === 'queued').sort((a, b) => a.sequence - b.sequence)[0];
  if (!mutation || store.pending.some((item) => item.logicalResourceId === logicalResourceId && item.status === 'sending')) return;
  replacePending((pending) => pending.map((item) => item.clientMutationId === mutation.clientMutationId ? { ...item, status: 'sending' } : item));
  const requestGeneration = generation;
  try {
    let result: any;
    if (mutation.type === 'create') result = await api.createTransaction(mutation.payload, mutation.clientMutationId);
    else {
      const pendingCreate = store.pending.find((item) => item.type === 'create' && item.logicalResourceId === logicalResourceId);
      // A dependent mutation cannot target an optimistic ID before its create
      // response establishes the authoritative server resource ID.
      if (pendingCreate && !pendingCreate.serverResourceId) return;
      const target = mutation.serverResourceId || pendingCreate?.serverResourceId || logicalResourceId;
      result = mutation.type === 'edit'
        ? await api.updateTransaction(target, mutation.payload, mutation.clientMutationId)
        : await api.deleteTransaction(target, mutation.clientMutationId);
    }
    if (requestGeneration !== generation) return;
    const confirmed = result?.transaction;
    if (mutation.type === 'create' && confirmed) {
      // Retarget dependent queued mutations before the next request is sent.
      replacePending((pending) => pending.map((item) => item.logicalResourceId === logicalResourceId ? { ...item, serverResourceId: confirmed.id } : item));
    }
    mergeConfirmed(mutation, confirmed);
  } catch (cause) {
    if (requestGeneration === generation) settleFailure(mutation, cause);
  } finally {
    if (requestGeneration === generation) await sendNext(logicalResourceId);
  }
}
function enqueue(type: MutationType, logicalResourceId: string, payload?: any) {
  const mutation: PendingMutation = { clientMutationId: generateMutationId(), sequence: ++sequence, createdAt: Date.now(), type, logicalResourceId, payload, status: 'queued' };
  replacePending((pending) => [...pending, mutation]);
  void sendNext(logicalResourceId);
  return mutation.clientMutationId;
}

export function useTransactions() {
  const state = useSyncExternalStore(subscribe, () => store, () => store);
  const refresh = useCallback(async () => { await refreshStore(); }, []);
  useEffect(() => { if (store.serverSnapshot === null || Date.now() - lastFetch > STALE_MS) void refreshStore().catch(() => undefined); }, []);
  const create = useCallback((payload: any) => enqueue('create', `opt_tx_${generateMutationId()}`, payload), []);
  const edit = useCallback((id: string, payload: any) => enqueue('edit', id, payload), []);
  const remove = useCallback((id: string) => enqueue('delete', id), []);
  const retry = useCallback((clientMutationId: string) => {
    const failed = store.failed.find((mutation) => mutation.clientMutationId === clientMutationId);
    if (!failed) return false;
    publish({ ...store, failed: store.failed.filter((mutation) => mutation.clientMutationId !== clientMutationId), pending: [...store.pending, { ...failed, status: 'queued' }], error: '' });
    void sendNext(failed.logicalResourceId);
    return true;
  }, []);
  return { transactions: deriveTransactions(state.serverSnapshot || [], state.pending), loading: state.loading, error: state.error, refresh, create, edit, remove, retry };
}

export function invalidateTransactionsCache() { lastFetch = 0; void refreshStore().catch(() => undefined); }
export function clearTransactionsState() { generation += 1; sequence = 0; lastFetch = 0; inFlight = null; publish({ serverSnapshot: null, pending: [], failed: [], error: '', loading: false }); }
export const __transactionStore = {
  deriveTransactions, clear: clearTransactionsState, getSnapshot: () => store, getGeneration: () => generation,
};
