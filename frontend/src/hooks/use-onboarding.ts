import { useCallback, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';

const KEY = 'mf.onboardingDone';

export function useOnboarding() {
  const [done, setDone] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const v = await storage.getItem<boolean>(KEY, false);
      setDone(v === true);
      setChecking(false);
    })();
  }, []);

  const markDone = useCallback(async () => {
    await storage.setItem(KEY, true);
    setDone(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await storage.setItem(KEY, false);
    setDone(false);
  }, []);

  return { done, checking, markDone, resetOnboarding };
}