import React from 'react';
import { Text, View } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

jest.mock('@/src/api/client', () => ({
  api: {
    transactions: jest.fn(),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
  },
  generateMutationId: jest.fn(),
}));

import { useTransactions, clearTransactionsState, __transactionStore } from '@/src/hooks/use-transactions';
import { api as importedApi } from '@/src/api/client';

const mockTransactions = importedApi.transactions as jest.Mock;
const mockCreateTransaction = importedApi.createTransaction as jest.Mock;
const mockUpdateTransaction = importedApi.updateTransaction as jest.Mock;
const mockDeleteTransaction = importedApi.deleteTransaction as jest.Mock;
let mutationSequence = 0;
(require('@/src/api/client').generateMutationId as jest.Mock).mockImplementation(() => `mutation-${++mutationSequence}`);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function Consumer({ onState }: { onState: (state: any) => void }) {
  const state = useTransactions();
  onState(state);
  return <View><Text testID="transaction-count">{state.transactions.length}</Text>{state.transactions.map((transaction: any) => <Text key={transaction.id}>{transaction.id}</Text>)}</View>;
}

describe('transaction external store', () => {
  let mounted: ReturnType<typeof render>[];

  beforeEach(() => {
    clearTransactionsState();
    jest.clearAllMocks();
    mockTransactions.mockReset();
    mockCreateTransaction.mockReset();
    mockUpdateTransaction.mockReset();
    mockDeleteTransaction.mockReset();
    mutationSequence = 0;
    mounted = [];
  });

  afterEach(async () => {
    await act(async () => { mounted.forEach((view) => view.unmount()); await Promise.resolve(); });
    clearTransactionsState();
  });

  async function mountWithInitialTransactions(transactions: any[] = []) {
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    let state: any;
    const view = render(<Consumer onState={(next) => { state = next; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions }); await Promise.resolve(); });
    await waitFor(() => expect(state.loading).toBe(false));
    return state;
  }

  it('reconciles a dependent edit only after its create confirms', async () => {
    let first: any; let second: any;
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    const view = render(<><Consumer onState={(state) => { first = state; }} /><Consumer onState={(state) => { second = state; }} /></>);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(first.loading).toBe(false));
    const createRequest = deferred<any>();
    const editRequest = deferred<any>();
    mockCreateTransaction.mockReturnValueOnce(createRequest.promise);
    mockUpdateTransaction.mockReturnValueOnce(editRequest.promise);
    act(() => { first.create({ amount: 50000, type: 'expense', description: 'Lunch', wallet_id: 'w' }); });
    expect(first.transactions).toHaveLength(1);
    expect(second.transactions[0]).toMatchObject({ amount: 50000, description: 'Lunch' });
    const tempId = first.transactions[0].id;
    act(() => { first.edit(tempId, { amount: 75000, description: 'Lunch with team' }); });
    expect(second.transactions).toHaveLength(1);
    expect(second.transactions[0]).toMatchObject({ amount: 75000, description: 'Lunch with team' });
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
    const createMutationId = __transactionStore.getSnapshot().pending.find((mutation: any) => mutation.type === 'create')!.clientMutationId;
    const editMutationId = __transactionStore.getSnapshot().pending.find((mutation: any) => mutation.type === 'edit')!.clientMutationId;
    expect(createMutationId).not.toBe(editMutationId);
    await act(async () => { createRequest.resolve({ transaction: { id: 'tx_123', amount: 50000, type: 'expense', description: 'Lunch', wallet_id: 'w' } }); await Promise.resolve(); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(1));
    const [, updatePayload, updateMutationId] = mockUpdateTransaction.mock.calls[0];
    expect(mockUpdateTransaction.mock.calls[0][0]).toBe('tx_123');
    expect(updatePayload).toEqual({ amount: 75000, description: 'Lunch with team' });
    expect(updateMutationId).toEqual(expect.any(String));
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ id: 'tx_123', amount: 50000, description: 'Lunch' });
    expect(second.transactions[0]).toMatchObject({ id: 'tx_123', amount: 75000, description: 'Lunch with team' });
    await act(async () => { editRequest.resolve({ transaction: { id: 'tx_123', amount: 75000, type: 'expense', description: 'Lunch with team', wallet_id: 'w' } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(first.transactions).toHaveLength(1);
    expect(second.transactions).toHaveLength(1);
    expect(second.transactions[0]).toMatchObject({ id: 'tx_123', amount: 75000, description: 'Lunch with team' });
  });

  it('shows an optimistic create before reconciling its authoritative transaction', async () => {
    let latest: any;
    const initial = deferred<any>(); const create = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockCreateTransaction.mockReturnValueOnce(create.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.loading).toBe(false));
    expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: [], pending: [], failed: [] });
    act(() => { latest.create({ amount: 50000, type: 'expense', description: 'Lunch', wallet_id: 'wallet-1' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    const tempId = latest.transactions[0].id;
    expect(tempId).toEqual(expect.any(String));
    expect(latest.transactions[0]).toMatchObject({ amount: 50000, type: 'expense', description: 'Lunch' });
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
    expect(__transactionStore.getSnapshot().pending).toHaveLength(1);
    expect(__transactionStore.getSnapshot().pending[0].clientMutationId).toEqual(expect.any(String));
    await act(async () => { create.resolve({ transaction: { id: 'tx_real_001', amount: 50000, type: 'expense', description: 'Lunch', wallet_id: 'wallet-1' } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
    expect(latest.transactions).toHaveLength(1);
    expect(latest.transactions[0]).toMatchObject({ id: 'tx_real_001', amount: 50000, description: 'Lunch' });
    expect(latest.transactions.map((transaction: any) => transaction.id)).not.toContain(tempId);
    expect(__transactionStore.getSnapshot()).toMatchObject({ failed: [] });
    expect(view.queryByText(tempId)).toBeNull();
  });

  it('removes an optimistic create when its request fails', async () => {
    let latest: any;
    const initial = deferred<any>(); const create = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockCreateTransaction.mockReturnValueOnce(create.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.loading).toBe(false));
    act(() => { latest.create({ amount: 50000, type: 'expense', description: 'Lunch', wallet_id: 'wallet-1' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    const tempId = latest.transactions[0].id;
    expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: [] });
    expect(__transactionStore.getSnapshot().pending).toHaveLength(1);
    await act(async () => { create.reject(new Error('request failed')); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
    expect(latest.transactions).toEqual([]);
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
    expect(__transactionStore.getSnapshot().failed).toHaveLength(1);
    expect(__transactionStore.getSnapshot().failed[0]).toMatchObject({ logicalResourceId: tempId, type: 'create' });
    expect(view.queryByText(tempId)).toBeNull();
  });

  it('keeps an optimistic create visible when a refresh omits it', async () => {
    let latest: any;
    const initial = deferred<any>(); const refresh = deferred<any>(); const create = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise).mockReturnValueOnce(refresh.promise);
    mockCreateTransaction.mockReturnValueOnce(create.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.loading).toBe(false));
    act(() => { latest.create({ amount: 50000, type: 'expense', description: 'Lunch', wallet_id: 'wallet-1' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    const optimistic = latest.transactions[0];
    const pendingBeforeRefresh = __transactionStore.getSnapshot().pending[0];
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
    act(() => { void latest.refresh(); });
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(2));
    await act(async () => { refresh.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    expect(latest.transactions[0].id).toBe(optimistic.id);
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
    expect(__transactionStore.getSnapshot().pending[0]).toMatchObject({ clientMutationId: pendingBeforeRefresh.clientMutationId, logicalResourceId: pendingBeforeRefresh.logicalResourceId, sequence: pendingBeforeRefresh.sequence });
    await act(async () => { create.resolve({ transaction: { id: 'tx_refresh_create_1', amount: 50000, type: 'expense', description: 'Lunch', wallet_id: 'wallet-1' } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(latest.transactions).toHaveLength(1);
    expect(latest.transactions[0].id).toBe('tx_refresh_create_1');
    expect(latest.transactions.map((transaction: any) => transaction.id)).not.toContain(optimistic.id);
    expect(view.queryByText('tx_refresh_create_1')).toBeTruthy();
  });

  it('keeps an optimistic edit visible when a refresh returns the old value', async () => {
    let latest: any;
    const initial = deferred<any>(); const refresh = deferred<any>(); const edit = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise).mockReturnValueOnce(refresh.promise);
    mockUpdateTransaction.mockReturnValueOnce(edit.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_refresh_edit_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.amount).toBe(100));
    act(() => { latest.edit('tx_refresh_edit_1', { amount: 200, description: 'Edited' }); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(1));
    const pendingBeforeRefresh = __transactionStore.getSnapshot().pending[0];
    expect(latest.transactions[0]).toMatchObject({ amount: 200, description: 'Edited' });
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 100, description: 'Original' });
    act(() => { void latest.refresh(); });
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(2));
    await act(async () => { refresh.resolve({ transactions: [{ id: 'tx_refresh_edit_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]).toMatchObject({ amount: 200, description: 'Edited' }));
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 100, description: 'Original' });
    expect(__transactionStore.getSnapshot().pending[0]).toMatchObject({ clientMutationId: pendingBeforeRefresh.clientMutationId, logicalResourceId: 'tx_refresh_edit_1', sequence: pendingBeforeRefresh.sequence });
    expect(mockUpdateTransaction).toHaveBeenCalledTimes(1);
    await act(async () => { edit.resolve({ transaction: { id: 'tx_refresh_edit_1', amount: 200, description: 'Edited' } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 200, description: 'Edited' });
    expect(latest.transactions[0]).toMatchObject({ amount: 200, description: 'Edited' });
    expect(view.queryByText('tx_refresh_edit_1')).toBeTruthy();
  });

  it('keeps an optimistic delete hidden when a refresh returns it', async () => {
    let latest: any;
    const initial = deferred<any>(); const refresh = deferred<any>(); const remove = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise).mockReturnValueOnce(refresh.promise);
    mockDeleteTransaction.mockReturnValueOnce(remove.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_refresh_delete_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.id).toBe('tx_refresh_delete_1'));
    act(() => { latest.remove('tx_refresh_delete_1'); });
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledTimes(1));
    const pendingBeforeRefresh = __transactionStore.getSnapshot().pending[0];
    expect(latest.transactions).toEqual([]);
    expect(__transactionStore.getSnapshot().serverSnapshot![0].id).toBe('tx_refresh_delete_1');
    act(() => { void latest.refresh(); });
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(2));
    await act(async () => { refresh.resolve({ transactions: [{ id: 'tx_refresh_delete_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions).toEqual([]));
    expect(__transactionStore.getSnapshot().serverSnapshot![0].id).toBe('tx_refresh_delete_1');
    expect(__transactionStore.getSnapshot().pending[0]).toMatchObject({ clientMutationId: pendingBeforeRefresh.clientMutationId, logicalResourceId: 'tx_refresh_delete_1', sequence: pendingBeforeRefresh.sequence, type: 'delete' });
    expect(mockDeleteTransaction).toHaveBeenCalledTimes(1);
    await act(async () => { remove.resolve(null); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
    expect(latest.transactions).toEqual([]);
    expect(view.queryByText('tx_refresh_delete_1')).toBeNull();
  });

  it('publishes optimistic create reconciliation to independent shared subscribers', async () => {
    let home: any; let transactions: any;
    const initial = deferred<any>(); const create = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockCreateTransaction.mockReturnValueOnce(create.promise);
    const view = render(<><Consumer onState={(state) => { home = state; }} /><Consumer onState={(state) => { transactions = state; }} /></>);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(home.loading).toBe(false));
    expect(home.transactions).toEqual([]);
    expect(transactions.transactions).toEqual([]);
    act(() => { transactions.create({ amount: 50000, type: 'expense', description: 'Shared lunch', wallet_id: 'wallet-1' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(home.transactions).toHaveLength(1));
    const optimisticId = home.transactions[0].id;
    expect(home.transactions[0]).toMatchObject({ id: optimisticId, amount: 50000, description: 'Shared lunch' });
    expect(transactions.transactions[0]).toMatchObject({ id: optimisticId, amount: 50000, description: 'Shared lunch' });
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
    expect(__transactionStore.getSnapshot().pending).toHaveLength(1);
    await act(async () => { create.resolve({ transaction: { id: 'tx_shared_real_1', amount: 50000, type: 'expense', description: 'Shared lunch', wallet_id: 'wallet-1' } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(home.transactions).toHaveLength(1);
    expect(transactions.transactions).toHaveLength(1);
    expect(home.transactions[0]).toMatchObject({ id: 'tx_shared_real_1', amount: 50000, description: 'Shared lunch' });
    expect(transactions.transactions[0]).toMatchObject({ id: 'tx_shared_real_1', amount: 50000, description: 'Shared lunch' });
    expect(home.transactions.map((transaction: any) => transaction.id)).not.toContain(optimisticId);
    expect(transactions.transactions.map((transaction: any) => transaction.id)).not.toContain(optimisticId);
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
  });

  it('waits for create reconciliation before deleting a dependent optimistic transaction', async () => {
    let latest: any;
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.loading).toBe(false));
    const create = deferred<any>(); const remove = deferred<any>();
    mockCreateTransaction.mockReturnValueOnce(create.promise);
    mockDeleteTransaction.mockReturnValueOnce(remove.promise);
    act(() => { latest.create({ amount: 10, type: 'expense', wallet_id: 'w' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    const tempId = latest.transactions[0].id;
    act(() => { latest.remove(tempId); });
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
    await act(async () => { create.resolve({ transaction: { id: 'tx_real_delete', amount: 10 } }); await Promise.resolve(); });
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledTimes(1));
    expect(mockDeleteTransaction.mock.calls[0][0]).toBe('tx_real_delete');
    await act(async () => { remove.resolve(null); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
  });

  it('cancels a dependent delete when its create fails', async () => {
    let latest: any;
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.loading).toBe(false));
    const create = deferred<any>();
    mockCreateTransaction.mockReturnValueOnce(create.promise);
    act(() => { latest.create({ amount: 10, type: 'expense', wallet_id: 'w' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    const tempId = latest.transactions[0].id;
    act(() => { latest.remove(tempId); });
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
    await act(async () => { create.reject(new Error('create failed')); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
  });

  it('removes a failed create and prevents its dependent edit from sending', async () => {
    let latest: any;
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.loading).toBe(false));
    const request = deferred<any>();
    mockCreateTransaction.mockReturnValueOnce(request.promise);
    act(() => { latest.create({ amount: 100, type: 'expense', wallet_id: 'w' }); });
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    const tempId = latest.transactions[0].id;
    act(() => { latest.edit(tempId, { amount: 200 }); });
    await act(async () => { request.reject(new Error('offline')); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions).toHaveLength(0));
    expect(mockUpdateTransaction).not.toHaveBeenCalled();
    expect(__transactionStore.getSnapshot().pending).toHaveLength(0);
    expect(view.queryByText(tempId)).toBeNull();
  });

  it('keeps pending edits applied when refresh returns older server data', async () => {
    mockTransactions.mockResolvedValueOnce({ transactions: [{ id: 'tx', amount: 100 }] }).mockResolvedValueOnce({ transactions: [{ id: 'tx', amount: 100 }] });
    let latest: any;
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(latest.transactions[0]?.amount).toBe(100));
    const request = deferred<any>();
    mockUpdateTransaction.mockReturnValueOnce(request.promise);
    act(() => { latest.edit('tx', { amount: 200 }); });
    expect(latest.transactions[0].amount).toBe(200);
    await act(async () => { await latest.refresh(); });
    expect(__transactionStore.getSnapshot().serverSnapshot![0].amount).toBe(100);
    expect(latest.transactions[0].amount).toBe(200);
  });

  it('clears confirmed and pending financial state on logout cleanup', async () => {
    let latest: any;
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'user-a', amount: 100 }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions).toHaveLength(1));
    act(() => { clearTransactionsState(); });
    expect(latest.transactions).toHaveLength(0);
    expect(__transactionStore.getSnapshot().pending).toHaveLength(0);
    expect(view.queryByText('user-a')).toBeNull();
  });

  it('serializes two edits and retains the newer derived value after the older response', async () => {
    let latest: any;
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_edit_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.amount).toBe(100));
    const first = deferred<any>(); const second = deferred<any>();
    mockUpdateTransaction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => { latest.edit('tx_edit_1', { amount: 200, description: 'Edit 1' }); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(1));
    expect(latest.transactions[0]).toMatchObject({ amount: 200, description: 'Edit 1' });
    act(() => { latest.edit('tx_edit_1', { amount: 300, description: 'Edit 2' }); });
    expect(latest.transactions[0]).toMatchObject({ amount: 300, description: 'Edit 2' });
    expect(mockUpdateTransaction).toHaveBeenCalledTimes(1);
    expect(__transactionStore.getSnapshot().pending.map((item: any) => item.sequence)).toEqual([1, 2]);
    await act(async () => { first.resolve({ transaction: { id: 'tx_edit_1', amount: 200, description: 'Edit 1' } }); await Promise.resolve(); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(2));
    expect(mockUpdateTransaction.mock.calls[1]).toEqual(['tx_edit_1', { amount: 300, description: 'Edit 2' }, expect.any(String)]);
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 200, description: 'Edit 1' });
    expect(latest.transactions[0]).toMatchObject({ amount: 300, description: 'Edit 2' });
    await act(async () => { second.resolve({ transaction: { id: 'tx_edit_1', amount: 300, description: 'Edit 2' } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 300, description: 'Edit 2' });
  });

  it('continues a newer edit after the earlier edit fails', async () => {
    let latest: any;
    const initial = deferred<any>(); const first = deferred<any>(); const second = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockUpdateTransaction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_edit_fail_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.amount).toBe(100));
    act(() => { latest.edit('tx_edit_fail_1', { amount: 200, description: 'Edit 1' }); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(1));
    act(() => { latest.edit('tx_edit_fail_1', { amount: 300, description: 'Edit 2' }); });
    expect(latest.transactions[0]).toMatchObject({ amount: 300, description: 'Edit 2' });
    expect(__transactionStore.getSnapshot().pending.map((mutation: any) => mutation.sequence)).toEqual([1, 2]);
    await act(async () => { first.reject(new Error('first edit failed')); await Promise.resolve(); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(2));
    expect(mockUpdateTransaction.mock.calls[1]).toEqual(['tx_edit_fail_1', { amount: 300, description: 'Edit 2' }, expect.any(String)]);
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 100, description: 'Original' });
    expect(latest.transactions[0]).toMatchObject({ amount: 300, description: 'Edit 2' });
    expect(__transactionStore.getSnapshot().failed).toHaveLength(1);
    await act(async () => { second.resolve({ transaction: { id: 'tx_edit_fail_1', amount: 300, description: 'Edit 2' } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 300, description: 'Edit 2' });
    expect(latest.transactions[0]).toMatchObject({ amount: 300, description: 'Edit 2' });
    expect(view.queryByText('tx_edit_fail_1')).toBeTruthy();
  });

  it('keeps an optimistic delete authoritative while an earlier edit settles', async () => {
    let latest: any;
    const initial = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_edit_delete_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.id).toBe('tx_edit_delete_1'));
    const edit = deferred<any>(); const remove = deferred<any>();
    mockUpdateTransaction.mockReturnValueOnce(edit.promise);
    mockDeleteTransaction.mockReturnValueOnce(remove.promise);
    act(() => { latest.edit('tx_edit_delete_1', { amount: 200, description: 'Edited' }); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(1));
    act(() => { latest.remove('tx_edit_delete_1'); });
    expect(latest.transactions).toHaveLength(0);
    expect(mockDeleteTransaction).not.toHaveBeenCalled();
    expect(__transactionStore.getSnapshot().pending.map((mutation: any) => mutation.type)).toEqual(['edit', 'delete']);
    await act(async () => { edit.resolve({ transaction: { id: 'tx_edit_delete_1', amount: 200, description: 'Edited' } }); await Promise.resolve(); });
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledTimes(1));
    expect(mockDeleteTransaction.mock.calls[0][0]).toBe('tx_edit_delete_1');
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ amount: 200, description: 'Edited' });
    expect(latest.transactions).toHaveLength(0);
    await act(async () => { remove.resolve(null); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(__transactionStore.getSnapshot().serverSnapshot).toEqual([]);
    expect(latest.transactions).toHaveLength(0);
    expect(view.queryByText('tx_edit_delete_1')).toBeNull();
  });

  it('restores a failed optimistic delete from the authoritative snapshot', async () => {
    let latest: any;
    const initial = deferred<any>(); const remove = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockDeleteTransaction.mockReturnValueOnce(remove.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_delete_fail_1', amount: 100, description: 'Original' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.id).toBe('tx_delete_fail_1'));
    act(() => { latest.remove('tx_delete_fail_1'); });
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledWith('tx_delete_fail_1', expect.any(String)));
    expect(latest.transactions).toEqual([]);
    expect(__transactionStore.getSnapshot().serverSnapshot![0]).toMatchObject({ id: 'tx_delete_fail_1', amount: 100, description: 'Original' });
    expect(__transactionStore.getSnapshot().pending).toHaveLength(1);
    await act(async () => { remove.reject(new Error('delete failed')); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(mockDeleteTransaction).toHaveBeenCalledTimes(1);
    expect(latest.transactions).toHaveLength(1);
    expect(latest.transactions[0]).toMatchObject({ id: 'tx_delete_fail_1', amount: 100, description: 'Original' });
    expect(__transactionStore.getSnapshot().serverSnapshot).toHaveLength(1);
    expect(__transactionStore.getSnapshot().failed).toHaveLength(1);
    expect(view.queryByText('tx_delete_fail_1')).toBeTruthy();
  });

  it('retries a failed logical mutation with its original client mutation ID', async () => {
    let latest: any;
    const initial = deferred<any>(); const first = deferred<any>(); const retry = deferred<any>(); const next = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockCreateTransaction.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise).mockReturnValueOnce(next.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.loading).toBe(false));
    act(() => { latest.create({ amount: 100, type: 'expense', wallet_id: 'w' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    const mutationId = mockCreateTransaction.mock.calls[0][1];
    await act(async () => { first.reject(new Error('offline')); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().failed).toHaveLength(1));
    expect(__transactionStore.getSnapshot().failed[0].clientMutationId).toBe(mutationId);
    act(() => { expect(latest.retry(mutationId)).toBe(true); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(2));
    expect(mockCreateTransaction.mock.calls[1][1]).toBe(mutationId);
    expect(__transactionStore.getSnapshot().pending).toHaveLength(1);
    expect(__transactionStore.getSnapshot().failed).toHaveLength(0);
    await act(async () => { retry.resolve({ transaction: { id: 'tx_retry_1', amount: 100 } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    act(() => { latest.create({ amount: 20, type: 'income', wallet_id: 'w' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(3));
    expect(mockCreateTransaction.mock.calls[2][1]).not.toBe(mutationId);
    await act(async () => { next.resolve({ transaction: { id: 'tx_retry_2', amount: 20 } }); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot().pending).toHaveLength(0));
    expect(__transactionStore.getSnapshot().failed).toHaveLength(0);
    expect(view.queryByText('tx_retry_1')).toBeTruthy();
  });

  it('isolates a new generation from an unresolved prior refresh', async () => {
    const requestA = deferred<any>();
    const requestB = deferred<any>();
    mockTransactions.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    let first: any; let second: any;
    const renderSpy = jest.fn();
    function TracedConsumer({ onState }: { onState: (state: any) => void }) {
      renderSpy();
      onState(useTransactions());
      return null;
    }
    const firstView = render(<TracedConsumer onState={(state) => { first = state; }} />);
    mounted.push(firstView);
    expect(renderSpy).toHaveBeenCalled();
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    expect(first.loading).toBe(true);

    act(() => { clearTransactionsState(); });
    const secondView = render(<Consumer onState={(state) => { second = state; }} />);
    mounted.push(secondView);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(2));

    await act(async () => { requestA.resolve({ transactions: [{ id: 'tx_user_a', amount: 1 }] }); await Promise.resolve(); });
    expect(__transactionStore.getSnapshot().serverSnapshot).toBeNull();
    expect(second.transactions).toHaveLength(0);
    await act(async () => { requestB.resolve({ transactions: [{ id: 'tx_user_b', amount: 2 }] }); await Promise.resolve(); });
    await waitFor(() => expect(second.transactions[0]?.id).toBe('tx_user_b'));
    expect(second.transactions.map((transaction: any) => transaction.id)).not.toContain('tx_user_a');
  });

  it('keeps the current generation refresh in flight after an older request settles', async () => {
    const requestA = deferred<any>(); const requestB = deferred<any>();
    mockTransactions.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    let latest: any;
    mounted.push(render(<Consumer onState={(state) => { latest = state; }} />));
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    act(() => { clearTransactionsState(); });
    mounted.push(render(<Consumer onState={(state) => { latest = state; }} />));
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(2));
    await act(async () => { requestA.resolve({ transactions: [{ id: 'tx_user_a' }] }); await Promise.resolve(); });
    let dedupedRefresh!: Promise<void>;
    act(() => { dedupedRefresh = latest.refresh(); });
    expect(mockTransactions).toHaveBeenCalledTimes(2);
    await act(async () => { requestB.resolve({ transactions: [{ id: 'tx_user_b' }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.id).toBe('tx_user_b'));
    await act(async () => { await dedupedRefresh; });
  });

  it('clears subscriber-visible state immediately', async () => {
    const state = await mountWithInitialTransactions([{ id: 'tx_user_a', amount: 10 }]);
    const view = mounted[mounted.length - 1];
    expect(view.getByText('tx_user_a')).toBeTruthy();
    act(() => { clearTransactionsState(); });
    await waitFor(() => expect(view.queryByText('tx_user_a')).toBeNull());
    expect(view.getByTestId('transaction-count').props.children).toBe(0);
    expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: null, pending: [], failed: [] });
  });

  it('ignores a stale refresh rejection after a generation clear', async () => {
    const requestA = deferred<any>(); const requestB = deferred<any>();
    mockTransactions.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    let first: any; let second: any;
    mounted.push(render(<Consumer onState={(state) => { first = state; }} />));
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    act(() => { clearTransactionsState(); });
    mounted.push(render(<Consumer onState={(state) => { second = state; }} />));
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(2));
    await act(async () => { requestA.reject(new Error('old session')); await Promise.resolve(); });
    expect(__transactionStore.getSnapshot().error).toBe('');
    expect(second.transactions).toEqual([]);
    await act(async () => { requestB.resolve({ transactions: [{ id: 'tx_user_b' }] }); await Promise.resolve(); });
    await waitFor(() => expect(second.transactions[0]?.id).toBe('tx_user_b'));
  });

  it('does not allow a failed retry to cross a generation', async () => {
    const state = await mountWithInitialTransactions();
    mockCreateTransaction.mockRejectedValueOnce(new Error('offline'));
    act(() => { state.create({ amount: 10, type: 'expense', wallet_id: 'w' }); });
    await waitFor(() => expect(__transactionStore.getSnapshot().failed).toHaveLength(1));
    const mutationId = __transactionStore.getSnapshot().failed[0].clientMutationId;
    act(() => { clearTransactionsState(); });
    expect(state.retry(mutationId)).toBe(false);
    expect(__transactionStore.getSnapshot().failed).toHaveLength(0);
  });

  it('starts a fresh refresh for the next generation', async () => {
    const requestA = deferred<any>(); const requestB = deferred<any>();
    mockTransactions.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    mounted.push(render(<Consumer onState={() => undefined} />));
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    act(() => { clearTransactionsState(); });
    mounted.push(render(<Consumer onState={() => undefined} />));
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(2));
    await act(async () => { requestA.resolve({ transactions: [] }); requestB.resolve({ transactions: [] }); await Promise.resolve(); });
  });

  it('ignores a stale create success after clear', async () => {
    const state = await mountWithInitialTransactions([{ id: 'tx_user_a', amount: 100 }]);
    const create = deferred<any>();
    mockCreateTransaction.mockReturnValueOnce(create.promise);
    act(() => { state.create({ amount: 10, type: 'expense', wallet_id: 'w' }); });
    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    act(() => { clearTransactionsState(); });
    await act(async () => { create.resolve({ transaction: { id: 'tx_user_a_created' } }); await Promise.resolve(); });
    expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: null, pending: [], failed: [] });
  });

  it('ignores a stale edit success after clear', async () => {
    const edit = deferred<any>();
    const editState = await mountWithInitialTransactions([{ id: 'tx_user_a', amount: 100 }]);
    mockUpdateTransaction.mockReturnValueOnce(edit.promise);
    act(() => { editState.edit('tx_user_a', { amount: 200 }); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledTimes(1));
    act(() => { clearTransactionsState(); });
    await act(async () => { edit.resolve({ transaction: { id: 'tx_user_a', amount: 200 } }); await Promise.resolve(); });
    expect(__transactionStore.getSnapshot().serverSnapshot).toBeNull();
  });

  it('ignores a stale delete success after clear', async () => {
    const remove = deferred<any>();
    const deleteState = await mountWithInitialTransactions([{ id: 'tx_user_a', amount: 100 }]);
    mockDeleteTransaction.mockReturnValueOnce(remove.promise);
    act(() => { deleteState.remove('tx_user_a'); });
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledTimes(1));
    act(() => { clearTransactionsState(); });
    await act(async () => { remove.resolve(null); await Promise.resolve(); });
    expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: null, pending: [], failed: [] });
  });

  it('ignores a confirmed transaction delete success after its generation is cleared', async () => {
    let latest: any;
    const initial = deferred<any>(); const remove = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockDeleteTransaction.mockReturnValueOnce(remove.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_user_a', amount: 100 }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.id).toBe('tx_user_a'));
    act(() => { latest.remove('tx_user_a'); });
    await waitFor(() => expect(mockDeleteTransaction).toHaveBeenCalledWith('tx_user_a', expect.any(String)));
    expect(latest.transactions).toHaveLength(0);
    act(() => { clearTransactionsState(); });
    await waitFor(() => expect(view.queryByText('tx_user_a')).toBeNull());
    expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: null, pending: [], failed: [] });
    await act(async () => { remove.resolve(null); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: null, pending: [], failed: [] }));
    expect(view.queryByText('tx_user_a')).toBeNull();
  });

  it('ignores a confirmed transaction edit failure after its generation is cleared', async () => {
    let latest: any;
    const initial = deferred<any>(); const edit = deferred<any>();
    mockTransactions.mockReturnValueOnce(initial.promise);
    mockUpdateTransaction.mockReturnValueOnce(edit.promise);
    const view = render(<Consumer onState={(state) => { latest = state; }} />);
    mounted.push(view);
    await waitFor(() => expect(mockTransactions).toHaveBeenCalledTimes(1));
    await act(async () => { initial.resolve({ transactions: [{ id: 'tx_user_a', amount: 100 }] }); await Promise.resolve(); });
    await waitFor(() => expect(latest.transactions[0]?.amount).toBe(100));
    act(() => { latest.edit('tx_user_a', { amount: 200 }); });
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledWith('tx_user_a', { amount: 200 }, expect.any(String)));
    expect(latest.transactions[0].amount).toBe(200);
    act(() => { clearTransactionsState(); });
    await waitFor(() => expect(view.queryByText('tx_user_a')).toBeNull());
    await act(async () => { edit.reject(new Error('old session failure')); await Promise.resolve(); });
    await waitFor(() => expect(__transactionStore.getSnapshot()).toMatchObject({ serverSnapshot: null, pending: [], failed: [], error: '' }));
    expect(view.queryByText('tx_user_a')).toBeNull();
  });
});
