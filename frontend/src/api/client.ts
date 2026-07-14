import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'mf.token';

export async function getToken(): Promise<string | null> {
  const v = await storage.secureGet<string | null>(TOKEN_KEY, null);
  return typeof v === 'string' && v.length > 0 ? v : null;
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
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j.detail || j.message || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
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

  // core
  wallets: () => req('/wallets'),
  createWallet: (body: any) => req('/wallets', { method: 'POST', body: JSON.stringify(body) }),
  updateWallet: (id: string, body: any) => req(`/wallets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWallet: (id: string) => req(`/wallets/${id}`, { method: 'DELETE' }),

  transactions: (type?: string) => req(`/transactions${type ? `?type=${type}` : ''}`),
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
  deleteDebt: (id: string) => req(`/debts/${id}`, { method: 'DELETE' }),

  investments: () => req('/investments'),
  createInvestment: (body: any) => req('/investments', { method: 'POST', body: JSON.stringify(body) }),
  updateInvestment: (id: string, body: any) => req(`/investments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteInvestment: (id: string) => req(`/investments/${id}`, { method: 'DELETE' }),

  assets: () => req('/assets'),
  createAsset: (body: any) => req('/assets', { method: 'POST', body: JSON.stringify(body) }),
  deleteAsset: (id: string) => req(`/assets/${id}`, { method: 'DELETE' }),

  summary: () => req('/analytics/summary'),

  coachHistory: (session_id: string) => req(`/coach/history?session_id=${session_id}`),
  // coach chat uses fetch directly for streaming
  coachChatUrl: () => `${BASE}/api/coach/chat`,
};

export const BASE_URL = BASE;
