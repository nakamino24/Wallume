import { storage } from '@/src/utils/storage';

const FALLBACK_BASE = 'https://victorious-enthusiasm-production.up.railway.app';
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || FALLBACK_BASE;
const TOKEN_KEY = 'mf.token';

export type ReportSummary = {
  from_date: string;
  to_date: string;
  transaction_count: number;
  income_total: number;
  expense_total: number;
  net_total: number;
  expense_by_category: { category: string; amount: number }[];
};

export type PasswordResetRequestResult = {
  request_id: string;
  message: string;
};

export type PasswordResetVerifyResult = {
  reset_token: string;
  expires_in: number;
};

export type PasswordResetConfirmResult = {
  message: string;
};

function normalizeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return typeof parsed === 'string' && parsed.trim() ? parsed.trim() : null;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

export async function getToken(): Promise<string | null> {
  const v = await storage.secureGet<string | null>(TOKEN_KEY, null);
  return normalizeToken(v);
}
export async function setToken(t: string | null) {
  if (t) await storage.secureSet(TOKEN_KEY, t);
  else await storage.secureRemove(TOKEN_KEY);
}

export function generateMutationId(): string {
  try {
    // Use crypto.randomUUID if available (React Native 0.71+, modern browsers)
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  } catch {}
  // Fallback: timestamp + random
  return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function req(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = `${BASE.replace(/\/$/, '')}/api${path}`;
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let detail: any = null;
    try {
      const j = await res.json();
      detail = j.detail || j.message || null;
      msg = typeof detail === 'string' ? detail : (detail?.message || msg);
    } catch {}
    const err: any = new Error(msg);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return null;
  const body = await res.json();
  // Unwrap the { success, data } envelope the backend uses, so callers can
  // access `r.token`, `r.wallets`, etc. directly (old flat format is preserved).
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return body.data;
  }
  return body;
}

