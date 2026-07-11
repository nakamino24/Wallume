import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { palette, Palette, ThemeMode } from '@/src/theme/tokens';
import { storage } from '@/src/utils/storage';

type Ctx = {
  mode: ThemeMode;
  colors: Palette;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);
const KEY = 'mf.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<ThemeMode | null>(KEY, null);
      if (saved === 'light' || saved === 'dark') setModeState(saved);
      else if (system === 'light') setModeState('light');
    })();
  }, [system]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    storage.setItem(KEY, m);
  };
  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const value = useMemo<Ctx>(
    () => ({ mode, colors: palette[mode], setMode, toggle }),
    [mode],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error('useTheme outside ThemeProvider');
  return c;
}
