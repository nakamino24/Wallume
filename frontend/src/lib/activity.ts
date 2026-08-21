// Pure logic for Wallet Recent Activity: date grouping + intra-day ordering.
// Framework-free and zone-explicit so it is unit-testable across timezones.

import { activityDayKey, ymdInZone } from '@/src/utils/dates';

export type ActivityTx = {
  id: string;
  date?: string;
  created_at?: string;
  [key: string]: any;
};

export type ActivityGroup = { label: string; items: ActivityTx[] };

export type GroupOptions = {
  /** Reference "now" for TODAY/YESTERDAY labels (defaults to real now). */
  now?: Date;
  /** IANA zone used to render instants; omitted = device zone. */
  timeZone?: string;
};

/** Newest save-time first inside a calendar-day group; deterministic id
 * tiebreaker when created_at is absent or identical. */
export function compareIntraDay(a: ActivityTx, b: ActivityTx): number {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (tb !== ta) return tb - ta;
  return (b.id || '').localeCompare(a.id || '');
}

function labelFor(key: string, opts: GroupOptions): string {
  const now = opts.now ?? new Date();
  const tz = opts.timeZone;
  if (key === ymdInZone(now, tz)) return 'TODAY';
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === ymdInZone(yesterday, tz)) return 'YESTERDAY';
  // Noon-UTC anchor: with a real Intl the timeZone option decides the day;
  // if an environment ever drops it, midday keeps the calendar day stable
  // across offsets instead of flipping at midnight boundaries.
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(tz ? { timeZone: tz } : {}),
  })
    .format(new Date(`${key}T12:00:00Z`))
    .toUpperCase();
}

/**
 * Group transactions by user-facing calendar day. Groups newest-first; items
 * within a group newest-save-first with deterministic tiebreakers.
 *
 * Grouping uses `date` (when the user says it happened) with `created_at`
 * (when it was saved) as fallback — Wallume's existing semantics.
 */
export function groupActivitiesByDay(txs: ActivityTx[], opts: GroupOptions = {}): ActivityGroup[] {
  const groups = new Map<string, ActivityTx[]>();
  for (const t of txs) {
    const key = activityDayKey(t.date || t.created_at, opts.timeZone);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(t);
    else groups.set(key, [t]);
  }

  // Lexicographic DESC on YYYY-MM-DD keys == chronological DESC.
  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));

  for (const key of sortedKeys) {
    // Safety net over the backend's compound sort: the DB was normalized to
    // YYYY-MM-DD (2026-08-22) but the API still accepts arbitrary strings,
    // so intra-day order stays deterministic even if bad data reappears.
    groups.get(key)!.sort(compareIntraDay);
  }

  return sortedKeys.map((key) => ({ label: labelFor(key, opts), items: groups.get(key)! }));
}