export const api = {
  // auth
  signup: (body: { email: string; password: string; name: string }) =>
    req('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  requestPasswordReset: (body: { email: string; locale: 'en' | 'id' }): Promise<PasswordResetRequestResult> =>
    req('/auth/password-reset/request', { method: 'POST', body: JSON.stringify(body) }) as Promise<PasswordResetRequestResult>,
  resendPasswordReset: (body: { request_id: string }): Promise<PasswordResetRequestResult> =>
    req('/auth/password-reset/resend', { method: 'POST', body: JSON.stringify(body) }) as Promise<PasswordResetRequestResult>,
  verifyPasswordReset: (body: { request_id: string; code: string }): Promise<PasswordResetVerifyResult> =>
    req('/auth/password-reset/verify', { method: 'POST', body: JSON.stringify(body) }) as Promise<PasswordResetVerifyResult>,
  confirmPasswordReset: (body: {
    reset_token: string;
    new_password: string;
    confirm_password: string;
  }): Promise<PasswordResetConfirmResult> =>
    req('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(body) }) as Promise<PasswordResetConfirmResult>,
  emergentSession: (session_token: string) =>
    req('/auth/emergent-session', { method: 'POST', body: JSON.stringify({ session_token }) }),
  me: () => req('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
  updateMe: (body: any) => req('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAccount: () => req('/auth/me', { method: 'DELETE' }),

  // core
  wallets: () => req('/wallets'),
  createWallet: (body: any) => {
    const mid = generateMutationId();
    const b = { ...body, client_mutation_id: body.client_mutation_id || mid };
    return req('/wallets', { method: 'POST', body: JSON.stringify(b), headers: { 'X-Client-Mutation-Id': mid } });
  },
  updateWallet: (id: string, body: any) => {
    const mid = generateMutationId();
    const b = { ...body, client_mutation_id: body.client_mutation_id || mid };
    return req(`/wallets/${id}`, { method: 'PATCH', body: JSON.stringify(b), headers: { 'X-Client-Mutation-Id': mid } });
  },
  deleteWallet: (id: string) => {
    const mid = generateMutationId();
    return req(`/wallets/${id}`, { method: 'DELETE', headers: { 'X-Client-Mutation-Id': mid } });
  },

  transactions: (type?: string, limit?: number, wallet_id?: string, from_date?: string, to_date?: string) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (limit) params.append('limit', String(limit));
    if (wallet_id) params.append('wallet_id', wallet_id);
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    const qs = params.toString();
    return req(qs ? `/transactions?${qs}` : '/transactions');
  },
  createTransaction: (body: any, mutationId = generateMutationId()) => {
    const mid = mutationId;
    const b = { ...body, client_mutation_id: body.client_mutation_id || mid };
    return req('/transactions', { method: 'POST', body: JSON.stringify(b), headers: { 'X-Client-Mutation-Id': mid } });
  },
  updateTransaction: (id: string, body: any, mutationId = generateMutationId()) => {
    const mid = mutationId;
    const b = { ...body, client_mutation_id: body.client_mutation_id || mid };
    return req(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(b), headers: { 'X-Client-Mutation-Id': mid } });
  },
  deleteTransaction: (id: string, mutationId = generateMutationId()) => {
    const mid = mutationId;
    return req(`/transactions/${id}`, { method: 'DELETE', headers: { 'X-Client-Mutation-Id': mid } });
  },

  reports: {
    getSummary: ({ from_date, to_date }: { from_date: string; to_date: string }): Promise<ReportSummary> => {
      const params = new URLSearchParams({ from_date, to_date });
      return req(`/reports/summary?${params.toString()}`) as Promise<ReportSummary>;
    },
  },

  budgets: () => req('/budgets'),
  createBudget: (body: any) => req('/budgets', { method: 'POST', body: JSON.stringify(body) }),
  deleteBudget: (id: string) => req(`/budgets/${id}`, { method: 'DELETE' }),

  goals: () => req('/goals'),
  createGoal: (body: any) => req('/goals', { method: 'POST', body: JSON.stringify(body) }),
  contributeGoal: (id: string, amount: number) =>
    req(`/goals/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) }),
  deleteGoal: (id: string) => req(`/goals/${id}`, { method: 'DELETE' }),

  plans: () => req('/plans'),
  createPlan: (body: any) => req('/plans', { method: 'POST', body: JSON.stringify(body) }),
  updatePlan: (id: string, body: any) => req(`/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePlan: (id: string) => req(`/plans/${id}`, { method: 'DELETE' }),

  debts: () => req('/debts'),
  createDebt: (body: any) => req('/debts', { method: 'POST', body: JSON.stringify(body) }),
  updateDebt: (id: string, body: any) => req(`/debts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDebt: (id: string) => req(`/debts/${id}`, { method: 'DELETE' }),
  payoffPlan: (extraMonthly: number = 0) => req(`/debts/payoff-plan?extra_monthly=${extraMonthly}`),

  investments: () => req('/investments'),
  createInvestment: (body: any) => req('/investments', { method: 'POST', body: JSON.stringify(body) }),
  updateInvestment: (id: string, body: any) => req(`/investments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteInvestment: (id: string) => req(`/investments/${id}`, { method: 'DELETE' }),

  assets: () => req('/assets'),
  createAsset: (body: any) => req('/assets', { method: 'POST', body: JSON.stringify(body) }),
  deleteAsset: (id: string) => req(`/assets/${id}`, { method: 'DELETE' }),

  recurring: () => req('/recurring'),
  createRecurring: (body: any) => req('/recurring', { method: 'POST', body: JSON.stringify(body) }),
  updateRecurring: (id: string, body: any) => req(`/recurring/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRecurring: (id: string) => req(`/recurring/${id}`, { method: 'DELETE' }),
  markRecurringPaid: (id: string) => req(`/recurring/${id}/mark-paid`, { method: 'POST' }),

  categories: () => req('/categories'),
  createCategory: (body: any) => req('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: string, body: any) => req(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCategory: (id: string) => req(`/categories/${id}`, { method: 'DELETE' }),
  deleteCategoryReassign: (id: string, reassignTo: string) =>
    req(`/categories/${id}?reassign_to=${encodeURIComponent(reassignTo)}`, { method: 'DELETE' }),

  summary: () => req('/analytics/summary'),

  coachHistory: (session_id: string) => req(`/coach/history?session_id=${session_id}`),
  // coach chat uses fetch directly for streaming
  coachChatUrl: () => `${BASE}/api/coach/chat`,
};

export const BASE_URL = BASE;
