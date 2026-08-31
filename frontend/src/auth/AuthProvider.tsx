import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { api, getToken, setToken } from '@/src/api/client';
import { clearTransactionsState } from '@/src/hooks/use-transactions';
import { storage } from '@/src/utils/storage';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: string;
  currency: string;
  theme?: string;
  payday_day?: number | null;
  work_week?: number | null;
};

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'temporarily-unavailable';

type Ctx = {
  user: User | null;
  loading: boolean;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginWithEmergentToken: (session_token: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setStatus('unauthenticated');
      setLoading(false);
      return;
    }
    try {
      const r = await api.me();
      setUser(r.user);
      setStatus('authenticated');
      storage.setItem('mf.widget.currency', r.user.currency || 'USD');
    } catch (e: any) {
      const httpStatus = e?.status;
      const isDefinitive = httpStatus === 401 || httpStatus === 403;
      if (isDefinitive) {
        await setToken(null);
        setUser(null);
        setStatus('unauthenticated');
      } else {
        // Transient network/5xx/timeout — preserve token and existing user
        setStatus('temporarily-unavailable');
        // Keep existing user if we already had one, otherwise stay null but not unauthenticated
        // Do not clear token
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  // Retry when app returns to foreground if temporarily unavailable
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status === 'temporarily-unavailable') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [status, refresh]);

  const login = async (email: string, password: string) => {
    clearTransactionsState();
    const r = await api.login({ email, password });
    await setToken(r.token);
    setUser(r.user);
    setStatus('authenticated');
    storage.setItem('mf.widget.currency', r.user.currency || 'USD');
  };

  const signup = async (name: string, email: string, password: string) => {
    clearTransactionsState();
    const r = await api.signup({ name, email, password });
    await setToken(r.token);
    setUser(r.user);
    setStatus('authenticated');
    storage.setItem('mf.widget.currency', r.user.currency || 'USD');
  };

  const loginWithEmergentToken = async (session_token: string) => {
    clearTransactionsState();
    const r = await api.emergentSession(session_token);
    await setToken(r.token);
    setUser(r.user);
    setStatus('authenticated');
    storage.setItem('mf.widget.currency', r.user.currency || 'USD');
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    await setToken(null);
    clearTransactionsState();
    setUser(null);
    setStatus('unauthenticated');
  };

  const updateProfile = async (patch: Partial<User>) => {
    const r = await api.updateMe(patch);
    setUser(r.user);
    storage.setItem('mf.widget.currency', r.user.currency || 'USD');
  };

  return (
    <AuthCtx.Provider value={{ user, loading, status, login, signup, loginWithEmergentToken, logout, refresh, updateProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
