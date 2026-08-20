import { storage } from '@/src/utils/storage';

const FALLBACK_BASE = 'https://victorious-enthusiasm-production.up.railway.app';
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || FALLBACK_BASE;
const TOKEN_KEY = 'mf.token';

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
  emergentSession: (session_token: string) =>
    req('/auth/emergent-session', { method: 'POST', body: JSON.stringify({ session_token }) }),
  me: () => req('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
  updateMe: (body: any) => req('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAccount: () => req('/auth/me', { method: 'DELETE' }),

  // core
  wallets: () => req('/wallets'),
  createWallet: (body: any) => req('/wallets', { method: 'POST', body: JSON.stringify(body) }),
  updateWallet: (id: string, body: any) => req(`/wallets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWallet: (id: string) => req(`/wallets/${id}`, { method: 'DELETE' }),

  transactions: (type?: string, limit?: number) => {
    let path = `/transactions${type ? `?type=${type}` : ''}`;
    if (limit) path += `${type ? '&' : '?'}limit=${limit}`;
    return req(path);
  },
  createTransaction: (body: any) => req('/transactions', { method: 'POST', body: JSON.stringify(body) }),
  updateTransaction: (id: string, body: any) => req(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTransaction: (id: string) => req(`/transactions/${id}`, { method: 'DELETE' }),

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
