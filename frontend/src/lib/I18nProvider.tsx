import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getLocale, initLocale, setLocale as persistLocale, t as translate, type Locale } from '@/src/lib/i18n';

type I18nContextValue = {
  locale: Locale;
  ready: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: typeof translate;
};

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  ready: true,
  setLocale: persistLocale,
  t: translate,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void initLocale().then((savedLocale) => {
      if (!mounted) return;
      setLocaleState(savedLocale);
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    // Update the module translator before notifying consumers so every t()
    // call in the resulting render observes the same locale.
    setLocaleState(nextLocale);
    await persistLocale(nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    ready,
    setLocale,
    t: translate,
  }), [locale, ready, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
