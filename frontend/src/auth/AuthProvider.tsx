import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '@/src/api/client';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: string;
  currency: string;
  theme?: string;
};

type Ctx = {
  user: User | null;
  loading: boolean;
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

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const r = await api.me();
      setUser(r.user);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await api.login({ email, password });
    await setToken(r.token);
    setUser(r.user);
  };

  const signup = async (name: string, email: string, password: string) => {
    const r = await api.signup({ name, email, password });
    await setToken(r.token);
    setUser(r.user);
  };

  const loginWithEmergentToken = async (session_token: string) => {
    const r = await api.emergentSession(session_token);
    await setToken(r.token);
    setUser(r.user);
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    await setToken(null);
    setUser(null);
  };

  const updateProfile = async (patch: Partial<User>) => {
    const r = await api.updateMe(patch);
    setUser(r.user);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, loginWithEmergentToken, logout, refresh, updateProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
