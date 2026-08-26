import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '@/src/utils/storage';
import { todayLocalISO } from '@/src/utils/dates';

export type ReportPeriodKind = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'monthly' | 'custom';

export type ReportPeriod = {
  fromDate: string;
  toDate: string;
  kind: ReportPeriodKind;
  label: string;
};

const KEY = 'wallume.reportPeriod.v1';

function monthLabel(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const sameMonth = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth() && from.slice(0, 7) === to.slice(0, 7) && new Date(to).getDate() >= 28;
  if (sameMonth) {
    return f.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const a = f.toLocaleDateString(undefined, opts);
  const b = t.toLocaleDateString(undefined, { ...opts, year: 'numeric' });
  return `${a} – ${b}`;
}

function defaultPeriod(): ReportPeriod {
  const d = new Date();
  d.setDate(1);
  const from = todayLocalISO(d);
  const to = todayLocalISO();
  return { fromDate: from, toDate: to, kind: 'this_month', label: new Date(`${from}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
}

type Ctx = {
  period: ReportPeriod;
  setPeriod: (p: ReportPeriod) => void;
  isReady: boolean;
};

const ReportPeriodCtx = createContext<Ctx | null>(null);

export function ReportPeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriodState] = useState<ReportPeriod>(() => defaultPeriod());
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string | null>(KEY, null);
      let saved: ReportPeriod | null = null;
      if (typeof raw === 'string') {
        try { saved = JSON.parse(raw) as ReportPeriod; } catch { saved = null; }
      }
      if (saved?.fromDate && saved.toDate && saved.kind && saved.label) {
        setPeriodState(saved);
      }
      setReady(true);
    })();
  }, []);

  const setPeriod = useCallback((p: ReportPeriod) => {
    setPeriodState(p);
    storage.setItem(KEY, JSON.stringify(p));
  }, []);

  const value = useMemo(() => ({ period, setPeriod, isReady }), [period, setPeriod, isReady]);
  return <ReportPeriodCtx.Provider value={value}>{children}</ReportPeriodCtx.Provider>;
}

export function useReportPeriod() {
  const c = useContext(ReportPeriodCtx);
  if (!c) throw new Error('useReportPeriod outside provider');
  return c;
}

export function derivePeriodLabel(from: string, to: string, kind: ReportPeriodKind): string {
  if (kind === 'this_month' || kind === 'monthly') {
    return new Date(`${from}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return monthLabel(from, to);
}
