import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '@/src/utils/storage';

type Ctx = {
  isBalanceVisible: boolean;
  isPrivacyReady: boolean;
  showBalance: () => void;
  hideBalance: () => void;
  toggleBalanceVisibility: () => void;
};

const BalancePrivacyCtx = createContext<Ctx | null>(null);
const KEY = 'wallume.privacy.showBalances';

export function BalancePrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isBalanceVisible, setVisible] = useState(false);
  const [isPrivacyReady, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<boolean | null>(KEY, null);
      if (saved === true) setVisible(true);
      else if (saved === false) setVisible(false);
      else setVisible(false); // default HIDDEN
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: boolean) => {
    setVisible(next);
    storage.setItem(KEY, next);
  }, []);

  const showBalance = useCallback(() => persist(true), [persist]);
  const hideBalance = useCallback(() => persist(false), [persist]);
  const toggleBalanceVisibility = useCallback(() => persist(!isBalanceVisible), [isBalanceVisible, persist]);

  const value = useMemo<Ctx>(() => ({
    isBalanceVisible,
    isPrivacyReady,
    showBalance,
    hideBalance,
    toggleBalanceVisibility,
  }), [isBalanceVisible, isPrivacyReady, showBalance, hideBalance, toggleBalanceVisibility]);

  return <BalancePrivacyCtx.Provider value={value}>{children}</BalancePrivacyCtx.Provider>;
}

export function useBalancePrivacy() {
  const c = useContext(BalancePrivacyCtx);
  if (!c) throw new Error('useBalancePrivacy outside BalancePrivacyProvider');
  return c;
}
